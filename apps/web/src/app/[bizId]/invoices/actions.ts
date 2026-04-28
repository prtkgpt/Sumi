'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import {
  getDb,
  invoices,
  invoiceLineItems,
  customers,
  type NewInvoiceLineItem,
} from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';

const LineItemInput = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z
    .string()
    .min(1)
    .regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a number'),
  unitPriceDollars: z
    .string()
    .min(1)
    .regex(/^\d+(\.\d{1,2})?$/, 'Unit price must be a dollar amount'),
});

const Input = z.object({
  bizId: z.string().uuid(),
  customerId: z.string().uuid('Pick a customer'),
  issuedAt: z.string().min(1, 'Issue date is required'),
  dueAt: z.string().min(1, 'Due date is required'),
  notes: z.string().trim().max(2000).optional(),
  lineItems: z.array(LineItemInput).min(1, 'Add at least one line item'),
});

export type InvoiceFormState = {
  error?: string;
};

function parseLineItems(formData: FormData): z.infer<typeof LineItemInput>[] {
  const descriptions = formData.getAll('lineItems.description').map(String);
  const quantities = formData.getAll('lineItems.quantity').map(String);
  const unitPrices = formData.getAll('lineItems.unitPrice').map(String);
  const items: z.infer<typeof LineItemInput>[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    if (!description) continue;
    items.push({
      description,
      quantity: quantities[i] ?? '1',
      unitPriceDollars: unitPrices[i] ?? '0',
    });
  }
  return items;
}

function publicToken(): string {
  return randomBytes(18).toString('base64url');
}

async function nextInvoiceNumber(
  db: ReturnType<typeof getDb>,
  businessId: string
): Promise<number> {
  const [row] = await db
    .select({
      maxN: sql<number>`coalesce(max(${invoices.invoiceNumber}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.businessId, businessId));
  return (row?.maxN ?? 0) + 1;
}

function buildLineItems(
  invoiceId: string,
  parsed: z.infer<typeof LineItemInput>[]
): { rows: NewInvoiceLineItem[]; totalCents: number } {
  let totalCents = 0;
  const rows: NewInvoiceLineItem[] = parsed.map((li, idx) => {
    const qty = Number(li.quantity);
    const unit = Math.round(Number(li.unitPriceDollars) * 100);
    const amount = Math.round(qty * unit);
    totalCents += amount;
    return {
      invoiceId,
      description: li.description,
      quantity: qty.toString(),
      unitPriceCents: unit,
      amountCents: amount,
      position: idx,
    };
  });
  return { rows, totalCents };
}

export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const lineItems = parseLineItems(formData);
  const parsed = Input.safeParse({
    bizId: formData.get('bizId'),
    customerId: formData.get('customerId'),
    issuedAt: formData.get('issuedAt'),
    dueAt: formData.get('dueAt'),
    notes: formData.get('notes') || undefined,
    lineItems,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;
  const { user, business } = await requireBusiness(input.bizId);
  const db = getDb();

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.id, input.customerId),
        eq(customers.businessId, business.id)
      )
    )
    .limit(1);
  if (!customer) return { error: 'Customer not found' };

  const invoiceId = await db.transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx as unknown as ReturnType<typeof getDb>, business.id);
    const [created] = await tx
      .insert(invoices)
      .values({
        businessId: business.id,
        customerId: customer.id,
        invoiceNumber: number,
        publicToken: publicToken(),
        status: 'draft',
        issuedAt: input.issuedAt,
        dueAt: input.dueAt,
        totalCents: 0,
        notes: input.notes ?? null,
        createdByUserId: user.id,
      })
      .returning({ id: invoices.id });

    const { rows, totalCents } = buildLineItems(created.id, input.lineItems);
    await tx.insert(invoiceLineItems).values(rows);
    await tx
      .update(invoices)
      .set({ totalCents, updatedAt: new Date() })
      .where(eq(invoices.id, created.id));

    return created.id;
  });

  revalidatePath(`/${business.id}/invoices`);
  redirect(`/${business.id}/invoices/${invoiceId}`);
}

const UpdateInput = Input.extend({
  invoiceId: z.string().uuid(),
});

export async function updateInvoice(
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const lineItems = parseLineItems(formData);
  const parsed = UpdateInput.safeParse({
    bizId: formData.get('bizId'),
    invoiceId: formData.get('invoiceId'),
    customerId: formData.get('customerId'),
    issuedAt: formData.get('issuedAt'),
    dueAt: formData.get('dueAt'),
    notes: formData.get('notes') || undefined,
    lineItems,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;
  const { business } = await requireBusiness(input.bizId);
  const db = getDb();

  // Only drafts are editable.
  const [existing] = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, input.invoiceId),
        eq(invoices.businessId, business.id)
      )
    )
    .limit(1);
  if (!existing) return { error: 'Invoice not found' };
  if (existing.status !== 'draft') {
    return { error: 'Only draft invoices can be edited' };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, input.invoiceId));
    const { rows, totalCents } = buildLineItems(
      input.invoiceId,
      input.lineItems
    );
    await tx.insert(invoiceLineItems).values(rows);
    await tx
      .update(invoices)
      .set({
        customerId: input.customerId,
        issuedAt: input.issuedAt,
        dueAt: input.dueAt,
        notes: input.notes ?? null,
        totalCents,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, input.invoiceId));
  });

  revalidatePath(`/${business.id}/invoices`);
  redirect(`/${business.id}/invoices/${input.invoiceId}`);
}

const StatusInput = z.object({
  bizId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export async function sendInvoice(formData: FormData) {
  const parsed = StatusInput.parse({
    bizId: formData.get('bizId'),
    invoiceId: formData.get('invoiceId'),
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();
  await db
    .update(invoices)
    .set({ status: 'sent', updatedAt: new Date() })
    .where(
      and(
        eq(invoices.id, parsed.invoiceId),
        eq(invoices.businessId, business.id),
        eq(invoices.status, 'draft')
      )
    );
  revalidatePath(`/${business.id}/invoices/${parsed.invoiceId}`);
  revalidatePath(`/${business.id}/invoices`);
}

export async function markInvoicePaid(formData: FormData) {
  const parsed = StatusInput.parse({
    bizId: formData.get('bizId'),
    invoiceId: formData.get('invoiceId'),
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();
  const [inv] = await db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, parsed.invoiceId),
        eq(invoices.businessId, business.id)
      )
    )
    .limit(1);
  if (!inv) return;
  await db
    .update(invoices)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paidAmountCents: inv.totalCents,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(invoices.id, parsed.invoiceId),
        eq(invoices.businessId, business.id)
      )
    );
  revalidatePath(`/${business.id}/invoices/${parsed.invoiceId}`);
  revalidatePath(`/${business.id}/invoices`);
  revalidatePath(`/${business.id}/dashboard`);
}

export async function voidInvoice(formData: FormData) {
  const parsed = StatusInput.parse({
    bizId: formData.get('bizId'),
    invoiceId: formData.get('invoiceId'),
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();
  await db
    .update(invoices)
    .set({ status: 'void', updatedAt: new Date() })
    .where(
      and(
        eq(invoices.id, parsed.invoiceId),
        eq(invoices.businessId, business.id),
        sql`${invoices.status} in ('draft', 'sent')`
      )
    );
  revalidatePath(`/${business.id}/invoices/${parsed.invoiceId}`);
  revalidatePath(`/${business.id}/invoices`);
}

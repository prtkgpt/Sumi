import { notFound, redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import {
  getDb,
  invoices,
  invoiceLineItems,
  customers,
} from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';
import { InvoiceForm } from '../../invoice-form';

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ bizId: string; invoiceId: string }>;
}) {
  const { bizId, invoiceId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const [inv] = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      customerId: invoices.customerId,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      notes: invoices.notes,
    })
    .from(invoices)
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.businessId, business.id))
    )
    .limit(1);
  if (!inv) notFound();
  if (inv.status !== 'draft') {
    // Sent / paid / void invoices are immutable.
    redirect(`/${business.id}/invoices/${inv.id}`);
  }

  const [lines, customerRows] = await Promise.all([
    db
      .select({
        description: invoiceLineItems.description,
        quantity: invoiceLineItems.quantity,
        unitPriceCents: invoiceLineItems.unitPriceCents,
      })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, inv.id))
      .orderBy(asc(invoiceLineItems.position)),
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, business.id),
          eq(customers.isArchived, false)
        )
      )
      .orderBy(asc(customers.name)),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Edit invoice</h1>
      <div className="mt-8">
        <InvoiceForm
          bizId={business.id}
          customers={customerRows}
          invoice={{
            id: inv.id,
            customerId: inv.customerId,
            issuedAt: inv.issuedAt,
            dueAt: inv.dueAt,
            notes: inv.notes,
            lineItems: lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPriceDollars: (l.unitPriceCents / 100).toFixed(2),
            })),
          }}
        />
      </div>
    </div>
  );
}

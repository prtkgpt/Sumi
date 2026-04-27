'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb, customers } from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';

const Input = z.object({
  bizId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .max(200)
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CustomerFormState = {
  error?: string;
};

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const parsed = Input.safeParse({
    bizId: formData.get('bizId'),
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;
  const { business } = await requireBusiness(input.bizId);
  const db = getDb();

  await db.insert(customers).values({
    businessId: business.id,
    name: input.name,
    email: input.email ? input.email : null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
  });

  revalidatePath(`/${business.id}/customers`);
  redirect(`/${business.id}/customers`);
}

const UpdateInput = Input.extend({
  customerId: z.string().uuid(),
});

export async function updateCustomer(
  _prev: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const parsed = UpdateInput.safeParse({
    bizId: formData.get('bizId'),
    customerId: formData.get('customerId'),
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;
  const { business } = await requireBusiness(input.bizId);
  const db = getDb();

  await db
    .update(customers)
    .set({
      name: input.name,
      email: input.email ? input.email : null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customers.id, input.customerId),
        eq(customers.businessId, business.id)
      )
    );

  revalidatePath(`/${business.id}/customers`);
  redirect(`/${business.id}/customers`);
}

const ArchiveInput = z.object({
  bizId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export async function archiveCustomer(formData: FormData) {
  const parsed = ArchiveInput.parse({
    bizId: formData.get('bizId'),
    customerId: formData.get('customerId'),
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();
  await db
    .update(customers)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(
        eq(customers.id, parsed.customerId),
        eq(customers.businessId, business.id)
      )
    );
  revalidatePath(`/${business.id}/customers`);
}

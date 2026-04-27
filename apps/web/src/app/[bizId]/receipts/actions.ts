'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb, receipts, transactions } from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';

const MatchInput = z.object({
  bizId: z.string().uuid(),
  receiptId: z.string().uuid(),
  // Empty string clears the match.
  transactionId: z.string().uuid().or(z.literal('')),
});

export async function matchReceipt(formData: FormData) {
  const parsed = MatchInput.parse({
    bizId: formData.get('bizId'),
    receiptId: formData.get('receiptId'),
    transactionId: formData.get('transactionId') ?? '',
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();

  if (parsed.transactionId) {
    // Defense-in-depth: ensure the transaction belongs to this business.
    const [txn] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, parsed.transactionId),
          eq(transactions.businessId, business.id)
        )
      )
      .limit(1);
    if (!txn) throw new Error('Transaction not found');
    await db
      .update(receipts)
      .set({
        transactionId: txn.id,
        status: 'matched',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receipts.id, parsed.receiptId),
          eq(receipts.businessId, business.id)
        )
      );
  } else {
    await db
      .update(receipts)
      .set({
        transactionId: null,
        status: 'unmatched',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receipts.id, parsed.receiptId),
          eq(receipts.businessId, business.id)
        )
      );
  }

  revalidatePath(`/${business.id}/receipts`);
}

const DeleteInput = z.object({
  bizId: z.string().uuid(),
  receiptId: z.string().uuid(),
});

export async function deleteReceipt(formData: FormData) {
  const parsed = DeleteInput.parse({
    bizId: formData.get('bizId'),
    receiptId: formData.get('receiptId'),
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();
  await db
    .delete(receipts)
    .where(
      and(
        eq(receipts.id, parsed.receiptId),
        eq(receipts.businessId, business.id)
      )
    );
  revalidatePath(`/${business.id}/receipts`);
}

'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import {
  getDb,
  transactions,
  financialAccounts,
  categories,
} from '@sumi/db';
import { revalidatePath } from 'next/cache';
import { requireBusiness } from '@/lib/auth/require-business';
import { normalizeMerchant } from '@/lib/categorization/normalize';
import { upsertRule } from '@/lib/categorization/rules';
import { autoCategorizeBusiness } from '@/lib/categorization/categorize';

const Input = z.object({
  bizId: z.string().uuid(),
  postedAt: z.string().min(1, 'Date is required'),
  // Dollars input from the form, parsed and signed below.
  amountDollars: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^-?\d+(\.\d{1,2})?$/, 'Amount must be a valid dollar value'),
  direction: z.enum(['inflow', 'outflow']),
  accountId: z.string().uuid('Pick an account'),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  merchant: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1, 'Description is required').max(500),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateManualTransactionState = {
  error?: string;
};

export async function createManualTransaction(
  _prev: CreateManualTransactionState,
  formData: FormData
): Promise<CreateManualTransactionState> {
  const parsed = Input.safeParse({
    bizId: formData.get('bizId'),
    postedAt: formData.get('postedAt'),
    amountDollars: formData.get('amountDollars'),
    direction: formData.get('direction'),
    accountId: formData.get('accountId'),
    categoryId: formData.get('categoryId') || undefined,
    merchant: formData.get('merchant') || undefined,
    description: formData.get('description'),
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;

  const { user, business } = await requireBusiness(input.bizId);

  const db = getDb();

  // Defense in depth: verify the chosen account + category belong to this business.
  const [account] = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, input.accountId),
        eq(financialAccounts.businessId, business.id)
      )
    )
    .limit(1);
  if (!account) return { error: 'Account not found' };

  let categoryId: string | null = null;
  if (input.categoryId) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, input.categoryId),
          eq(categories.businessId, business.id)
        )
      )
      .limit(1);
    if (!cat) return { error: 'Category not found' };
    categoryId = cat.id;
  }

  const dollars = Number(input.amountDollars.replace(/^-/, ''));
  const cents = Math.round(dollars * 100);
  const signed = input.direction === 'inflow' ? cents : -cents;

  await db.insert(transactions).values({
    businessId: business.id,
    accountId: account.id,
    categoryId,
    categorySource: categoryId ? 'user' : null,
    postedAt: new Date(input.postedAt),
    amountCents: signed,
    currency: 'USD',
    merchant: input.merchant ?? null,
    description: input.description,
    source: 'manual',
    status: 'reviewed',
    notes: input.notes ?? null,
    createdByUserId: user.id,
  });

  redirect(`/${business.id}/transactions`);
}

const SetCategoryInput = z.object({
  bizId: z.string().uuid(),
  transactionId: z.string().uuid(),
  // Empty string = clear the category.
  categoryId: z.string().uuid().or(z.literal('')),
});

export async function setTransactionCategory(formData: FormData) {
  const parsed = SetCategoryInput.parse({
    bizId: formData.get('bizId'),
    transactionId: formData.get('transactionId'),
    categoryId: formData.get('categoryId') ?? '',
  });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();

  const nextCategoryId: string | null = parsed.categoryId || null;
  if (nextCategoryId) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, nextCategoryId),
          eq(categories.businessId, business.id)
        )
      )
      .limit(1);
    if (!cat) throw new Error('Category not found');
  }

  // Read merchant first so we can write a learned rule below.
  const [txnRow] = await db
    .select({
      merchant: transactions.merchant,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, parsed.transactionId),
        eq(transactions.businessId, business.id)
      )
    )
    .limit(1);

  await db
    .update(transactions)
    .set({
      categoryId: nextCategoryId,
      categorySource: nextCategoryId ? 'user' : null,
      status: 'reviewed',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.id, parsed.transactionId),
        eq(transactions.businessId, business.id)
      )
    );

  // Stage 3: when the user assigns a category, learn a rule. source='user'
  // wins over source='llm' for the same merchant on future Plaid imports.
  if (txnRow && nextCategoryId) {
    const merchantKey = normalizeMerchant(txnRow.merchant ?? txnRow.description);
    if (merchantKey) {
      try {
        await upsertRule({
          businessId: business.id,
          merchantNormalized: merchantKey,
          categoryId: nextCategoryId,
          source: 'user',
        });
      } catch (err) {
        console.error('upsertRule (user override) failed', err);
      }
    }
  }
}

const RecategorizeInput = z.object({
  bizId: z.string().uuid(),
});

export type RecategorizeState = {
  ruleHits?: number;
  llmHits?: number;
  llmMisses?: number;
  scanned?: number;
  error?: string;
};

/**
 * Manual trigger that runs the categorization orchestrator across the
 * business's uncategorized transactions. Bounded per call by the
 * orchestrator (MAX_TRANSACTIONS_PER_RUN); the button can be clicked
 * again to keep chipping away at large backlogs.
 */
export async function recategorizeUncategorized(
  _prev: RecategorizeState,
  formData: FormData
): Promise<RecategorizeState> {
  let parsed: z.infer<typeof RecategorizeInput>;
  try {
    parsed = RecategorizeInput.parse({ bizId: formData.get('bizId') });
  } catch {
    return { error: 'Invalid request' };
  }

  const { business } = await requireBusiness(parsed.bizId);

  try {
    const result = await autoCategorizeBusiness(business.id);
    revalidatePath(`/${business.id}/transactions`);
    return result;
  } catch (err) {
    console.error('recategorizeUncategorized failed', err);
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

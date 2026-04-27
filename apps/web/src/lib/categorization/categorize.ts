import 'server-only';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import {
  getDb,
  transactions,
  categories,
  financialAccounts,
  type Transaction,
} from '@sumi/db';
import { normalizeMerchant } from './normalize';
import { findRules, upsertRule } from './rules';
import {
  categorizeBatch,
  type CategoryChoice,
  type LLMTransaction,
} from './llm';

const BATCH_SIZE = 20;
const MAX_TRANSACTIONS_PER_RUN = 100;

type Pending = {
  txn: Pick<
    Transaction,
    'id' | 'merchant' | 'description' | 'amountCents'
  >;
  accountKind: string;
  merchantKey: string;
};

/**
 * For a business, find all uncategorized rows (manual or Plaid) that have
 * a non-empty merchant string, and:
 *   1. Apply matching rules first (zero LLM calls).
 *   2. For the remainder, batch into Claude Haiku calls (~20 per call).
 *   3. Persist resulting category_id and write back a source='llm' rule
 *      for every confident verdict.
 *
 * Bounded to MAX_TRANSACTIONS_PER_RUN so a fresh sandbox connect doesn't
 * fan out unboundedly. Subsequent calls keep chipping away.
 */
export async function autoCategorizeBusiness(businessId: string): Promise<{
  ruleHits: number;
  llmHits: number;
  llmMisses: number;
  scanned: number;
}> {
  const db = getDb();

  const cats = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      kind: categories.kind,
      displayName: categories.displayName,
    })
    .from(categories)
    .where(eq(categories.businessId, businessId))
    .orderBy(asc(categories.displayName));
  if (cats.length === 0) {
    return { ruleHits: 0, llmHits: 0, llmMisses: 0, scanned: 0 };
  }
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));
  const choices: CategoryChoice[] = cats.map((c) => ({
    slug: c.slug,
    kind: c.kind,
    displayName: c.displayName,
  }));

  const rows = await db
    .select({
      id: transactions.id,
      merchant: transactions.merchant,
      description: transactions.description,
      amountCents: transactions.amountCents,
      accountKind: financialAccounts.kind,
    })
    .from(transactions)
    .innerJoin(
      financialAccounts,
      eq(financialAccounts.id, transactions.accountId)
    )
    .where(
      and(
        eq(transactions.businessId, businessId),
        isNull(transactions.categoryId)
      )
    )
    .orderBy(asc(transactions.postedAt))
    .limit(MAX_TRANSACTIONS_PER_RUN);

  if (rows.length === 0) {
    return { ruleHits: 0, llmHits: 0, llmMisses: 0, scanned: 0 };
  }

  const pendings: Pending[] = rows
    .map<Pending>((r) => ({
      txn: {
        id: r.id,
        merchant: r.merchant,
        description: r.description,
        amountCents: r.amountCents,
      },
      accountKind: r.accountKind,
      merchantKey: normalizeMerchant(r.merchant ?? r.description),
    }))
    .filter((p) => p.merchantKey.length > 0);

  // Stage 1 — exact rule lookup.
  const ruleMap = await findRules(
    businessId,
    pendings.map((p) => p.merchantKey)
  );

  // Bucket rule hits by (category_id, source) so we can issue one UPDATE
  // per group instead of one per row.
  const ruleHitTxnIds: string[] = [];
  const ruleHitGroups = new Map<string, { categoryId: string; source: 'user' | 'llm'; ids: string[] }>();
  const llmCandidates: Pending[] = [];

  for (const p of pendings) {
    const rule = ruleMap.get(p.merchantKey);
    if (rule) {
      const key = `${rule.categoryId}:${rule.source}`;
      const group = ruleHitGroups.get(key) ?? {
        categoryId: rule.categoryId,
        source: rule.source,
        ids: [],
      };
      group.ids.push(p.txn.id);
      ruleHitGroups.set(key, group);
      ruleHitTxnIds.push(p.txn.id);
    } else {
      llmCandidates.push(p);
    }
  }

  if (ruleHitGroups.size > 0) {
    await db.transaction(async (tx) => {
      for (const group of ruleHitGroups.values()) {
        await tx
          .update(transactions)
          .set({
            categoryId: group.categoryId,
            categorySource: group.source,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(transactions.id, group.ids),
              eq(transactions.businessId, businessId),
              isNull(transactions.categoryId)
            )
          );
      }
    });
  }

  // Stage 2 — LLM in batches.
  let llmHits = 0;
  let llmMisses = 0;

  for (let i = 0; i < llmCandidates.length; i += BATCH_SIZE) {
    const batch = llmCandidates.slice(i, i + BATCH_SIZE);
    const llmInput: LLMTransaction[] = batch.map((p) => ({
      ref: p.txn.id,
      merchant: p.txn.merchant ?? '',
      description: p.txn.description,
      amountCents: p.txn.amountCents,
      accountKind: p.accountKind,
    }));

    const verdicts = await categorizeBatch(llmInput, choices);
    const verdictByRef = new Map(verdicts.map((v) => [v.ref, v]));

    for (const p of batch) {
      const verdict = verdictByRef.get(p.txn.id);
      if (!verdict || !verdict.categorySlug) {
        llmMisses++;
        continue;
      }
      const cat = catBySlug.get(verdict.categorySlug);
      if (!cat) {
        llmMisses++;
        continue;
      }
      await db
        .update(transactions)
        .set({ categoryId: cat.id, categorySource: 'llm', updatedAt: new Date() })
        .where(
          and(
            eq(transactions.id, p.txn.id),
            eq(transactions.businessId, businessId),
            isNull(transactions.categoryId)
          )
        );
      llmHits++;
      await upsertRule({
        businessId,
        merchantNormalized: p.merchantKey,
        categoryId: cat.id,
        source: 'llm',
        confidence: verdict.confidence,
      });
    }
  }

  return {
    ruleHits: ruleHitTxnIds.length,
    llmHits,
    llmMisses,
    scanned: pendings.length,
  };
}

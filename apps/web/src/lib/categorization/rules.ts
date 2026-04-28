import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  getDb,
  categorizationRules,
  type CategorizationRule,
} from '@sumi/db';

/**
 * Look up rules for a batch of normalized merchants. Returns a Map keyed by
 * normalized merchant for easy zip-back.
 */
export async function findRules(
  businessId: string,
  merchants: string[]
): Promise<Map<string, CategorizationRule>> {
  const out = new Map<string, CategorizationRule>();
  if (merchants.length === 0) return out;
  const unique = Array.from(new Set(merchants.filter(Boolean)));
  if (unique.length === 0) return out;

  const db = getDb();
  const rows = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.businessId, businessId),
        inArray(categorizationRules.merchantNormalized, unique)
      )
    );

  for (const row of rows) {
    out.set(row.merchantNormalized, row);
  }
  return out;
}

type UpsertRuleInput = {
  businessId: string;
  merchantNormalized: string;
  categoryId: string;
  source: 'user' | 'llm';
  confidence?: number;
};

/**
 * Upsert a rule keyed by (business_id, merchant_normalized).
 *
 * Conflict resolution:
 *   - source='user' overwrites everything (user is the source of truth).
 *   - source='llm' will NOT overwrite an existing source='user' row.
 */
export async function upsertRule(input: UpsertRuleInput): Promise<void> {
  if (!input.merchantNormalized) return;
  const db = getDb();

  await db
    .insert(categorizationRules)
    .values({
      businessId: input.businessId,
      merchantNormalized: input.merchantNormalized,
      categoryId: input.categoryId,
      source: input.source,
      confidence:
        input.confidence !== undefined ? input.confidence.toFixed(2) : null,
    })
    .onConflictDoUpdate({
      target: [
        categorizationRules.businessId,
        categorizationRules.merchantNormalized,
      ],
      set: {
        categoryId: sql`case when ${categorizationRules.source} = 'user' and excluded.source = 'llm' then ${categorizationRules.categoryId} else excluded.category_id end`,
        source: sql`case when ${categorizationRules.source} = 'user' and excluded.source = 'llm' then ${categorizationRules.source} else excluded.source end`,
        confidence: sql`case when ${categorizationRules.source} = 'user' and excluded.source = 'llm' then ${categorizationRules.confidence} else excluded.confidence end`,
        updatedAt: new Date(),
      },
    });
}

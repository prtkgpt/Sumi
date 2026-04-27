import 'server-only';
import { and, eq, gte, lt, sql, isNotNull } from 'drizzle-orm';
import {
  getDb,
  transactions,
  financialAccounts,
  categories,
} from '@sumi/db';

export type KpiSnapshot = {
  cashOnHandCents: number;
  cashAccountCount: number;
  revenueMtdCents: number;
  expensesMtdCents: number;
  profitMtdCents: number;
};

/**
 * Returns the start of the current calendar month in UTC. Good enough for v0.4
 * — when we ship per-business timezones (v0.7 settings), swap this for a
 * tz-aware variant via date-fns-tz and the business's configured zone.
 */
function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Computes the four month-to-date KPIs for a business in a single round-trip
 * batch. Cash on hand uses the most recent Plaid `accountsGet` snapshot held
 * in `financial_accounts.current_balance_cents`; credit cards are excluded
 * (they're liabilities, not cash).
 *
 * Revenue and expenses key off `categories.kind` so uncategorized
 * transactions don't pollute the totals — the "Needs review" filter exists
 * precisely to surface anything that's still uncategorized.
 */
export async function getDashboardKpis(
  businessId: string
): Promise<KpiSnapshot> {
  const db = getDb();
  const monthStart = startOfMonthUtc();

  const [cashRow] = await db
    .select({
      cents: sql<string>`coalesce(sum(${financialAccounts.currentBalanceCents}), 0)`,
      n: sql<string>`count(*)`,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.businessId, businessId),
        eq(financialAccounts.isArchived, false),
        isNotNull(financialAccounts.currentBalanceCents),
        sql`${financialAccounts.kind} in ('bank_checking', 'bank_savings', 'manual_cash')`
      )
    );

  const [revenueRow] = await db
    .select({
      cents: sql<string>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.businessId, businessId),
        gte(transactions.postedAt, monthStart),
        lt(transactions.postedAt, nextMonthUtc(monthStart)),
        eq(categories.kind, 'income')
      )
    );

  const [expenseRow] = await db
    .select({
      cents: sql<string>`coalesce(sum(${transactions.amountCents} * -1), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.businessId, businessId),
        gte(transactions.postedAt, monthStart),
        lt(transactions.postedAt, nextMonthUtc(monthStart)),
        eq(categories.kind, 'expense')
      )
    );

  const cashOnHandCents = parseInt(cashRow.cents, 10) || 0;
  const cashAccountCount = parseInt(cashRow.n, 10) || 0;
  const revenueMtdCents = parseInt(revenueRow.cents, 10) || 0;
  const expensesMtdCents = parseInt(expenseRow.cents, 10) || 0;

  return {
    cashOnHandCents,
    cashAccountCount,
    revenueMtdCents,
    expensesMtdCents,
    profitMtdCents: revenueMtdCents - expensesMtdCents,
  };
}

function nextMonthUtc(monthStart: Date): Date {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
}

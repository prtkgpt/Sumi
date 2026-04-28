import 'server-only';
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  getDb,
  transactions,
  categories,
  financialAccounts,
} from '@sumi/db';

export type Period = {
  /** Inclusive start (UTC). */
  from: Date;
  /** Exclusive end (UTC). */
  to: Date;
  label: string;
};

/**
 * Builds a UTC period for the requested year.
 */
export function periodForYear(year: number): Period {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year + 1, 0, 1)),
    label: `${year}`,
  };
}

export function periodForMonth(year: number, monthIndex: number): Period {
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
    label: new Date(Date.UTC(year, monthIndex, 1)).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  };
}

export function periodForQuarter(year: number, quarter: number): Period {
  const monthIndex = (quarter - 1) * 3;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 3, 1)),
    label: `Q${quarter} ${year}`,
  };
}

export function periodYtd(now = new Date()): Period {
  const year = now.getUTCFullYear();
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate() + 1)),
    label: `YTD ${year}`,
  };
}

/**
 * Parses ISO YYYY-MM-DD strings as UTC midnight.
 */
export function parseDateUtc(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export type PnlRow = {
  categoryId: string | null;
  kind: 'income' | 'expense' | 'transfer' | 'owner_draw' | 'personal' | null;
  displayName: string | null;
  scheduleCLine: string | null;
  /** Always positive — outflow stored sign is removed for display. */
  amountCents: number;
};

export type PnlReport = {
  period: Period;
  income: PnlRow[];
  expense: PnlRow[];
  uncategorizedCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netProfitCents: number;
};

/**
 * Computes Profit & Loss for a business across a period. Transfers,
 * owner-draws, and personal-bucket categories are excluded (they don't
 * affect net profit). Uncategorized rows are surfaced separately so users
 * see the work they still owe before the report fully reconciles.
 */
export async function getPnl(
  businessId: string,
  period: Period
): Promise<PnlReport> {
  const db = getDb();

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      kind: categories.kind,
      displayName: categories.displayName,
      scheduleCLine: categories.scheduleCLine,
      cents: sql<string>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.businessId, businessId),
        gte(transactions.postedAt, period.from),
        lt(transactions.postedAt, period.to)
      )
    )
    .groupBy(
      transactions.categoryId,
      categories.kind,
      categories.displayName,
      categories.scheduleCLine
    );

  const income: PnlRow[] = [];
  const expense: PnlRow[] = [];
  let uncategorizedCents = 0;

  for (const r of rows) {
    const cents = parseInt(r.cents, 10) || 0;
    if (r.kind === 'income') {
      income.push({
        categoryId: r.categoryId,
        kind: 'income',
        displayName: r.displayName,
        scheduleCLine: r.scheduleCLine,
        amountCents: cents,
      });
    } else if (r.kind === 'expense') {
      expense.push({
        categoryId: r.categoryId,
        kind: 'expense',
        displayName: r.displayName,
        scheduleCLine: r.scheduleCLine,
        amountCents: -cents, // outflow stored negative; show positive
      });
    } else if (r.kind === null) {
      uncategorizedCents += cents;
    }
    // transfer / owner_draw / personal: excluded from P&L.
  }

  income.sort((a, b) => b.amountCents - a.amountCents);
  expense.sort((a, b) => b.amountCents - a.amountCents);

  const totalIncomeCents = income.reduce((s, r) => s + r.amountCents, 0);
  const totalExpenseCents = expense.reduce((s, r) => s + r.amountCents, 0);

  return {
    period,
    income,
    expense,
    uncategorizedCents,
    totalIncomeCents,
    totalExpenseCents,
    netProfitCents: totalIncomeCents - totalExpenseCents,
  };
}

export type TransactionExportRow = {
  postedAt: Date;
  accountName: string;
  accountMask: string | null;
  merchant: string | null;
  description: string;
  categoryName: string | null;
  scheduleCLine: string | null;
  amountCents: number;
  currency: string;
};

export async function getTransactionsForExport(
  businessId: string,
  period: Period
): Promise<TransactionExportRow[]> {
  const db = getDb();
  return db
    .select({
      postedAt: transactions.postedAt,
      accountName: financialAccounts.name,
      accountMask: financialAccounts.mask,
      merchant: transactions.merchant,
      description: transactions.description,
      categoryName: categories.displayName,
      scheduleCLine: categories.scheduleCLine,
      amountCents: transactions.amountCents,
      currency: transactions.currency,
    })
    .from(transactions)
    .innerJoin(
      financialAccounts,
      eq(financialAccounts.id, transactions.accountId)
    )
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.businessId, businessId),
        gte(transactions.postedAt, period.from),
        lt(transactions.postedAt, period.to)
      )
    )
    .orderBy(asc(transactions.postedAt));
}

import 'server-only';
import type { PnlReport, PnlRow } from './pnl';

/**
 * IRS Schedule C (Form 1040), Part II — expense lines users actually
 * encounter. Order matches the form. We map our category slugs to these
 * lines via the `schedule_c_line` column seeded in v0.2.
 */
const SCHEDULE_C_EXPENSE_LINES: Array<{
  line: string;
  label: string;
}> = [
  { line: 'Line 8', label: 'Advertising' },
  { line: 'Line 9', label: 'Car & truck expenses' },
  { line: 'Line 10', label: 'Commissions & fees' },
  { line: 'Line 11', label: 'Contract labor' },
  { line: 'Line 13', label: 'Depreciation' },
  { line: 'Line 15', label: 'Insurance (other than health)' },
  { line: 'Line 16', label: 'Interest' },
  { line: 'Line 17', label: 'Legal & professional services' },
  { line: 'Line 18', label: 'Office expense' },
  { line: 'Line 20', label: 'Rent or lease' },
  { line: 'Line 21', label: 'Repairs & maintenance' },
  { line: 'Line 22', label: 'Supplies' },
  { line: 'Line 23', label: 'Taxes & licenses' },
  { line: 'Line 24a', label: 'Travel' },
  { line: 'Line 24b', label: 'Meals' },
  { line: 'Line 25', label: 'Utilities' },
  { line: 'Line 26', label: 'Wages' },
  { line: 'Line 27a', label: 'Other expenses' },
];

const INCOME_LINES: Array<{ line: string; label: string }> = [
  { line: 'Line 1', label: 'Gross receipts or sales' },
  { line: 'Line 6', label: 'Other income' },
];

export type ScheduleCLine = {
  line: string;
  label: string;
  amountCents: number;
  rows: PnlRow[];
};

export type ScheduleCReport = {
  income: ScheduleCLine[];
  expenses: ScheduleCLine[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  netProfitCents: number;
  unmappedRows: PnlRow[];
};

function bucket(rows: PnlRow[], lines: typeof INCOME_LINES): {
  buckets: ScheduleCLine[];
  unmapped: PnlRow[];
} {
  const buckets: ScheduleCLine[] = lines.map((l) => ({
    ...l,
    amountCents: 0,
    rows: [],
  }));
  const byLine = new Map(buckets.map((b) => [b.line, b]));
  const unmapped: PnlRow[] = [];

  for (const r of rows) {
    const target = r.scheduleCLine ? byLine.get(r.scheduleCLine) : undefined;
    if (target) {
      target.amountCents += r.amountCents;
      target.rows.push(r);
    } else {
      unmapped.push(r);
    }
  }
  return { buckets, unmapped };
}

export function buildScheduleC(pnl: PnlReport): ScheduleCReport {
  const incomeBucket = bucket(pnl.income, INCOME_LINES);
  const expenseBucket = bucket(pnl.expense, SCHEDULE_C_EXPENSE_LINES);

  const totalIncomeCents = incomeBucket.buckets.reduce(
    (s, b) => s + b.amountCents,
    0
  );
  const totalExpenseCents = expenseBucket.buckets.reduce(
    (s, b) => s + b.amountCents,
    0
  );

  return {
    income: incomeBucket.buckets,
    expenses: expenseBucket.buckets,
    totalIncomeCents,
    totalExpenseCents,
    netProfitCents: totalIncomeCents - totalExpenseCents,
    unmappedRows: [...incomeBucket.unmapped, ...expenseBucket.unmapped],
  };
}

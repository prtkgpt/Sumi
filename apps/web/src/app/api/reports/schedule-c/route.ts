import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireBusiness } from '@/lib/auth/require-business';
import { getPnl, periodForYear } from '@/lib/reports/pnl';
import { buildScheduleC } from '@/lib/reports/schedule-c';
import { csvResponse, toCsv } from '@/lib/reports/csv';

const Query = z.object({
  bizId: z.string().uuid(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    bizId: url.searchParams.get('bizId'),
    year: url.searchParams.get('year') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  }

  const { business } = await requireBusiness(parsed.data.bizId);
  const year = parsed.data.year
    ? Number(parsed.data.year)
    : new Date().getUTCFullYear();
  const period = periodForYear(year);

  const pnl = await getPnl(business.id, period);
  const sched = buildScheduleC(pnl);

  type CsvRow = {
    section: string;
    line: string;
    description: string;
    amount: string;
  };

  const rows: CsvRow[] = [];
  for (const r of sched.income) {
    rows.push({
      section: 'Income',
      line: r.line,
      description: r.label,
      amount: (r.amountCents / 100).toFixed(2),
    });
  }
  rows.push({
    section: 'Income',
    line: '',
    description: 'Total income',
    amount: (sched.totalIncomeCents / 100).toFixed(2),
  });
  for (const r of sched.expenses) {
    rows.push({
      section: 'Expenses',
      line: r.line,
      description: r.label,
      amount: (r.amountCents / 100).toFixed(2),
    });
  }
  rows.push({
    section: 'Expenses',
    line: '',
    description: 'Total expenses',
    amount: (sched.totalExpenseCents / 100).toFixed(2),
  });
  rows.push({
    section: 'Summary',
    line: 'Line 31',
    description: 'Net profit (loss)',
    amount: (sched.netProfitCents / 100).toFixed(2),
  });

  const body = toCsv(rows as unknown as Array<Record<string, unknown>>, [
    'section',
    'line',
    'description',
    'amount',
  ]);
  return csvResponse(`schedule_c_${year}.csv`, body);
}

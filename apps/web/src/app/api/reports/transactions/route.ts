import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireBusiness } from '@/lib/auth/require-business';
import {
  getTransactionsForExport,
  parseDateUtc,
  periodYtd,
} from '@/lib/reports/pnl';
import { csvResponse, toCsv } from '@/lib/reports/csv';

const Query = z.object({
  bizId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    bizId: url.searchParams.get('bizId'),
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  }

  const { business } = await requireBusiness(parsed.data.bizId);

  const fromUtc = parseDateUtc(parsed.data.from);
  const toUtc = parseDateUtc(parsed.data.to);
  const period = fromUtc && toUtc
    ? { from: fromUtc, to: toUtc, label: '' }
    : periodYtd();

  const rows = await getTransactionsForExport(business.id, period);

  const body = toCsv(
    rows.map((r) => ({
      date: r.postedAt.toISOString().slice(0, 10),
      account: r.accountMask
        ? `${r.accountName} ··${r.accountMask}`
        : r.accountName,
      merchant: r.merchant ?? '',
      description: r.description,
      category: r.categoryName ?? '',
      schedule_c_line: r.scheduleCLine ?? '',
      // Stored cents are negative for outflow; export as signed dollars.
      amount: (r.amountCents / 100).toFixed(2),
      currency: r.currency,
    })),
    [
      'date',
      'account',
      'merchant',
      'description',
      'category',
      'schedule_c_line',
      'amount',
      'currency',
    ]
  );

  const fname = `transactions_${period.from.toISOString().slice(0, 10)}_${period.to.toISOString().slice(0, 10)}.csv`;
  return csvResponse(fname, body);
}

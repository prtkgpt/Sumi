import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireBusiness } from '@/lib/auth/require-business';
import {
  getPnl,
  parseDateUtc,
  periodForMonth,
  periodForQuarter,
  periodForYear,
  periodYtd,
  type Period,
} from '@/lib/reports/pnl';
import { buildScheduleC } from '@/lib/reports/schedule-c';
import { cn } from '@/lib/utils';

type PresetKey =
  | 'this_month'
  | 'this_quarter'
  | 'ytd'
  | 'last_year'
  | 'custom';

function formatUsd(cents: number, opts?: { signed?: boolean }): string {
  const dollars = cents / 100;
  const formatted = Math.abs(dollars).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
  if (opts?.signed && dollars < 0) return `-${formatted}`;
  return formatted;
}

function formatDateUtc(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function resolvePeriod(
  preset: string | undefined,
  fromIso: string | undefined,
  toIso: string | undefined,
  now = new Date()
): { period: Period; preset: PresetKey } {
  const presetKey: PresetKey =
    preset === 'this_month' ||
    preset === 'this_quarter' ||
    preset === 'ytd' ||
    preset === 'last_year' ||
    preset === 'custom'
      ? preset
      : 'ytd';

  if (presetKey === 'custom') {
    const from = parseDateUtc(fromIso) ?? new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const to = parseDateUtc(toIso) ?? new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    // Make `to` exclusive by adding 1 day if user picked a single day.
    const toExclusive =
      to.getTime() === from.getTime()
        ? new Date(to.getTime() + 24 * 60 * 60 * 1000)
        : to;
    return {
      preset: 'custom',
      period: {
        from,
        to: toExclusive,
        label: `${formatDateUtc(from)} – ${formatDateUtc(new Date(toExclusive.getTime() - 86_400_000))}`,
      },
    };
  }

  if (presetKey === 'this_month') {
    return {
      preset: 'this_month',
      period: periodForMonth(now.getUTCFullYear(), now.getUTCMonth()),
    };
  }
  if (presetKey === 'this_quarter') {
    const q = Math.floor(now.getUTCMonth() / 3) + 1;
    return {
      preset: 'this_quarter',
      period: periodForQuarter(now.getUTCFullYear(), q),
    };
  }
  if (presetKey === 'last_year') {
    return {
      preset: 'last_year',
      period: periodForYear(now.getUTCFullYear() - 1),
    };
  }
  return { preset: 'ytd', period: periodYtd(now) };
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'last_year', label: 'Last year' },
];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ bizId: string }>;
  searchParams: Promise<{
    preset?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { bizId } = await params;
  const { preset, from, to } = await searchParams;
  const { business } = await requireBusiness(bizId);

  const { period, preset: activePreset } = resolvePeriod(preset, from, to);

  const pnl = await getPnl(business.id, period);
  const sched = buildScheduleC(pnl);

  const yearForCsv = period.from.getUTCFullYear();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            P&amp;L and Schedule C summary for {period.label}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/reports/transactions?from=${period.from.toISOString().slice(0, 10)}&to=${period.to.toISOString().slice(0, 10)}&bizId=${business.id}`}
            >
              <Download className="size-4" />
              Transactions CSV
            </a>
          </Button>
          <Button asChild size="sm">
            <a
              href={`/api/reports/schedule-c?year=${yearForCsv}&bizId=${business.id}`}
            >
              <Download className="size-4" />
              Schedule C CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            asChild
            key={p.key}
            size="sm"
            variant={activePreset === p.key ? 'secondary' : 'ghost'}
          >
            <Link
              href={`/${business.id}/reports?preset=${p.key}`}
              prefetch={false}
            >
              {p.label}
            </Link>
          </Button>
        ))}
      </div>

      <SummaryRow pnl={pnl} sched={sched} />

      {pnl.uncategorizedCents !== 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <span className="font-medium">
                {formatUsd(Math.abs(pnl.uncategorizedCents))}{' '}
              </span>
              of activity in this period is uncategorized and not counted in
              the totals.
            </div>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/${business.id}/transactions?filter=uncategorized`}
              >
                Review
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Profit &amp; loss</h2>
        <Card>
          <CardContent className="py-6">
            <PnlTable
              title="Income"
              rows={pnl.income.map((r) => ({
                name: r.displayName ?? '—',
                amountCents: r.amountCents,
              }))}
              totalCents={pnl.totalIncomeCents}
              tone="positive"
            />
            <Separator className="my-6" />
            <PnlTable
              title="Expenses"
              rows={pnl.expense.map((r) => ({
                name: r.displayName ?? '—',
                amountCents: r.amountCents,
              }))}
              totalCents={pnl.totalExpenseCents}
              tone="default"
            />
            <Separator className="my-6" />
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Net profit
              </p>
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  pnl.netProfitCents >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {formatUsd(pnl.netProfitCents, { signed: true })}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Schedule C summary
        </h2>
        <p className="text-sm text-muted-foreground">
          Lines map to IRS Form 1040 Schedule C, Part II. Hand this to your CPA
          or import the CSV into TurboTax.
        </p>
        <Card>
          <CardContent className="py-6">
            <SchedTable
              title="Income"
              rows={sched.income.filter((b) => b.amountCents !== 0)}
              totalCents={sched.totalIncomeCents}
            />
            <Separator className="my-6" />
            <SchedTable
              title="Expenses"
              rows={sched.expenses.filter((b) => b.amountCents !== 0)}
              totalCents={sched.totalExpenseCents}
            />
            <Separator className="my-6" />
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Net profit (Line 31)
              </p>
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  sched.netProfitCents >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {formatUsd(sched.netProfitCents, { signed: true })}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryRow({
  pnl,
}: {
  pnl: { totalIncomeCents: number; totalExpenseCents: number; netProfitCents: number };
  sched: unknown;
}) {
  const tiles = [
    {
      label: 'Income',
      value: formatUsd(pnl.totalIncomeCents),
      tone: 'positive' as const,
    },
    {
      label: 'Expenses',
      value: formatUsd(pnl.totalExpenseCents),
      tone: 'default' as const,
    },
    {
      label: 'Net profit',
      value: formatUsd(pnl.netProfitCents, { signed: true }),
      tone: pnl.netProfitCents >= 0 ? ('positive' as const) : ('negative' as const),
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="space-y-1 py-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.label}
            </p>
            <p
              className={cn(
                'text-2xl font-semibold tabular-nums tracking-tight',
                t.tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
                t.tone === 'negative' && 'text-rose-600 dark:text-rose-400'
              )}
            >
              {t.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PnlTable({
  title,
  rows,
  totalCents,
  tone,
}: {
  title: string;
  rows: Array<{ name: string; amountCents: number }>;
  totalCents: number;
  tone: 'positive' | 'default';
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <p
          className={cn(
            'text-base font-semibold tabular-nums',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {formatUsd(totalCents)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} in this period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right w-32">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatUsd(r.amountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SchedTable({
  title,
  rows,
  totalCents,
}: {
  title: string;
  rows: Array<{ line: string; label: string; amountCents: number }>;
  totalCents: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <p className="text-base font-semibold tabular-nums">
          {formatUsd(totalCents)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No mapped {title.toLowerCase()} in this period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Line</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-32">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.line}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.line}
                </TableCell>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatUsd(r.amountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

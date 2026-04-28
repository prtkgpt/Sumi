import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/dashboard/kpi-tile';
import { requireBusiness } from '@/lib/auth/require-business';
import { getDashboardKpis } from '@/lib/dashboard/kpis';

function firstName(displayName: string | null, email: string): string {
  if (displayName && displayName.trim()) return displayName.split(/\s+/)[0];
  return email.split('@')[0];
}

function formatUsd(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const MONTH_LABEL = new Date().toLocaleString('en-US', { month: 'long' });

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { user, business } = await requireBusiness(bizId);
  const name = firstName(user.displayName, user.email);
  const kpis = await getDashboardKpis(business.id);

  const cashCaption =
    kpis.cashAccountCount === 0
      ? 'Connect a bank to populate'
      : kpis.cashAccountCount === 1
        ? '1 account'
        : `${kpis.cashAccountCount} accounts`;

  const profitTone =
    kpis.profitMtdCents > 0
      ? 'positive'
      : kpis.profitMtdCents < 0
        ? 'negative'
        : 'default';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome, {name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Here&apos;s where {business.legalName} stands this month.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${business.id}/transactions`}>
            Review transactions
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          label="Cash on hand"
          value={formatUsd(kpis.cashOnHandCents)}
          caption={cashCaption}
        />
        <KpiTile
          label={`Revenue ${MONTH_LABEL}`}
          value={formatUsd(kpis.revenueMtdCents)}
          caption="Categorized income"
          tone={kpis.revenueMtdCents > 0 ? 'positive' : 'default'}
        />
        <KpiTile
          label={`Expenses ${MONTH_LABEL}`}
          value={formatUsd(kpis.expensesMtdCents)}
          caption="Categorized spend"
        />
        <KpiTile
          label={`Profit ${MONTH_LABEL}`}
          value={formatUsd(kpis.profitMtdCents)}
          caption="Revenue − expenses"
          tone={profitTone}
        />
        <KpiTile
          label="Unpaid invoices"
          value={formatUsd(kpis.unpaidInvoiceCents)}
          caption={
            kpis.unpaidInvoiceCount === 0
              ? 'All clear'
              : kpis.unpaidInvoiceCount === 1
                ? '1 invoice outstanding'
                : `${kpis.unpaidInvoiceCount} invoices outstanding`
          }
          tone={kpis.unpaidInvoiceCount > 0 ? 'default' : 'muted'}
        />
      </div>
    </div>
  );
}

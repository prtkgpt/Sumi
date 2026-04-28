import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { getDb, invoices, customers } from '@sumi/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireBusiness } from '@/lib/auth/require-business';
import { cn } from '@/lib/utils';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  void: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
};

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      status: invoices.status,
      totalCents: invoices.totalCents,
      paidAmountCents: invoices.paidAmountCents,
      customerName: customers.name,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(eq(invoices.businessId, business.id))
    .orderBy(desc(invoices.createdAt));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bill customers, track who&apos;s paid.
          </p>
        </div>
        <Button asChild>
          <Link href={`/${business.id}/invoices/new`}>
            <Plus className="size-4" />
            New invoice
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <h2 className="text-xl font-semibold tracking-tight">
              No invoices yet
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Send your first invoice in under a minute. Add a customer, add a
              line item, copy the pay link.
            </p>
            <Button asChild className="mt-2">
              <Link href={`/${business.id}/invoices/new`}>New invoice</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/${business.id}/invoices/${r.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      #{r.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.issuedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.dueAt)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        STATUS_STYLES[r.status] ?? STATUS_STYLES.draft
                      )}
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatUsd(r.totalCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

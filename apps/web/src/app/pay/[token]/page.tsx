import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { CheckCircle2 } from 'lucide-react';
import {
  getDb,
  invoices,
  invoiceLineItems,
  customers,
  businesses,
} from '@sumi/db';
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
import { PayButton } from './pay-button';

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

export default async function PublicPayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [inv] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      totalCents: invoices.totalCents,
      paidAt: invoices.paidAt,
      currency: invoices.currency,
      notes: invoices.notes,
      publicToken: invoices.publicToken,
      customerName: customers.name,
      businessName: businesses.legalName,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .innerJoin(businesses, eq(businesses.id, invoices.businessId))
    .where(eq(invoices.publicToken, token))
    .limit(1);
  if (!inv || inv.status === 'draft') notFound();

  const lines = await db
    .select({
      id: invoiceLineItems.id,
      description: invoiceLineItems.description,
      quantity: invoiceLineItems.quantity,
      unitPriceCents: invoiceLineItems.unitPriceCents,
      amountCents: invoiceLineItems.amountCents,
    })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, inv.id))
    .orderBy(asc(invoiceLineItems.position));

  const isPaid = inv.status === 'paid';
  const isVoid = inv.status === 'void';

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-12">
      <header className="mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Invoice from
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {inv.businessName}
        </h1>
      </header>

      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Invoice
              </p>
              <p className="mt-1 text-lg font-semibold">
                #{inv.invoiceNumber}
              </p>
              <p className="text-sm text-muted-foreground">
                Billed to {inv.customerName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Amount due
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {isPaid ? formatUsd(0) : formatUsd(inv.totalCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPaid
                  ? `Paid ${inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-US') : ''}`
                  : `Due ${formatDate(inv.dueAt)}`}
              </p>
            </div>
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-20">Qty</TableHead>
                <TableHead className="text-right w-28">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {l.quantity}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatUsd(l.amountCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {formatUsd(inv.totalCents)}
            </span>
          </div>

          {inv.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{inv.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        {isPaid ? (
          <Card className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium">Payment received</p>
                <p className="text-sm text-muted-foreground">
                  Thanks — this invoice is settled.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isVoid ? (
          <Card className="border-rose-300 bg-rose-50 dark:bg-rose-950/20">
            <CardContent className="py-4">
              <p className="text-sm">This invoice has been voided.</p>
            </CardContent>
          </Card>
        ) : (
          <PayButton token={inv.publicToken} amountCents={inv.totalCents} />
        )}
      </div>

      <footer className="mt-auto pt-12 text-center text-xs text-muted-foreground">
        Powered by Sumi
      </footer>
    </div>
  );
}

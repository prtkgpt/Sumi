import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import {
  getDb,
  invoices,
  invoiceLineItems,
  customers,
} from '@sumi/db';
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
import { env } from '@/env';
import { cn } from '@/lib/utils';
import { sendInvoice, markInvoicePaid, voidInvoice } from '../actions';
import { CopyPayLinkButton } from './copy-pay-link-button';

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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ bizId: string; invoiceId: string }>;
}) {
  const { bizId, invoiceId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const [inv] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      totalCents: invoices.totalCents,
      paidAmountCents: invoices.paidAmountCents,
      paidAt: invoices.paidAt,
      publicToken: invoices.publicToken,
      notes: invoices.notes,
      customerName: customers.name,
      customerEmail: customers.email,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.businessId, business.id))
    )
    .limit(1);
  if (!inv) notFound();

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

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const payUrl = `${appUrl}/pay/${inv.publicToken}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Invoice #{inv.invoiceNumber}
            </h1>
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft
              )}
            >
              {inv.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            For {inv.customerName}
            {inv.customerEmail ? ` · ${inv.customerEmail}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inv.status === 'draft' && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${business.id}/invoices/${inv.id}/edit`}>Edit</Link>
            </Button>
          )}
          {inv.status === 'draft' && (
            <form action={sendInvoice}>
              <input type="hidden" name="bizId" value={business.id} />
              <input type="hidden" name="invoiceId" value={inv.id} />
              <Button type="submit" size="sm">
                Send invoice
              </Button>
            </form>
          )}
          {inv.status === 'sent' && (
            <CopyPayLinkButton url={payUrl} />
          )}
          {(inv.status === 'sent' || inv.status === 'draft') && (
            <form action={markInvoicePaid}>
              <input type="hidden" name="bizId" value={business.id} />
              <input type="hidden" name="invoiceId" value={inv.id} />
              <Button type="submit" variant="outline" size="sm">
                Mark paid
              </Button>
            </form>
          )}
          {(inv.status === 'sent' || inv.status === 'draft') && (
            <form action={voidInvoice}>
              <input type="hidden" name="bizId" value={business.id} />
              <input type="hidden" name="invoiceId" value={inv.id} />
              <Button type="submit" variant="ghost" size="sm">
                Void
              </Button>
            </form>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-6 py-6">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Issue date
              </p>
              <p className="mt-1">{formatDate(inv.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Due date
              </p>
              <p className="mt-1">{formatDate(inv.dueAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatUsd(inv.totalCents)}
              </p>
            </div>
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-20">Qty</TableHead>
                <TableHead className="text-right w-28">Unit</TableHead>
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
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatUsd(l.unitPriceCents)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatUsd(l.amountCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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

      {inv.status === 'sent' && (
        <Card className="mt-4">
          <CardContent className="space-y-2 py-4 text-sm">
            <p className="font-medium">Public pay link</p>
            <p className="break-all text-muted-foreground">{payUrl}</p>
            <p className="text-xs text-muted-foreground">
              Share this link with the customer to collect payment.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

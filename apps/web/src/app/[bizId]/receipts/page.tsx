import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { ExternalLink, Trash2 } from 'lucide-react';
import { getDb, receipts, transactions } from '@sumi/db';
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
import { isBlobConfigured } from '@/lib/blob';
import { UploadZone } from './upload-zone';
import { MatchPicker, type CandidateTransaction } from './match-picker';
import { deleteReceipt } from './actions';

function formatUsd(cents: number | null): string {
  if (cents === null) return '—';
  return (Math.abs(cents) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-muted text-muted-foreground',
  extracted: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  matched: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  unmatched: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Processing',
  extracted: 'Extracted',
  matched: 'Matched',
  unmatched: 'Needs match',
  failed: 'Failed',
};

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const rows = await db
    .select({
      id: receipts.id,
      fileUrl: receipts.fileUrl,
      fileName: receipts.fileName,
      kind: receipts.kind,
      status: receipts.status,
      ocrMerchant: receipts.ocrMerchant,
      ocrPostedAt: receipts.ocrPostedAt,
      ocrAmountCents: receipts.ocrAmountCents,
      transactionId: receipts.transactionId,
      transactionDescription: transactions.description,
      transactionAmountCents: transactions.amountCents,
      createdAt: receipts.createdAt,
    })
    .from(receipts)
    .leftJoin(transactions, eq(transactions.id, receipts.transactionId))
    .where(eq(receipts.businessId, business.id))
    .orderBy(desc(receipts.createdAt));

  // Pull a candidate list once for the MatchPicker dropdowns.
  const candidateRows = await db
    .select({
      id: transactions.id,
      postedAt: transactions.postedAt,
      description: transactions.description,
      merchant: transactions.merchant,
      amountCents: transactions.amountCents,
    })
    .from(transactions)
    .where(eq(transactions.businessId, business.id))
    .orderBy(desc(transactions.postedAt))
    .limit(200);
  const candidates: CandidateTransaction[] = candidateRows.map((t) => ({
    id: t.id,
    postedAt: t.postedAt.toISOString(),
    description: t.description,
    merchant: t.merchant,
    amountCents: t.amountCents,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a photo or PDF of a receipt — Sumi reads the merchant, date,
          and amount and tries to match it to a transaction.
        </p>
      </div>

      {!isBlobConfigured() && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 text-sm">
            Receipt uploads aren&apos;t enabled on this deployment. Add a{' '}
            <strong>Vercel Blob</strong> store to the project so{' '}
            <code>BLOB_READ_WRITE_TOKEN</code> is set.
          </CardContent>
        </Card>
      )}

      {isBlobConfigured() && <UploadZone bizId={business.id} />}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No receipts yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload your first receipt above. JPG, PNG, WebP, GIF, or PDF.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Receipt</TableHead>
                <TableHead>Merchant / OCR</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-right w-28">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.kind === 'image' ? (
                      <a href={r.fileUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.fileUrl}
                          alt={r.fileName ?? 'Receipt'}
                          className="size-12 rounded-md border object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-12 items-center justify-center rounded-md border bg-muted text-xs font-medium"
                      >
                        PDF
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {r.ocrMerchant ?? r.fileName ?? '(unknown)'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.ocrPostedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[r.status] ?? STATUS_STYLES.uploaded
                      )}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <MatchPicker
                      bizId={business.id}
                      receiptId={r.id}
                      currentTransactionId={r.transactionId}
                      candidates={candidates}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatUsd(r.ocrAmountCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon" aria-label="Open receipt">
                        <a href={r.fileUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                      <form action={deleteReceipt}>
                        <input type="hidden" name="bizId" value={business.id} />
                        <input type="hidden" name="receiptId" value={r.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete receipt"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Need to find a receipt&apos;s matched transaction? Click the row in{' '}
        <Link
          href={`/${business.id}/transactions`}
          className="underline underline-offset-2"
        >
          Transactions
        </Link>
        .
      </p>
    </div>
  );
}

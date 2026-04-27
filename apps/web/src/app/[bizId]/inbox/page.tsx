import Link from 'next/link';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import {
  getDb,
  transactions,
  financialAccounts,
  categories,
} from '@sumi/db';
import { Plus, Sparkles } from 'lucide-react';
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
import { ensureCategorySeed } from '@/lib/categories';
import { ConnectBankButton } from './connect-bank-button';
import { CategoryPicker } from './category-picker';

const PAGE_SIZE = 100;

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ bizId: string }>;
  searchParams: Promise<{ filter?: string; need?: string }>;
}) {
  const { bizId } = await params;
  const { filter, need } = await searchParams;
  const { business } = await requireBusiness(bizId);

  const db = getDb();
  await ensureCategorySeed(business.id);

  const onlyUncategorized = filter === 'uncategorized';

  const [accountCount, allCategories, rows] = await Promise.all([
    db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(eq(financialAccounts.businessId, business.id)),
    db
      .select({
        id: categories.id,
        kind: categories.kind,
        displayName: categories.displayName,
      })
      .from(categories)
      .where(eq(categories.businessId, business.id))
      .orderBy(asc(categories.kind), asc(categories.displayName)),
    db
      .select({
        id: transactions.id,
        postedAt: transactions.postedAt,
        amountCents: transactions.amountCents,
        currency: transactions.currency,
        merchant: transactions.merchant,
        description: transactions.description,
        source: transactions.source,
        categoryId: transactions.categoryId,
        categorySource: transactions.categorySource,
        categoryName: categories.displayName,
        accountName: financialAccounts.name,
        accountMask: financialAccounts.mask,
      })
      .from(transactions)
      .innerJoin(
        financialAccounts,
        eq(financialAccounts.id, transactions.accountId)
      )
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        onlyUncategorized
          ? and(
              eq(transactions.businessId, business.id),
              isNull(transactions.categoryId)
            )
          : eq(transactions.businessId, business.id)
      )
      .orderBy(desc(transactions.postedAt))
      .limit(PAGE_SIZE),
  ]);

  const hasAccounts = accountCount.length > 0;
  const hasTransactions = rows.length > 0;
  const showAccountWarning = need === 'account' && !hasAccounts;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and categorize your transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectBankButton bizId={business.id} />
          {hasAccounts && (
            <Button asChild variant="outline">
              <Link href={`/${business.id}/transactions/new`}>
                <Plus className="size-4" />
                Add transaction
              </Link>
            </Button>
          )}
        </div>
      </div>

      {showAccountWarning && (
        <Card className="mt-6 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-4 text-sm">
            Add an account first by connecting a bank.
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button asChild variant={onlyUncategorized ? 'ghost' : 'secondary'} size="sm">
          <Link href={`/${business.id}/inbox`}>All</Link>
        </Button>
        <Button
          asChild
          variant={onlyUncategorized ? 'secondary' : 'ghost'}
          size="sm"
        >
          <Link href={`/${business.id}/inbox?filter=uncategorized`}>
            Needs review
          </Link>
        </Button>
      </div>

      {!hasTransactions ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <h2 className="text-xl font-semibold tracking-tight">
              No transactions yet
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Connect a bank account to import transactions automatically, or
              add one by hand.
            </p>
            <div className="mt-4 flex gap-2">
              <ConnectBankButton bizId={business.id} />
              <Button asChild variant="outline">
                <Link href={`/${business.id}/transactions/new`}>
                  Add transaction
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="w-48">Category</TableHead>
                <TableHead className="text-right w-32">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.postedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {r.merchant ?? r.description}
                    </div>
                    {r.merchant && r.merchant !== r.description && (
                      <div className="text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.accountName}
                    {r.accountMask ? ` ··${r.accountMask}` : ''}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CategoryPicker
                        bizId={business.id}
                        transactionId={r.id}
                        currentCategoryId={r.categoryId}
                        categories={allCategories}
                      />
                      {r.categorySource === 'llm' && (
                        <span
                          title="Auto-categorized by Claude"
                          className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                        >
                          <Sparkles className="size-3" />
                          AI
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      r.amountCents >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : ''
                    }`}
                  >
                    {formatAmount(r.amountCents, r.currency)}
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

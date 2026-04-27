import { redirect } from 'next/navigation';
import { eq, asc } from 'drizzle-orm';
import { getDb, financialAccounts, categories } from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';
import { ensureCategorySeed } from '@/lib/categories';
import { TransactionForm } from './transaction-form';

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);

  const db = getDb();
  await ensureCategorySeed(business.id);

  const [accounts, cats] = await Promise.all([
    db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        mask: financialAccounts.mask,
        institutionName: financialAccounts.institutionName,
        kind: financialAccounts.kind,
      })
      .from(financialAccounts)
      .where(eq(financialAccounts.businessId, business.id))
      .orderBy(asc(financialAccounts.name)),
    db
      .select({
        id: categories.id,
        kind: categories.kind,
        displayName: categories.displayName,
      })
      .from(categories)
      .where(eq(categories.businessId, business.id))
      .orderBy(asc(categories.kind), asc(categories.displayName)),
  ]);

  if (accounts.length === 0) {
    // Manual entry needs at least one account. Send the user to the inbox
    // where the empty state offers Connect-bank or Add-account flows. (For
    // v0.2 we'll auto-create a "Cash" manual_cash account on demand from
    // the inbox if none exists; that path lives in the Inbox component.)
    redirect(`/${business.id}/inbox?need=account`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Add transaction</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manual entries appear in the inbox alongside imported transactions.
      </p>
      <div className="mt-8">
        <TransactionForm
          bizId={business.id}
          accounts={accounts}
          categories={cats}
        />
      </div>
    </div>
  );
}

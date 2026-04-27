import 'server-only';
import { and, eq } from 'drizzle-orm';
import {
  getDb,
  plaidItems,
  financialAccounts,
  transactions,
  type PlaidItem,
} from '@sumi/db';
import {
  type Transaction as PlaidTransaction,
  type RemovedTransaction,
} from 'plaid';
import { getPlaidClient } from './client';
import { decryptString } from '@/lib/crypto';
import { autoCategorizeBusiness } from '@/lib/categorization/categorize';

type SyncResult = {
  added: number;
  modified: number;
  removed: number;
};

/**
 * Pull transactions for a single Plaid item, page through `/transactions/sync`
 * until `has_more` is false, and persist the cursor. Plaid recommends running
 * this whenever you receive a SYNC_UPDATES_AVAILABLE webhook, on initial item
 * link, and at most a few times per minute.
 */
export async function syncItem(itemRowId: string): Promise<SyncResult> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.id, itemRowId))
    .limit(1);
  if (!item) {
    throw new Error(`plaid_items row ${itemRowId} not found`);
  }
  if (item.status !== 'active') {
    return { added: 0, modified: 0, removed: 0 };
  }

  const accessToken = decryptString(item.accessTokenEncrypted);
  const plaid = getPlaidClient();

  let cursor = item.cursor ?? undefined;
  let added: PlaidTransaction[] = [];
  let modified: PlaidTransaction[] = [];
  let removed: RemovedTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const resp = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });
    added = added.concat(resp.data.added);
    modified = modified.concat(resp.data.modified);
    removed = removed.concat(resp.data.removed);
    hasMore = resp.data.has_more;
    cursor = resp.data.next_cursor;
  }

  await applyChanges(item, added, modified, removed, cursor ?? null);

  // Refresh account balances. Cheap (one /accounts/get round-trip) and
  // ensures the dashboard's cash-on-hand tile stays current. Errors are
  // logged but don't undo the sync — balances will refresh next time.
  try {
    await refreshBalances(item, accessToken);
  } catch (err) {
    console.error('refreshBalances failed', {
      itemId: item.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Always run categorization. The orchestrator only acts on uncategorized
  // rows and is bounded per call, so re-running on a sync that produced no
  // new Plaid rows still picks up any previously-skipped transactions
  // (e.g. ones imported before ANTHROPIC_API_KEY was set, or before v0.3).
  try {
    const result = await autoCategorizeBusiness(item.businessId);
    if (result.scanned > 0) {
      console.log('autoCategorize', {
        businessId: item.businessId,
        ...result,
      });
    }
  } catch (err) {
    console.error('autoCategorizeBusiness failed', {
      businessId: item.businessId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };
}

async function applyChanges(
  item: PlaidItem,
  added: PlaidTransaction[],
  modified: PlaidTransaction[],
  removed: RemovedTransaction[],
  newCursor: string | null
): Promise<void> {
  const db = getDb();

  // Build a lookup from Plaid account id → our financial_accounts.id once.
  const accounts = await db
    .select({ id: financialAccounts.id, plaidAccountId: financialAccounts.plaidAccountId })
    .from(financialAccounts)
    .where(eq(financialAccounts.businessId, item.businessId));
  const accountIdByPlaidId = new Map<string, string>();
  for (const a of accounts) {
    if (a.plaidAccountId) accountIdByPlaidId.set(a.plaidAccountId, a.id);
  }

  await db.transaction(async (tx) => {
    for (const t of added) {
      const accountId = accountIdByPlaidId.get(t.account_id);
      if (!accountId) continue; // account not linked yet (shouldn't happen post-exchange)
      await tx
        .insert(transactions)
        .values({
          businessId: item.businessId,
          accountId,
          postedAt: postedAtFor(t),
          // Plaid: positive = outflow (debit). Sumi: negative = outflow.
          amountCents: -Math.round(t.amount * 100),
          currency: t.iso_currency_code ?? 'USD',
          merchant: t.merchant_name ?? null,
          description: t.name,
          source: 'plaid',
          plaidTransactionId: t.transaction_id,
          status: t.pending ? 'pending' : 'posted',
        })
        .onConflictDoNothing({ target: transactions.plaidTransactionId });
    }

    for (const t of modified) {
      await tx
        .update(transactions)
        .set({
          postedAt: postedAtFor(t),
          amountCents: -Math.round(t.amount * 100),
          currency: t.iso_currency_code ?? 'USD',
          merchant: t.merchant_name ?? null,
          description: t.name,
          status: t.pending ? 'pending' : 'posted',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactions.plaidTransactionId, t.transaction_id),
            eq(transactions.businessId, item.businessId)
          )
        );
    }

    for (const r of removed) {
      if (!r.transaction_id) continue;
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.plaidTransactionId, r.transaction_id),
            eq(transactions.businessId, item.businessId)
          )
        );
    }

    await tx
      .update(plaidItems)
      .set({ cursor: newCursor, lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(plaidItems.id, item.id));
  });
}

function postedAtFor(t: PlaidTransaction): Date {
  // `authorized_date` reflects when the cardholder authorized; `date` is the
  // settlement date. Prefer authorized_date when present so pending charges
  // appear at the time they were made.
  const iso = t.authorized_date ?? t.date;
  return new Date(iso);
}

async function refreshBalances(
  item: PlaidItem,
  accessToken: string
): Promise<void> {
  const plaid = getPlaidClient();
  const resp = await plaid.accountsGet({ access_token: accessToken });

  const db = getDb();
  const now = new Date();
  for (const a of resp.data.accounts) {
    await db
      .update(financialAccounts)
      .set({
        currentBalanceCents:
          a.balances.current === null || a.balances.current === undefined
            ? null
            : Math.round(a.balances.current * 100),
        availableBalanceCents:
          a.balances.available === null || a.balances.available === undefined
            ? null
            : Math.round(a.balances.available * 100),
        lastBalanceAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(financialAccounts.plaidItemId, item.id),
          eq(financialAccounts.plaidAccountId, a.account_id)
        )
      );
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  getDb,
  plaidItems,
  financialAccounts,
  type NewFinancialAccount,
} from '@sumi/db';
import { getPlaidClient } from '@/lib/plaid/client';
import { requireBusiness } from '@/lib/auth/require-business';
import { encryptString } from '@/lib/crypto';
import { syncItem } from '@/lib/plaid/sync';
import { ensureCategorySeed } from '@/lib/categories';

const Body = z.object({
  bizId: z.string().uuid(),
  public_token: z.string().min(1),
  institution: z
    .object({
      institution_id: z.string().nullish(),
      name: z.string().nullish(),
    })
    .optional(),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { business } = await requireBusiness(parsed.bizId);
  const plaid = getPlaidClient();

  const exch = await plaid.itemPublicTokenExchange({
    public_token: parsed.public_token,
  });
  const accessToken = exch.data.access_token;
  const itemId = exch.data.item_id;

  const accountsResp = await plaid.accountsGet({ access_token: accessToken });

  const db = getDb();
  await ensureCategorySeed(business.id);

  const itemRowId = await db.transaction(async (tx) => {
    const [itemRow] = await tx
      .insert(plaidItems)
      .values({
        businessId: business.id,
        plaidItemId: itemId,
        accessTokenEncrypted: encryptString(accessToken),
        institutionId: parsed.institution?.institution_id ?? null,
        institutionName: parsed.institution?.name ?? null,
        status: 'active',
      })
      .returning({ id: plaidItems.id });

    const accountRows: NewFinancialAccount[] = accountsResp.data.accounts.map(
      (a) => ({
        businessId: business.id,
        plaidItemId: itemRow.id,
        plaidAccountId: a.account_id,
        kind: mapKind(a.subtype, a.type),
        name: a.name,
        mask: a.mask,
        institutionName: parsed.institution?.name ?? null,
      })
    );
    if (accountRows.length > 0) {
      await tx.insert(financialAccounts).values(accountRows);
    }

    return itemRow.id;
  });

  // Initial pull. Sync errors here don't undo the link — surface them but
  // keep the item active so the next webhook can recover.
  try {
    await syncItem(itemRowId);
  } catch (err) {
    console.error('initial syncItem failed', { itemRowId, err });
    await db
      .update(plaidItems)
      .set({ status: 'error', updatedAt: new Date() })
      .where(eq(plaidItems.id, itemRowId));
  }

  return NextResponse.json({ ok: true });
}

function mapKind(
  subtype: string | null | undefined,
  type: string
): 'bank_checking' | 'bank_savings' | 'credit_card' | 'manual_cash' {
  if (type === 'credit') return 'credit_card';
  if (subtype === 'savings') return 'bank_savings';
  if (subtype === 'checking') return 'bank_checking';
  // Default unclassified depository accounts to checking; manual_cash is
  // reserved for user-created accounts.
  return 'bank_checking';
}

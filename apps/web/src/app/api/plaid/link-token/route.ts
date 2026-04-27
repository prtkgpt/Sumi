import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CountryCode, Products } from 'plaid';
import { getPlaidClient, getWebhookUrl } from '@/lib/plaid/client';
import { requireBusiness } from '@/lib/auth/require-business';

const Body = z.object({
  bizId: z.string().uuid(),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { user } = await requireBusiness(parsed.bizId);

  const plaid = getPlaidClient();
  const resp = await plaid.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: 'Sumi',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: getWebhookUrl(),
  });

  return NextResponse.json({
    link_token: resp.data.link_token,
    expiration: resp.data.expiration,
  });
}

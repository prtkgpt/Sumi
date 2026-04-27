import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, invoices, customers } from '@sumi/db';
import { getStripe } from '@/lib/stripe/client';
import { env } from '@/env';

const Body = z.object({
  token: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const db = getDb();
  const [inv] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      totalCents: invoices.totalCents,
      currency: invoices.currency,
      publicToken: invoices.publicToken,
      customerEmail: customers.email,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(eq(invoices.publicToken, parsed.token))
    .limit(1);

  if (!inv || inv.status !== 'sent') {
    return NextResponse.json(
      { error: 'invoice not payable' },
      { status: 404 }
    );
  }
  if (inv.totalCents <= 0) {
    return NextResponse.json(
      { error: 'invoice has no balance' },
      { status: 400 }
    );
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${appUrl}/pay/${inv.publicToken}/success`,
    cancel_url: `${appUrl}/pay/${inv.publicToken}`,
    customer_email: inv.customerEmail ?? undefined,
    payment_intent_data: {
      description: `Invoice #${inv.invoiceNumber}`,
      metadata: {
        sumi_invoice_id: inv.id,
        sumi_invoice_token: inv.publicToken,
      },
    },
    metadata: {
      sumi_invoice_id: inv.id,
      sumi_invoice_token: inv.publicToken,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: inv.currency.toLowerCase(),
          unit_amount: inv.totalCents,
          product_data: {
            name: `Invoice #${inv.invoiceNumber}`,
          },
        },
      },
    ],
  });

  if (!session.url) {
    return NextResponse.json(
      { error: 'stripe did not return a URL' },
      { status: 500 }
    );
  }

  await db
    .update(invoices)
    .set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() })
    .where(eq(invoices.id, inv.id));

  return NextResponse.json({ url: session.url });
}

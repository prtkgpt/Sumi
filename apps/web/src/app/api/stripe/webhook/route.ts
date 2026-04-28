import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { Stripe as StripeNS } from 'stripe';
import { getDb, invoices, webhookEvents } from '@sumi/db';
import { env } from '@/env';

// Env-based Stripe webhook (single-tenant deployments). Multi-tenant
// installs should use /api/stripe/webhook/[bizId] instead so each
// business's webhook secret can be verified independently.

export async function POST(req: Request) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error:
          'env-based Stripe is not configured. Multi-tenant installs should use /api/stripe/webhook/[bizId].',
      },
      { status: 503 }
    );
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 401 });
  }
  const rawBody = await req.text();

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });

  let event: StripeNS.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid signature' },
      { status: 401 }
    );
  }

  const db = getDb();
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: 'stripe',
      externalEventId: event.id,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  const eventRowId = inserted[0].id;

  try {
    await dispatch(event);
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, eventRowId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe webhook (env) dispatch failed', {
      id: event.id,
      message,
    });
    await db
      .update(webhookEvents)
      .set({ error: message })
      .where(eq(webhookEvents.id, eventRowId));
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function dispatch(event: StripeNS.Event): Promise<void> {
  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object as StripeNS.Checkout.Session;
  const invoiceId = session.metadata?.sumi_invoice_id;
  if (!invoiceId) return;

  const db = getDb();
  const [inv] = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      totalCents: invoices.totalCents,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv || inv.status === 'paid') return;

  const amountPaid = session.amount_total ?? inv.totalCents;
  await db
    .update(invoices)
    .set({
      status: 'paid',
      paidAmountCents: amountPaid,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, inv.id));
}

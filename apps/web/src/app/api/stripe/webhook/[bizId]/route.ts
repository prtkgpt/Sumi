import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getDb, invoices, webhookEvents } from '@sumi/db';
import { getStripeForBusiness } from '@/lib/stripe/client';

// Per-business Stripe webhook. Each business creates a webhook in their
// own Stripe dashboard pointing at this URL with their bizId, and pastes
// the resulting signing secret into Sumi's Settings → API keys page. We
// look up the business's stored secret to verify the signature.

export async function POST(
  req: Request,
  ctx: { params: Promise<{ bizId: string }> }
) {
  const { bizId } = await ctx.params;
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 401 });
  }

  const stripeContext = await getStripeForBusiness(bizId);
  if (!stripeContext || !stripeContext.webhookSecret) {
    return NextResponse.json(
      { error: 'stripe not configured for this business' },
      { status: 503 }
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripeContext.stripe.webhooks.constructEvent(
      rawBody,
      sig,
      stripeContext.webhookSecret
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid signature' },
      { status: 401 }
    );
  }

  const db = getDb();

  // Per-business deliveries: scope the dedup key with bizId so two
  // businesses can theoretically receive the same Stripe event id without
  // colliding (very rare in practice — Stripe event ids are unique per
  // account — but defensive).
  const externalEventId = `${bizId}:${event.id}`;
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: 'stripe',
      externalEventId,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  const eventRowId = inserted[0].id;

  try {
    await dispatch(bizId, event);
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, eventRowId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe webhook dispatch failed', {
      bizId,
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

async function dispatch(bizId: string, event: Stripe.Event): Promise<void> {
  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object as Stripe.Checkout.Session;
  const invoiceId = session.metadata?.sumi_invoice_id;
  if (!invoiceId) return;

  const db = getDb();
  const [inv] = await db
    .select({
      id: invoices.id,
      businessId: invoices.businessId,
      status: invoices.status,
      totalCents: invoices.totalCents,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv || inv.status === 'paid') return;
  if (inv.businessId !== bizId) {
    // Webhook delivered to the wrong business URL. Refuse — defense
    // against someone pointing another business's webhook at this URL.
    throw new Error(
      `webhook bizId mismatch: url=${bizId} invoice.businessId=${inv.businessId}`
    );
  }

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

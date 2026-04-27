import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { jwtVerify, importJWK, decodeProtectedHeader, type JWK } from 'jose';
import { createHash } from 'node:crypto';
import { getDb, plaidItems, webhookEvents } from '@sumi/db';
import { getPlaidClient } from '@/lib/plaid/client';
import { syncItem } from '@/lib/plaid/sync';

// Plaid signs every webhook with a JWT in the `Plaid-Verification` header.
// We verify it against the public key fetched from `/webhook_verification_key/get`,
// then check that the body's SHA-256 matches the JWT's `request_body_sha256` claim.
//
// Reference: https://plaid.com/docs/api/webhooks/webhook-verification/

const keyCache = new Map<string, { jwk: JWK; fetchedAt: number }>();
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

async function getVerificationKey(kid: string): Promise<JWK> {
  const cached = keyCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < KEY_TTL_MS) {
    return cached.jwk;
  }
  const plaid = getPlaidClient();
  const resp = await plaid.webhookVerificationKeyGet({ key_id: kid });
  const jwk = resp.data.key as unknown as JWK;
  keyCache.set(kid, { jwk, fetchedAt: Date.now() });
  return jwk;
}

export async function POST(req: Request) {
  const verification = req.headers.get('plaid-verification');
  const rawBody = await req.text();

  if (!verification) {
    return NextResponse.json({ error: 'missing signature' }, { status: 401 });
  }

  let header: { kid?: string; alg?: string };
  try {
    header = decodeProtectedHeader(verification);
  } catch {
    return NextResponse.json({ error: 'malformed jwt' }, { status: 401 });
  }
  if (!header.kid || header.alg !== 'ES256') {
    return NextResponse.json({ error: 'unsupported jwt' }, { status: 401 });
  }

  const jwk = await getVerificationKey(header.kid);
  const publicKey = await importJWK(jwk, 'ES256');

  let payload: { request_body_sha256?: string; iat?: number };
  try {
    const verified = await jwtVerify(verification, publicKey, {
      algorithms: ['ES256'],
    });
    payload = verified.payload as typeof payload;
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  // Reject anything older than 5 minutes to mitigate replay.
  if (!payload.iat || Date.now() / 1000 - payload.iat > 5 * 60) {
    return NextResponse.json({ error: 'stale signature' }, { status: 401 });
  }

  const expectedHash = createHash('sha256').update(rawBody).digest('hex');
  if (payload.request_body_sha256 !== expectedHash) {
    return NextResponse.json({ error: 'body mismatch' }, { status: 401 });
  }

  // Body is now trusted.
  type PlaidWebhookBody = {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    [key: string]: unknown;
  };
  const body: PlaidWebhookBody = JSON.parse(rawBody);
  const eventId = `${body.webhook_type ?? 'unknown'}:${body.webhook_code ?? 'unknown'}:${body.item_id ?? 'noitem'}:${expectedHash.slice(0, 16)}`;

  const db = getDb();

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: 'plaid',
      externalEventId: eventId,
      payload: body,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  const eventRowId = inserted[0].id;

  try {
    await dispatch(body);
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, eventRowId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('plaid webhook dispatch failed', { eventId, message });
    await db
      .update(webhookEvents)
      .set({ error: message })
      .where(eq(webhookEvents.id, eventRowId));
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function dispatch(body: {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
}): Promise<void> {
  if (
    body.webhook_type === 'TRANSACTIONS' &&
    body.webhook_code === 'SYNC_UPDATES_AVAILABLE' &&
    body.item_id
  ) {
    const db = getDb();
    const [item] = await db
      .select({ id: plaidItems.id })
      .from(plaidItems)
      .where(eq(plaidItems.plaidItemId, body.item_id))
      .limit(1);
    if (!item) return; // unknown item — likely a stale link
    await syncItem(item.id);
    return;
  }

  if (body.webhook_type === 'ITEM' && body.item_id) {
    const status =
      body.webhook_code === 'ITEM_LOGIN_REQUIRED' ||
      body.webhook_code === 'PENDING_EXPIRATION'
        ? 'error'
        : 'active';
    const db = getDb();
    await db
      .update(plaidItems)
      .set({ status, updatedAt: new Date() })
      .where(eq(plaidItems.plaidItemId, body.item_id));
  }
}


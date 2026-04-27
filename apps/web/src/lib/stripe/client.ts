import 'server-only';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb, businesses } from '@sumi/db';
import { env } from '@/env';
import { decryptString } from '@/lib/crypto';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia';

type Cached = { stripe: Stripe; webhookSecret: string | null };

const globalForStripe = globalThis as unknown as {
  __sumiStripeEnv?: Stripe;
  __sumiStripeByBiz?: Map<string, Cached>;
};

function getEnvStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (globalForStripe.__sumiStripeEnv) return globalForStripe.__sumiStripeEnv;
  globalForStripe.__sumiStripeEnv = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
  return globalForStripe.__sumiStripeEnv;
}

/**
 * Returns Stripe credentials for a business. Looks up per-business keys
 * first; falls back to the deployment-wide STRIPE_* env if the business
 * has no keys configured. Returns null when neither is set.
 *
 * `webhookSecret` is also returned because some routes need it (the
 * webhook handler). Per-business webhook secrets are stored in the same
 * row as the secret key.
 */
export async function getStripeForBusiness(
  businessId: string
): Promise<{ stripe: Stripe; webhookSecret: string | null } | null> {
  if (!globalForStripe.__sumiStripeByBiz) {
    globalForStripe.__sumiStripeByBiz = new Map();
  }
  const cached = globalForStripe.__sumiStripeByBiz.get(businessId);
  if (cached) return cached;

  const db = getDb();
  const [biz] = await db
    .select({
      stripeSecretKeyEncrypted: businesses.stripeSecretKeyEncrypted,
      stripeWebhookSecretEncrypted: businesses.stripeWebhookSecretEncrypted,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (biz?.stripeSecretKeyEncrypted) {
    const secret = decryptString(biz.stripeSecretKeyEncrypted);
    const webhookSecret = biz.stripeWebhookSecretEncrypted
      ? decryptString(biz.stripeWebhookSecretEncrypted)
      : null;
    const stripe = new Stripe(secret, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
    const entry = { stripe, webhookSecret };
    globalForStripe.__sumiStripeByBiz.set(businessId, entry);
    return entry;
  }

  // Fallback to env (single-tenant / dev installs).
  const envStripe = getEnvStripe();
  if (!envStripe) return null;
  const entry = {
    stripe: envStripe,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
  };
  // Don't cache env fallback per-biz so settings updates reflect immediately.
  return entry;
}

/**
 * Invalidates the cached Stripe instance for a business. Call after
 * settings changes.
 */
export function invalidateStripeCache(businessId: string): void {
  globalForStripe.__sumiStripeByBiz?.delete(businessId);
}

/**
 * Quick check used by UI to decide whether to render the pay button.
 * Cheaper than building a Stripe instance just to ask "is it configured?".
 */
export async function isStripeConfiguredForBusiness(
  businessId: string
): Promise<boolean> {
  const db = getDb();
  const [biz] = await db
    .select({
      stripeSecretKeyEncrypted: businesses.stripeSecretKeyEncrypted,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (biz?.stripeSecretKeyEncrypted) return true;
  return Boolean(env.STRIPE_SECRET_KEY);
}

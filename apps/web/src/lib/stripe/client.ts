import 'server-only';
import Stripe from 'stripe';
import { env } from '@/env';

const globalForStripe = globalThis as unknown as { __sumiStripe?: Stripe };

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

export function getStripe(): Stripe {
  if (globalForStripe.__sumiStripe) return globalForStripe.__sumiStripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it (and STRIPE_WEBHOOK_SECRET) to env to enable invoice payments.'
    );
  }
  globalForStripe.__sumiStripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
  return globalForStripe.__sumiStripe;
}

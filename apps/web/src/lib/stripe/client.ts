import 'server-only';
import Stripe from 'stripe';
import { env } from '@/env';

const globalForStripe = globalThis as unknown as { __sumiStripe?: Stripe };

export function getStripe(): Stripe {
  if (globalForStripe.__sumiStripe) return globalForStripe.__sumiStripe;
  globalForStripe.__sumiStripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
  return globalForStripe.__sumiStripe;
}

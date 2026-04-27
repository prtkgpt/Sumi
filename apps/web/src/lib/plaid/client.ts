import 'server-only';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { env } from '@/env';

const globalForPlaid = globalThis as unknown as { __sumiPlaid?: PlaidApi };

export function getPlaidClient(): PlaidApi {
  if (globalForPlaid.__sumiPlaid) return globalForPlaid.__sumiPlaid;

  const basePath = PlaidEnvironments[env.PLAID_ENV];
  if (!basePath) {
    throw new Error(`Unknown PLAID_ENV value: ${env.PLAID_ENV}`);
  }

  const config = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  });

  globalForPlaid.__sumiPlaid = new PlaidApi(config);
  return globalForPlaid.__sumiPlaid;
}

export function getWebhookUrl(): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  return `${base}/api/plaid/webhook`;
}

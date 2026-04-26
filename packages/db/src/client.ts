import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// Re-use connections across invocations on warm Lambdas / Vercel functions.
neonConfig.fetchConnectionCache = true;

let cachedPool: Pool | null = null;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Returns a Drizzle client backed by Neon's serverless WebSocket pool.
 * WebSocket pool is required for interactive transactions
 * (`db.transaction(async tx => ...)`), which the HTTP driver does not support.
 * The connection URL is read lazily so that build-time imports don't crash
 * when DATABASE_URL is absent.
 */
export function getDb() {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Configure it in apps/web/.env.local or Vercel project settings.'
    );
  }
  cachedPool = new Pool({ connectionString: url });
  cachedDb = drizzle(cachedPool, { schema });
  return cachedDb;
}

export type Db = ReturnType<typeof getDb>;

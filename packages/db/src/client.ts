import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

// Reuse the pool across module reloads (Next.js dev HMR) and across warm
// invocations on the same Vercel function instance. Without this each HMR
// reload would leak a Pool and accumulate WebSocket connections.
const globalForDb = globalThis as unknown as {
  __sumiPool?: Pool;
  __sumiDb?: DrizzleClient;
};

export function getDb(): DrizzleClient {
  if (globalForDb.__sumiDb) return globalForDb.__sumiDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Configure it in apps/web/.env.local or Vercel project settings.'
    );
  }

  globalForDb.__sumiPool = new Pool({ connectionString: url });
  globalForDb.__sumiDb = drizzle(globalForDb.__sumiPool, { schema });
  return globalForDb.__sumiDb;
}

export type Db = DrizzleClient;

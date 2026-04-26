import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log('Applying migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

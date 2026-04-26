import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, users, type User } from '@sumi/db';
import { stackServerApp } from '@/stack';

/**
 * Returns the current Stack user mapped to the local `users` row.
 * Inserts a row on first call so that other tables can FK to `users.id`.
 * Returns null when nobody is signed in.
 */
export async function syncCurrentUser(): Promise<User | null> {
  const stackUser = await stackServerApp.getUser();
  if (!stackUser) return null;

  const db = getDb();
  const email = stackUser.primaryEmail;
  const displayName = stackUser.displayName ?? null;

  if (!email) {
    throw new Error(
      `Stack user ${stackUser.id} has no primary email; cannot sync.`
    );
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.stackUserId, stackUser.id))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.email !== email || row.displayName !== displayName) {
      const [updated] = await db
        .update(users)
        .set({ email, displayName, updatedAt: new Date() })
        .where(eq(users.id, row.id))
        .returning();
      return updated;
    }
    return row;
  }

  const [inserted] = await db
    .insert(users)
    .values({ stackUserId: stackUser.id, email, displayName })
    .returning();
  return inserted;
}

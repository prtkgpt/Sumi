import 'server-only';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import {
  getDb,
  memberships,
  businesses,
  type Business,
  type Membership,
  type User,
} from '@sumi/db';
import { syncCurrentUser } from './sync-user';

export type RequiredBusiness = {
  user: User;
  business: Business;
  membership: Membership;
};

/**
 * Use at the top of every Server Component under /[bizId]/*.
 * - No session → /handler/sign-in
 * - Session but no membership for this business → /onboarding
 */
export async function requireBusiness(bizId: string): Promise<RequiredBusiness> {
  const user = await syncCurrentUser();
  if (!user) redirect('/handler/sign-in');

  const db = getDb();
  const rows = await db
    .select({ membership: memberships, business: businesses })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.businessId, bizId),
        eq(memberships.status, 'active')
      )
    )
    .limit(1);

  if (rows.length === 0) redirect('/onboarding');

  return { user, business: rows[0].business, membership: rows[0].membership };
}

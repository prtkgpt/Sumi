import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import {
  getDb,
  memberships,
  businesses,
  type Business,
  type Membership,
} from '@sumi/db';

export type MembershipWithBusiness = {
  membership: Membership;
  business: Business;
};

export async function getCurrentMemberships(
  userId: string
): Promise<MembershipWithBusiness[]> {
  const db = getDb();
  const rows = await db
    .select({ membership: memberships, business: businesses })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')))
    .orderBy(asc(memberships.acceptedAt));
  return rows;
}

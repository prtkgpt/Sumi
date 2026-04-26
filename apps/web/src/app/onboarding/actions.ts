'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb, businesses, memberships } from '@sumi/db';
import { syncCurrentUser } from '@/lib/auth/sync-user';

const Input = z.object({
  legalName: z.string().trim().min(1, 'Business name is required').max(120),
});

export type CreateBusinessState = {
  error?: string;
};

export async function createBusiness(
  _prev: CreateBusinessState,
  formData: FormData
): Promise<CreateBusinessState> {
  const parsed = Input.safeParse({ legalName: formData.get('legalName') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const user = await syncCurrentUser();
  if (!user) redirect('/handler/sign-in');

  const db = getDb();
  const businessId = await db.transaction(async (tx) => {
    const [biz] = await tx
      .insert(businesses)
      .values({
        legalName: parsed.data.legalName,
        ownerUserId: user.id,
      })
      .returning({ id: businesses.id });

    await tx.insert(memberships).values({
      businessId: biz.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
    });

    return biz.id;
  });

  redirect(`/${businessId}/dashboard`);
}

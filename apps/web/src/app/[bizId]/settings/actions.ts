'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb, businesses } from '@sumi/db';
import { requireBusiness } from '@/lib/auth/require-business';
import { encryptString } from '@/lib/crypto';
import { invalidateStripeCache } from '@/lib/stripe/client';

const ProfileInput = z.object({
  bizId: z.string().uuid(),
  legalName: z.string().trim().min(1, 'Legal name is required').max(200),
  displayName: z.string().trim().max(200).optional(),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .max(200)
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(50).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().min(2).max(2).optional(),
  ein: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{7}$/, 'EIN must be NN-NNNNNNN')
    .optional()
    .or(z.literal('')),
  entityType: z
    .enum(['sole_prop', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit', 'other'])
    .optional()
    .or(z.literal('')),
});

export type ProfileFormState = {
  ok?: boolean;
  error?: string;
};

export async function updateBusinessProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const rawEntity = formData.get('entityType');
  const parsed = ProfileInput.safeParse({
    bizId: formData.get('bizId'),
    legalName: formData.get('legalName'),
    displayName: formData.get('displayName') || undefined,
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    addressLine1: formData.get('addressLine1') || undefined,
    addressLine2: formData.get('addressLine2') || undefined,
    city: formData.get('city') || undefined,
    state: formData.get('state') || undefined,
    postalCode: formData.get('postalCode') || undefined,
    country: formData.get('country') || undefined,
    ein: formData.get('ein') || undefined,
    entityType: rawEntity && rawEntity !== 'none' ? rawEntity : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;
  const { business } = await requireBusiness(input.bizId);
  const db = getDb();

  const einEncrypted = input.ein ? encryptString(input.ein) : null;

  await db
    .update(businesses)
    .set({
      legalName: input.legalName,
      displayName: input.displayName ?? null,
      email: input.email ? input.email : null,
      phone: input.phone ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? 'US',
      // Preserve existing EIN if user left blank — only overwrite when provided.
      ...(input.ein !== undefined ? { einEncrypted } : {}),
      entityType: input.entityType ? input.entityType : null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));

  revalidatePath(`/${business.id}/settings`);
  return { ok: true };
}

const StripeKeysInput = z.object({
  bizId: z.string().uuid(),
  secretKey: z
    .string()
    .trim()
    .regex(/^sk_(test|live)_/, 'Stripe secret keys start with sk_test_ or sk_live_')
    .min(20),
  webhookSecret: z
    .string()
    .trim()
    .regex(/^whsec_/, 'Webhook signing secrets start with whsec_')
    .min(20),
});

export type StripeKeysState = {
  ok?: boolean;
  accountId?: string;
  error?: string;
};

/**
 * Saves and validates per-business Stripe credentials. Validates by
 * calling `accounts.retrieve()` — succeeds if the secret key is real and
 * has access to the account. Webhook signature isn't validated here
 * (that requires actually receiving a signed webhook), so the user
 * still needs to point Stripe at the webhook URL after saving.
 */
export async function updateStripeKeys(
  _prev: StripeKeysState,
  formData: FormData
): Promise<StripeKeysState> {
  const parsed = StripeKeysInput.safeParse({
    bizId: formData.get('bizId'),
    secretKey: formData.get('secretKey'),
    webhookSecret: formData.get('webhookSecret'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const input = parsed.data;
  const { business } = await requireBusiness(input.bizId);

  let accountId: string;
  try {
    const probe = new Stripe(input.secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
    const account = await probe.accounts.retrieve();
    accountId = account.id;
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Stripe rejected the key: ${err.message}`
          : 'Could not validate Stripe key',
    };
  }

  const db = getDb();
  await db
    .update(businesses)
    .set({
      stripeSecretKeyEncrypted: encryptString(input.secretKey),
      stripeWebhookSecretEncrypted: encryptString(input.webhookSecret),
      stripeAccountId: accountId,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));

  invalidateStripeCache(business.id);
  revalidatePath(`/${business.id}/settings`);
  return { ok: true, accountId };
}

const ClearKeysInput = z.object({ bizId: z.string().uuid() });

export async function clearStripeKeys(formData: FormData) {
  const parsed = ClearKeysInput.parse({ bizId: formData.get('bizId') });
  const { business } = await requireBusiness(parsed.bizId);
  const db = getDb();
  await db
    .update(businesses)
    .set({
      stripeSecretKeyEncrypted: null,
      stripeWebhookSecretEncrypted: null,
      stripeAccountId: null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));
  invalidateStripeCache(business.id);
  revalidatePath(`/${business.id}/settings`);
}

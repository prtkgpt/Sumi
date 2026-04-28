import { eq } from 'drizzle-orm';
import { getDb, businesses } from '@sumi/db';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { requireBusiness } from '@/lib/auth/require-business';
import { decryptString } from '@/lib/crypto';
import { env } from '@/env';
import { ProfileForm, type Profile } from './profile-form';
import { StripeKeysForm, type StripeStatus } from './stripe-keys-form';

function maskEin(ein: string): string {
  if (!ein) return '';
  // Show last 4: NN-NNNNNNN → ··-···NNNN
  const digits = ein.replace(/\D/g, '');
  if (digits.length < 4) return '··-·······';
  return `··-···${digits.slice(-4)}`;
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { business } = await requireBusiness(bizId);
  const db = getDb();

  const [row] = await db
    .select({
      id: businesses.id,
      legalName: businesses.legalName,
      displayName: businesses.displayName,
      email: businesses.email,
      phone: businesses.phone,
      addressLine1: businesses.addressLine1,
      addressLine2: businesses.addressLine2,
      city: businesses.city,
      state: businesses.state,
      postalCode: businesses.postalCode,
      country: businesses.country,
      einEncrypted: businesses.einEncrypted,
      entityType: businesses.entityType,
      stripeSecretKeyEncrypted: businesses.stripeSecretKeyEncrypted,
      stripeAccountId: businesses.stripeAccountId,
    })
    .from(businesses)
    .where(eq(businesses.id, business.id))
    .limit(1);

  let einMasked: string | null = null;
  if (row?.einEncrypted) {
    try {
      einMasked = maskEin(decryptString(row.einEncrypted));
    } catch {
      einMasked = '··-·······';
    }
  }

  const profile: Profile = {
    legalName: row?.legalName ?? business.legalName,
    displayName: row?.displayName ?? null,
    email: row?.email ?? null,
    phone: row?.phone ?? null,
    addressLine1: row?.addressLine1 ?? null,
    addressLine2: row?.addressLine2 ?? null,
    city: row?.city ?? null,
    state: row?.state ?? null,
    postalCode: row?.postalCode ?? null,
    country: row?.country ?? 'US',
    entityType: row?.entityType ?? null,
    einMasked,
  };

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const stripeStatus: StripeStatus = {
    configured: Boolean(row?.stripeSecretKeyEncrypted),
    accountId: row?.stripeAccountId ?? null,
    webhookUrl: `${appUrl}/api/stripe/webhook/${business.id}`,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage business profile and integrations.
        </p>
      </div>

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
          <p className="text-sm text-muted-foreground">
            What appears on invoices, tax exports, and the public pay page.
          </p>
        </header>
        <Card>
          <CardContent className="py-6">
            <ProfileForm bizId={business.id} profile={profile} />
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <header className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Stripe (card payments)
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect your Stripe account so customers can pay invoices by
            card. Each business uses its own Stripe — funds go straight to
            you, never through Sumi.
          </p>
        </header>
        <Card>
          <CardContent className="py-6">
            <StripeKeysForm bizId={business.id} status={stripeStatus} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

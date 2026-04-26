import { requireBusiness } from '@/lib/auth/require-business';
import { getCurrentMemberships } from '@/lib/auth/get-current-memberships';
import { AppShell } from '@/components/app-shell/app-shell';

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { user, business } = await requireBusiness(bizId);
  const mems = await getCurrentMemberships(user.id);

  return (
    <AppShell
      bizId={bizId}
      current={{ id: business.id, legalName: business.legalName }}
      businesses={mems.map((m) => ({
        id: m.business.id,
        legalName: m.business.legalName,
      }))}
    >
      {children}
    </AppShell>
  );
}

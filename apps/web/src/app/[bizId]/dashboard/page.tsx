import { requireBusiness } from '@/lib/auth/require-business';

function firstName(displayName: string | null, email: string): string {
  if (displayName && displayName.trim()) return displayName.split(/\s+/)[0];
  return email.split('@')[0];
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ bizId: string }>;
}) {
  const { bizId } = await params;
  const { user } = await requireBusiness(bizId);
  const name = firstName(user.displayName, user.email);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome, {name}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your numbers will appear here as you connect accounts.
      </p>
    </div>
  );
}

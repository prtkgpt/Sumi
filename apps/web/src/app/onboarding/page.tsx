import { redirect } from 'next/navigation';
import { syncCurrentUser } from '@/lib/auth/sync-user';
import { getCurrentMemberships } from '@/lib/auth/get-current-memberships';
import { OnboardingForm } from './onboarding-form';

export default async function OnboardingPage() {
  const user = await syncCurrentUser();
  if (!user) redirect('/handler/sign-in');

  const mems = await getCurrentMemberships(user.id);
  if (mems.length > 0) {
    redirect(`/${mems[0].business.id}/dashboard`);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">
          Let&apos;s set up your business
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can change this later in settings.
        </p>
        <div className="mt-8">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}

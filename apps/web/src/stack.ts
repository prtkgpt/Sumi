import 'server-only';
import { StackServerApp } from '@stackframe/stack';
import { env } from '@/env';

const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');

export const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  urls: {
    signIn: `${appUrl}/handler/sign-in`,
    signUp: `${appUrl}/handler/sign-up`,
    afterSignIn: `${appUrl}/onboarding`,
    afterSignUp: `${appUrl}/onboarding`,
    afterSignOut: `${appUrl}/`,
  },
});

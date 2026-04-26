import 'server-only';
import { StackServerApp } from '@stackframe/stack';
import { env } from '@/env';

export const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie',
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  urls: {
    signIn: '/handler/sign-in',
    signUp: '/handler/sign-up',
    afterSignIn: '/onboarding',
    afterSignUp: '/onboarding',
    afterSignOut: '/',
  },
});

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { StackProvider, StackTheme } from '@stackframe/stack';
import { Toaster } from 'sonner';
import { stackServerApp } from '@/stack';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sumi — Simple bookkeeping for small businesses',
  description: 'Bookkeeping that does the boring work for you.',
};

// StackProvider needs request-time auth context; opt every route out of static
// prerender so production builds don't try to instantiate the auth client
// during page-data collection.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <StackProvider app={stackServerApp}>
          <StackTheme>
            {/*
              Required for Next 15.5 / React 19: Stack's `useUser()` and
              next/navigation hooks like `usePathname()` suspend during
              render. Without a Suspense boundary above them the renderer
              throws NoSuspenseBoundaryError. `force-dynamic` does not
              satisfy this rule on its own.
            */}
            <Suspense fallback={null}>{children}</Suspense>
            <Toaster position="top-right" richColors closeButton />
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}

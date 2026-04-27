'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('global-error boundary:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium tracking-widest text-muted-foreground">
            500
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            {error.message || 'Unknown server error'}
          </p>
          {error.digest && (
            <p className="mt-1 text-xs text-muted-foreground">
              digest: <code className="font-mono">{error.digest}</code>
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}

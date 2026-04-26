import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Sumi
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/handler/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/handler/sign-up">
              Get started <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Bookkeeping that does the boring work for you.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Sumi keeps your books current, your taxes ready, and your weekends
          free. Built for US small businesses.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/handler/sign-up">
              Get started <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/handler/sign-in">Sign in</Link>
          </Button>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Sumi
      </footer>
    </div>
  );
}

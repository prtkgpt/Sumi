import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  FileText,
  Landmark,
  ScanLine,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const FEATURES = [
  {
    icon: Landmark,
    title: 'Connect your bank',
    body: 'Plaid powers ~12,000 US institutions. New transactions sync automatically; balances stay current.',
  },
  {
    icon: Sparkles,
    title: 'AI-categorized by default',
    body: 'Claude Haiku reads each new transaction and assigns a Schedule C category. You only review the ones it isn’t sure about.',
  },
  {
    icon: FileText,
    title: 'Send invoices in 60 seconds',
    body: 'Itemized line items, customer select, instant pay link. Customers pay by card; the money goes straight to your Stripe account.',
  },
  {
    icon: ScanLine,
    title: 'Drag-and-drop receipts',
    body: 'Drop a photo or PDF and Sumi reads the merchant, date, and amount, then auto-matches it to the right transaction.',
  },
  {
    icon: Banknote,
    title: 'Tax-ready every month',
    body: 'Live P&L, Schedule C summary, transaction CSVs. Hand to your CPA or import into TurboTax — no end-of-year scramble.',
  },
  {
    icon: ShieldCheck,
    title: 'Your business, your keys',
    body: 'Multi-tenant from day one. Each business has its own profile, its own Stripe account, its own data. Encrypted at rest.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Connect a bank or add transactions manually',
    body: 'Plaid sandbox or production. Or skip the bank — enter expenses by hand. Mix and match.',
  },
  {
    n: '02',
    title: 'Sumi categorizes everything',
    body: 'Three-stage pipeline (rules → LLM → your overrides) means review takes minutes, not hours.',
  },
  {
    n: '03',
    title: 'Bill customers and file taxes',
    body: 'Send invoices, accept card payments, export Schedule C — all from one app.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <span className="text-sm font-bold">S</span>
            </span>
            Sumi
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="#features">Features</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/handler/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/handler/sign-up">
                Get started
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--color-secondary)_0%,_transparent_60%)]" />
          <div className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center md:px-10 md:pt-32 md:pb-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Built for US solo operators, freelancers, and small teams
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
              Bookkeeping that does the boring work for you.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Connect your bank, send invoices, file Schedule C — in one
              quiet app that keeps itself current.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/handler/sign-up">
                  Get started free
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/handler/sign-in">I have an account</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required. Bring your own Stripe account when
              you&apos;re ready to take payments.
            </p>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-6 py-20 md:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                What you get
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Everything a small business actually needs.
              </h2>
              <p className="mt-4 text-muted-foreground">
                No bloat, no ten-tab navigation. Six features that move the
                needle, built to work together.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="bg-background">
                  <CardContent className="space-y-3 py-6">
                    <div className="inline-flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto max-w-5xl px-6 py-20 md:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Three steps. No bookkeeper required.
              </h2>
            </div>

            <ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {STEPS.map(({ n, title, body }) => (
                <li key={n} className="space-y-2">
                  <div className="text-xs font-mono font-semibold tracking-widest text-muted-foreground">
                    {n}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center md:px-10">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Stop dreading the books.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Sign up in 30 seconds. Connect a bank in another minute. Get
              your weekends back.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/handler/sign-up">
                  Get started free
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">Browse features</Link>
              </Button>
            </div>
            <ul className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[
                'No credit card required',
                'Cancel any time',
                'Your data, exportable',
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row md:px-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded bg-foreground text-background">
              <span className="text-[10px] font-bold">S</span>
            </span>
            © {new Date().getFullYear()} Sumi
          </div>
          <div className="flex items-center gap-4">
            <Link href="/handler/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link href="/handler/sign-up" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

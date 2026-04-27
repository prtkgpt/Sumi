# Sumi — Engineering Conventions (v0.1)

This file is the source of truth for *how* code in this repo is written. Read it before editing.

## Product

Sumi is a simple bookkeeping app for US small businesses. v0.1 ships only the **onboarding happy path**: marketing landing → sign in → create a business → authenticated dashboard shell with placeholder nav. No transactions, invoices, Plaid, Stripe, or reporting work belongs in v0.1.

## Stack (locked)

- **Runtime / framework:** Next.js 15 (App Router), React 19, TypeScript 5.6+ in strict mode.
- **Hosting:** Vercel.
- **Database:** Neon Postgres, accessed via `@neondatabase/serverless` (HTTP) and `drizzle-orm`.
- **Auth:** Stack Auth (`@stackframe/stack`) — email magic link + Google OAuth.
- **Styling:** Tailwind CSS v4, shadcn/ui (`new-york` style, CSS variables). Use the shadcn CLI for every primitive — do not hand-roll buttons or inputs.
- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers`.
- **Icons:** `lucide-react`.
- **Toasts:** `sonner`.
- **Dates:** `date-fns` + `date-fns-tz`.
- **Env:** `@t3-oss/env-nextjs` with zod validation.
- **Package manager:** pnpm 10.x.
- **Monorepo:** Turborepo with pnpm workspaces.

## Repo layout

```
/
├─ apps/
│  └─ web/                  Next.js app deployed to Vercel
└─ packages/
   ├─ db/                   Drizzle schema, migrations, Neon client (shared)
   └─ types/                Shared TS types
```

`apps/mobile` (Expo) will be added in a later milestone — do not scaffold it now.

## Environment variables

Validated in `apps/web/src/env.ts`. Do not read `process.env.*` outside that file.

Required at runtime:

```
DATABASE_URL=                              # Neon pooled connection string
NEXT_PUBLIC_STACK_PROJECT_ID=
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=
STACK_SECRET_SERVER_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`packages/db` reads `DATABASE_URL` only when running migrations / Drizzle Studio.

## Non-negotiables

1. **Never** read `process.env` outside `apps/web/src/env.ts` (or `packages/db/src/env.ts`). Next.js inlines stale values; centralize validation.
2. **Never** import `packages/db` from a Client Component. DB calls go through Server Components, Server Actions, or Route Handlers.
3. **Always** `await` `cookies()` and `headers()` in Next.js 15.
4. **Always** validate user input with zod at the Server Action boundary. Client-side validation is UX, not security.
5. **Always** check the current user (`stackServerApp.getUser()`) at the top of every Server Action and protected Route Handler. Do not trust middleware alone.
6. **Never** put a `redirect()` inside a `try/catch` that swallows it — `redirect` throws.
7. **Never** add shadcn components you don't yet use. Keep the UI surface small.
8. **Never** invent schema. Drizzle definitions in `packages/db/src/schema.ts` are the source of truth. To add a column, edit the schema, generate a migration, and commit both.

## Database conventions

- All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` where mutated.
- Foreign keys explicit with `onDelete` behavior.
- Tenant scoping via `business_id`. Every tenant-scoped table includes it; queries filter by it.
- Owner-on-business-create is implemented as a **single Server Action that wraps both inserts in a transaction** (`db.transaction(async tx => { ... })`). No SQL triggers.
- Migrations live in `packages/db/drizzle/`. Generate with `pnpm --filter @sumi/db db:generate`. Apply with `pnpm --filter @sumi/db db:migrate`.

## Auth conventions

- Stack Auth handler mounted at `apps/web/src/app/handler/[...stack]/page.tsx` per Stack's Next.js quickstart.
- Server access: `stackServerApp.getUser()` from `@/lib/stack`. Returns `null` if signed out.
- Client access: `useUser()` from `@stackframe/stack` (in Client Components only).
- The Stack `<StackProvider>` + `<StackTheme>` wrap the root layout.
- Sign-out uses Stack's built-in `/handler/sign-out`.

## File naming

- Files: `kebab-case.tsx` / `kebab-case.ts`.
- React components: `PascalCase` exports.
- Server actions: `verbNoun` (e.g. `createBusiness`).
- Route segments: lowercase, App Router conventions.

## Code style

- TypeScript strict mode. No `any` unless justified by a one-line comment.
- Prefer named exports. Default-export only when Next.js requires it (page/layout/route files).
- Default to writing no comments. Add a comment only when the *why* is non-obvious.
- No "// removed for X" or other historical comments — git log is for history.
- Server Components by default; only mark `'use client'` when you need browser APIs, state, or event handlers.

## Verification

Before declaring v0.1 done, run:

```bash
pnpm install
pnpm --filter @sumi/db db:generate     # if schema changed
pnpm --filter @sumi/db db:migrate      # applies pending migrations to Neon
pnpm --filter web typecheck            # zero errors
pnpm --filter web lint                 # zero errors
pnpm --filter web build                # zero errors
pnpm dev                               # localhost:3000
```

Then walk the eight items in the v0.1 definition of done by hand.

## v0.1 definition of done

1. `/` renders a marketing landing page with "Sign in" and "Get started" CTAs.
2. `/handler/sign-in` (Stack Auth) supports email magic link + Google OAuth.
3. After first sign-in, a user with no `memberships` row is redirected to `/onboarding`.
4. `/onboarding` is a single-field form ("What's your business name?"). Submitting it inserts a `businesses` row + an owner `memberships` row in one transaction, and redirects to `/[bizId]/dashboard`.
5. `/[bizId]/dashboard` renders the authenticated shell (sidebar + top bar with business switcher + user menu) and the text `Welcome, {first_name}`.
6. Sidebar links Dashboard / Inbox / Invoices / Customers / Reports / Settings all route to a placeholder page that says "Coming soon."
7. Sign out from the user menu clears the session and returns to `/`.
8. Unauthenticated access to any `/[bizId]/*` route redirects to sign in.

If a future task expands scope beyond these eight items, **stop and flag it**.

## v0.2 scope (in progress)

After v0.1 ships, v0.2 adds the **transactions backbone** so the inbox stops being a placeholder. In scope:

1. New tables: `financial_accounts`, `categories`, `transactions`, `plaid_items`, `webhook_events` (Drizzle source of truth in `packages/db/src/schema.ts`).
2. **Plaid Link** end-to-end: link-token endpoint, public-token exchange, initial ~30-day `/transactions/sync` pull, signed webhook handler that advances the cursor on `SYNC_UPDATES_AVAILABLE`. Plaid access tokens are encrypted at rest with AES-256-GCM (key in `ENCRYPTION_KEY`).
3. **Manual transaction entry** at `/[bizId]/transactions/new`.
4. **Transactions list** at `/[bizId]/transactions` (renamed from `/inbox` in v0.4): real transaction list (Plaid + manual mixed), inline category select, "Needs review" filter, Connect-bank + Add-transaction CTAs.
5. **Schedule C category seed** on first transaction insert per business (20-line taxonomy + transfer/owner_draw/personal).

Out of scope (deferred to v0.3+):

- Auto-categorization (LLM pipeline).
- Keyboard-driven inbox (j/k/c/s shortcuts), bulk edit, splits.
- Dashboard KPI tiles (cash, revenue, expenses, profit, unpaid invoices).
- 24-month historical Plaid backfill (v0.2 caps at ~30 days).
- Invoicing, customers, receipts/OCR, tax packet, mobile.

## v0.3 scope (in progress)

After v0.2 ships, v0.3 adds the **auto-categorization pipeline** so most Plaid rows arrive with a category guess and users only review the unknowns. In scope:

1. New table: `categorization_rules` (per-business merchant → category mapping with `source` enum `user | llm`). New column on `transactions`: `category_source enum('user','llm')` (nullable; null when uncategorized).
2. **3-stage pipeline** in `apps/web/src/lib/categorization/`:
   - Stage 1 — exact rule lookup keyed by `normalize(merchant)`.
   - Stage 2 — Claude Haiku (`claude-haiku-4-5`) batched call (~20 transactions per request) with structured JSON output (`output_config.format` + json_schema), prompt caching on the system + category list. Verdicts below 0.7 confidence stay uncategorized.
   - Stage 3 — every user override in the inbox upserts a `source='user'` rule that beats LLM rules for the same merchant on future imports.
3. **Trigger points**: end of `syncItem` after Plaid upsert; `setTransactionCategory` server action when the user picks a category.
4. **UI**: small "AI" badge next to LLM-categorized rows in the inbox so users know what to spot-check.
5. New env: `ANTHROPIC_API_KEY`.

Out of scope (deferred to v0.4+):

- Keyboard-driven inbox shortcuts, bulk edit, transaction splits.
- 24-month Plaid backfill.
- Invoicing, customers, receipts/OCR, tax packet.

## v0.4 scope (in progress)

After v0.3 ships, v0.4 makes the dashboard non-empty. In scope:

1. **Inbox → Transactions rename.** `/[bizId]/inbox` is now `/[bizId]/transactions`; sidebar label and icon updated. The `/transactions/new` manual-entry path is unchanged.
2. **Account balance snapshots.** New columns on `financial_accounts`: `current_balance_cents`, `available_balance_cents`, `last_balance_at`. Captured on Plaid `exchange` and refreshed in `syncItem` via `accountsGet`.
3. **Dashboard KPIs at `/[bizId]/dashboard`**: 5 tiles in a responsive grid.
   - Cash on hand: sum of `current_balance_cents` across `bank_checking | bank_savings | manual_cash`.
   - Revenue MTD: sum of categorized-`income` transactions this month.
   - Expenses MTD: sum of categorized-`expense` transactions this month (positive number).
   - Profit MTD: revenue − expenses, color-coded.
   - Unpaid invoices: placeholder `—` until v0.5 invoicing lands.

Out of scope (deferred to v0.5+):

- Invoicing (customers, invoice editor, Stripe Checkout, hosted pay pages).
- Receipts / OCR.
- Tax packet export.
- Per-business timezones for "this month" boundaries (currently UTC).
- Trend arrows / period-over-period comparisons on KPI tiles.
- 24-month Plaid backfill.

## v0.5 scope (in progress)

After v0.4 ships, v0.5 adds **invoicing** so a business can bill customers and accept card payments. In scope:

1. New tables: `customers`, `invoices`, `invoice_line_items`. `webhook_provider` enum widened to include `'stripe'`.
2. **Customers** at `/[bizId]/customers`: list, add, edit, archive.
3. **Invoices** at `/[bizId]/invoices`:
   - List view with status chips (draft / sent / paid / void).
   - Editor at `/new` and `/{id}/edit` with itemized line items, customer select, dates, notes; total recomputed live.
   - Detail page at `/{id}` with Send / Mark paid / Void / Copy pay-link actions. Drafts are editable; sent/paid/void are immutable.
4. **Public hosted pay page** at `/pay/[token]` (no auth) — branded summary + line items + Pay button. Server-rendered.
5. **Stripe Checkout** at `POST /api/stripe/checkout` creates a Session for the invoice amount. Single-tenant: uses one `STRIPE_SECRET_KEY` (Stripe Connect / multi-tenant is v0.6+).
6. **Stripe webhook** at `POST /api/stripe/webhook` verifies the signature, dedupes via `webhook_events`, and flips `invoices.status` to `paid` on `checkout.session.completed`.
7. **Dashboard 5th KPI tile lights up**: sum + count of `invoices.status = 'sent'`.

Out of scope (deferred to v0.6+):

- Stripe Connect Standard for multi-tenant (each business connects their own Stripe).
- Email delivery of invoices (SendGrid). For v0.5 the user copies the public pay link.
- Auto-match Stripe payouts to bank deposits (Plaid will pick up the deposit on its own).
- Recurring invoices, partial payments, ACH.
- Receipts / OCR, tax packet, Schedule C export.
- 24-month Plaid backfill, keyboard inbox shortcuts.

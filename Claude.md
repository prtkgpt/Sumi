# Sumi — Claude Code kickoff v0.1

You are scaffolding **Sumi**, a simple bookkeeping app for US small businesses. The database schema, RLS policies, seed data, and coding conventions already exist in the repo. Read `CLAUDE.md` at the repo root **before doing anything else** — it contains the stack, repo layout, label conventions, and non-negotiables that govern every file you write in this session.

## Goal

Ship the **onboarding happy path** and nothing else. A new visitor must be able to: land on `/`, sign in, create a business, and land on a dashboard shell with navigation in place. The dashboard itself is a “Welcome, {name}” placeholder. No Plaid, no transactions, no invoicing, no reports.

## Definition of done

`pnpm dev` runs clean and **all eight** pass by hand:

1. `/` renders a marketing landing page with “Sign in” and “Get started” CTAs.
2. `/signin` supports email magic link **and** Google OAuth via Supabase Auth.
3. After first sign-in, a user with no `memberships` row is redirected to `/onboarding`.
4. `/onboarding` is a single-field form (“What’s your business name?”). Submitting it inserts a row in `businesses`, the `create_owner_membership` trigger fires, and the user is redirected to `/[bizSlug]/dashboard`.
5. `/[bizSlug]/dashboard` renders the authenticated shell (sidebar nav, top bar with business switcher + user menu) and the text `Welcome, {first_name}`.
6. Sidebar links Dashboard / Inbox / Invoices / Customers / Reports / Settings all route to a placeholder page that says “Coming soon.”
7. Sign out from the user menu clears the session and returns to `/`.
8. Unauthenticated access to any `/[bizSlug]/*` route redirects to `/signin`.

## Strict scope — DO NOT build

- Any Plaid, Stripe, or SendGrid integration
- Transaction ingestion, categorization, or inbox UI
- Invoice editor, customer, or vendor pages
- Dashboard KPI tiles, charts, or real data queries
- Billing / subscription management
- Mobile (Expo) app — skip the `/apps/mobile` directory entirely in v0.1
- Email branding beyond Supabase defaults

If a user request in this session expands scope beyond the eight items above, **stop and flag it**. Do not silently grow scope.

## Stack (exact choices)

- **Package manager:** pnpm (10.x). Use `pnpm` not `npm` for every install.
- **Monorepo:** Turborepo with pnpm workspaces. Two workspaces at v0.1: `apps/web` and `packages/types`. Do not create `apps/mobile` or `packages/ui` yet.
- **Framework:** Next.js 15 (App Router), React 19, TypeScript 5.6+ in strict mode.
- **Styling:** Tailwind CSS v4, shadcn/ui (`pnpm dlx shadcn@latest init`, then add components as needed). Use the shadcn CLI for every primitive — do not hand-roll buttons or inputs.
- **Data:** `@supabase/ssr` for server + browser clients. Never use the anon-key client directly from client components for tenant data; always go through a server action or server component.
- **Forms:** `react-hook-form` + `zod` + `@hookform/resolvers`.
- **Icons:** `lucide-react`.
- **Toasts:** `sonner`.
- **Dates:** `date-fns` + `date-fns-tz`.
- **Env:** `@t3-oss/env-nextjs` with zod validation for all envs.

## Environment variables

Create `.env.example` at repo root and in `apps/web/`. Expect these at runtime (all required except where noted):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Validate with `@t3-oss/env-nextjs` in `apps/web/src/env.ts`. Fail loud on startup if any are missing.

## File tree to create

```
/
├─ pnpm-workspace.yaml
├─ turbo.json
├─ package.json                          (root, with "packageManager": "pnpm@...")
├─ .env.example
├─ .gitignore                            (add .env, .turbo, node_modules, .next)
├─ apps/
│  └─ web/
│     ├─ package.json
│     ├─ next.config.ts
│     ├─ tsconfig.json
│     ├─ tailwind.config.ts
│     ├─ postcss.config.mjs
│     ├─ components.json                 (shadcn)
│     ├─ middleware.ts
│     ├─ .env.example
│     └─ src/
│        ├─ env.ts
│        ├─ app/
│        │  ├─ layout.tsx                (root; Sonner Toaster, fonts)
│        │  ├─ globals.css
│        │  ├─ (marketing)/
│        │  │  ├─ layout.tsx             (marketing shell)
│        │  │  └─ page.tsx               (landing page /)
│        │  ├─ signin/
│        │  │  └─ page.tsx
│        │  ├─ auth/
│        │  │  └─ callback/
│        │  │     └─ route.ts            (PKCE exchange → redirect)
│        │  ├─ onboarding/
│        │  │  ├─ page.tsx
│        │  │  └─ actions.ts             (createBusiness server action)
│        │  ├─ (app)/
│        │  │  └─ [bizSlug]/
│        │  │     ├─ layout.tsx          (authenticated shell)
│        │  │     ├─ dashboard/page.tsx
│        │  │     ├─ inbox/page.tsx
│        │  │     ├─ invoices/page.tsx
│        │  │     ├─ customers/page.tsx
│        │  │     ├─ reports/page.tsx
│        │  │     └─ settings/page.tsx
│        │  └─ signout/
│        │     └─ route.ts               (POST → sign out → redirect /)
│        ├─ components/
│        │  ├─ ui/                       (shadcn primitives)
│        │  ├─ app-shell/
│        │  │  ├─ sidebar.tsx
│        │  │  ├─ top-bar.tsx
│        │  │  ├─ business-switcher.tsx
│        │  │  └─ user-menu.tsx
│        │  └─ auth/
│        │     ├─ email-signin-form.tsx
│        │     └─ google-signin-button.tsx
│        ├─ lib/
│        │  ├─ db/
│        │  │  ├─ server.ts              (createServerClient + createServiceClient)
│        │  │  ├─ browser.ts             (createBrowserClient)
│        │  │  └─ middleware.ts          (updateSession helper)
│        │  ├─ auth/
│        │  │  ├─ get-current-user.ts
│        │  │  ├─ get-current-memberships.ts
│        │  │  └─ require-business.ts
│        │  └─ utils.ts                  (cn helper)
│        └─ types/
│           └─ database.ts               (generated via supabase gen types)
└─ packages/
   └─ types/
      ├─ package.json
      └─ src/index.ts                    (re-export generated DB types)
```

## Implementation order

Do these in order. Verify each before moving on.

### 1. Monorepo scaffolding

- Root `package.json` with `"packageManager": "pnpm@10.0.0"`, `"private": true`, scripts `dev`, `build`, `lint`, `typecheck` that delegate to `turbo`.
- `pnpm-workspace.yaml`: `packages: ["apps/*", "packages/*"]`.
- `turbo.json` with pipeline for `dev` (persistent, no cache), `build`, `lint`, `typecheck`.
- Root `.gitignore` covers `node_modules`, `.next`, `.turbo`, `.env*` (but not `.env.example`), `*.log`.

### 2. Next.js app

- `cd apps/web && pnpm create next-app@latest . --ts --tailwind --app --src-dir --turbopack --import-alias "@/*"` or equivalent manual setup.
- Delete the default page; install Tailwind v4 theme tokens we’ll expand later.
- `pnpm dlx shadcn@latest init` with default CSS variables and `new-york` style.
- Add these shadcn components now: `button`, `input`, `label`, `form`, `card`, `dropdown-menu`, `avatar`, `separator`, `sheet`.

### 3. Env validation

Install `@t3-oss/env-nextjs zod`. Build `src/env.ts` that validates the four vars above with `zod` and exports a typed `env`. Import `@/env` from every module that reads `process.env` — never read `process.env.*` directly.

### 4. Supabase types generation

Add a root script `"db:types": "supabase gen types typescript --local --schema public > apps/web/src/types/database.ts"`. Run it once. The generated file must compile. Commit it.

### 5. Supabase clients

Install `@supabase/ssr @supabase/supabase-js`. Write three clients:

**`lib/db/browser.ts`** — for Client Components. Uses `createBrowserClient` from `@supabase/ssr`, typed with generated `Database`.

**`lib/db/server.ts`** — for Server Components + Server Actions + Route Handlers. Uses `createServerClient` from `@supabase/ssr` with the async `cookies()` pattern for Next.js 15:

```ts
import { cookies } from 'next/headers';
import { createServerClient as createSSR } from '@supabase/ssr';
import { env } from '@/env';
import type { Database } from '@/types/database';

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSR<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* called from a Server Component — ignore */ }
        },
      },
    }
  );
}

export function createServiceClient() {
  // service_role — never use in user-facing request handlers
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

**`lib/db/middleware.ts`** — `updateSession(request: NextRequest)` helper used by `middleware.ts` to refresh the auth cookie on every request.

### 6. Middleware

`apps/web/middleware.ts`:

- Calls `updateSession(request)`.
- If the path matches `/[bizSlug]/*` and there’s no user, redirect to `/signin?next={originalPath}`.
- If the path is `/onboarding` and there’s no user, redirect to `/signin`.
- If the path is `/signin` and there IS a user, redirect to `/onboarding` (the onboarding page will then forward to `/[bizSlug]/dashboard` if they already have a business).
- Use a matcher that excludes `/_next`, `/api` (except `/api/auth/*`), static assets, and the Next.js public assets.

### 7. Auth pages

**`/signin/page.tsx`** (Server Component):

- Centered card, two options: “Continue with Google” button and an email + “Send magic link” form.
- Email form is a Client Component that calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: ${APP_URL}/auth/callback }})`. Shows a success toast: “Check your email.”
- Google button calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ${APP_URL}/auth/callback }})`.

**`/auth/callback/route.ts`** (Route Handler):

- Reads `code` from the querystring.
- Calls `supabase.auth.exchangeCodeForSession(code)` on the server client.
- On success, redirects to `/onboarding` (which forwards to dashboard if a business already exists).
- On failure, redirects to `/signin?error=auth`.

**`/signout/route.ts`** (POST handler): calls `supabase.auth.signOut()`, redirects to `/`.

### 8. Auth helpers

**`lib/auth/get-current-user.ts`** — returns the authenticated user or `null`. Use in Server Components.

**`lib/auth/get-current-memberships.ts`** — returns the list of active memberships for the current user, with business joined. Orders by `accepted_at`.

**`lib/auth/require-business.ts`** — takes a `bizSlug` (UUID for v0.1), verifies the current user has an active membership, returns `{ user, business, role }`. Calls `notFound()` or redirects to `/onboarding` otherwise. Use at the top of every Server Component under `/[bizSlug]/*`.

### 9. Onboarding

**`/onboarding/page.tsx`** (Server Component):

- If user has zero active memberships → render the form.
- If user has ≥1 active membership → redirect to `/${firstMembership.business_id}/dashboard`.

**`/onboarding/actions.ts`**:

```ts
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/db/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const Input = z.object({
  legalName: z.string().min(1).max(120),
});

export async function createBusiness(formData: FormData) {
  const input = Input.parse({ legalName: formData.get('legalName') });
  const user = await getCurrentUser();
  if (!user) redirect('/signin');

  const sb = await createServerClient();
  const { data, error } = await sb
    .from('businesses')
    .insert({
      legal_name: input.legalName,
      owner_user_id: user.id,
    })
    .select('id')
    .single();

  if (error) throw error;

  // create_owner_membership trigger has already inserted the membership row
  redirect(`/${data.id}/dashboard`);
}
```

The form is a Client Component using `react-hook-form` + `zod`, submitting to the action. Single input, single submit button, Sonner toast on error.

### 10. Authenticated shell

**`/[bizSlug]/layout.tsx`** (Server Component):

- Calls `requireBusiness(params.bizSlug)`.
- Fetches user’s other memberships for the business switcher.
- Renders `<AppShell>` with sidebar + top bar + `{children}`.

**`<Sidebar>`**: collapsible on mobile (shadcn `Sheet`). Links: Dashboard, Inbox, Invoices, Customers, Reports, Settings. Active state via `usePathname()`. Each link uses a lucide icon.

**`<TopBar>`**: left = `<BusinessSwitcher>` dropdown (shows current business, switches to `/${otherBizId}/dashboard` on select, includes “+ New business” at the bottom). Right = `<UserMenu>` dropdown with the user’s avatar, name, “Sign out” (posts to `/signout`).

**`/[bizSlug]/dashboard/page.tsx`**: `<h1>Welcome, {firstName}</h1>` plus a muted subtitle “Your numbers will appear here as you connect accounts.” Nothing else.

All other routes (`inbox`, `invoices`, etc.): one-line placeholder `<EmptyState title="Coming soon" />` using shadcn `<Card>`.

## Common pitfalls to avoid

1. **Do not** import `createServiceClient` into a Client Component. Import path mistakes will ship a service-role key to the browser — catastrophic.
1. **Do not** use `process.env` directly outside `src/env.ts`. Next.js will inline stale values.
1. **Do not** forget the `cookies()` `await` in Next.js 15 — it’s async now. Same for `headers()`.
1. **Do not** mutate cookies from a Server Component — the `setAll` swallow-try-catch in `server.ts` is load-bearing.
1. **Do not** call `revalidatePath` from inside the `/onboarding/actions.ts` after the `redirect()` — redirect throws a special error and must be last.
1. **Do not** fetch tenant data with the service-role client in a user-facing request — always use the session client so RLS runs.
1. **Do not** invent schema. The migration files in `supabase/migrations/` are the source of truth. If you think a column is missing, flag it — do not add it.
1. **Do not** add shadcn components you don’t use yet. The list in Task 2 is the only allowed set for v0.1.

## Verification commands

Run these in order. All must pass:

```bash
pnpm install
supabase start
supabase db reset                    # applies migrations + seed
pnpm db:types                        # regenerates Database types
pnpm --filter web typecheck          # zero errors
pnpm --filter web lint               # zero errors
pnpm dev                             # runs on :3000
```

Then walk the eight items in “Definition of done” by hand. Confirm each one.

## When you’re done

Print a one-paragraph summary of what was built, any deviations from this prompt (with justification), and the first three things a human should review before merging. Then stop. Do not continue into Day 31–60 work (transactions, categorization, Plaid) without an explicit new prompt.

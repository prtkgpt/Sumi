# Sumi

A simple bookkeeping app for US small businesses.

## Stack

Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · Stack Auth · Neon Postgres · Drizzle ORM · Vercel.

See `CLAUDE.md` for engineering conventions and the v0.1 scope.

## Quick start

```bash
pnpm install
cp .env.example .env                     # fill in Neon + Stack Auth keys
pnpm --filter @sumi/db db:migrate        # apply migrations to Neon
pnpm dev                                 # http://localhost:3000
```

## Layout

```
apps/web          Next.js app (Vercel)
packages/db       Drizzle schema + Neon client
packages/types    Shared TS types
```

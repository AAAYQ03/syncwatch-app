# CLAUDE.md — SyncWatch Project Context

## What this project is
SyncWatch: a web app for watching YouTube / Bilibili videos in real-time sync with friends. See `SPEC.md` for user stories and `ARCHITECTURE.md` for the full technical design (C4 diagrams, data model, real-time channel design).

**Team:** Product Owner Yewen Zhou; Developer Youqian Cui. Private repo `GIX-Luyao/final-project-codebase-yzhou30-ux`.

## Stack
- **Framework:** Next.js 14 App Router + TypeScript strict
- **Database / Realtime:** Supabase (Postgres + Realtime broadcast channels)
- **Styling:** Tailwind CSS
- **Testing:** Vitest + Testing Library + jsdom
- **Package manager:** pnpm 10
- **Deploy:** Vercel (planned)

## Common commands
```bash
pnpm dev          # start Next.js dev server
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint via next
pnpm test         # vitest run (single pass)
pnpm test:watch   # vitest watch
```

## Conventions
- **TypeScript strict mode** + `noUncheckedIndexedAccess`. Don't disable.
- **Path alias:** `@/*` → `src/*`.
- **Components:** PascalCase files in `src/components/`. Prefer server components; mark `"use client"` only when you need state, effects, or browser APIs.
- **Hooks:** `src/hooks/useXxx.ts`, always client-only.
- **API routes:** `src/app/api/*/route.ts`. Validate inputs with Zod at every entry point.
- **Styling:** Tailwind utilities inline; avoid CSS files beyond `globals.css`.
- **No user auth:** session identified by a UUID in localStorage (`useSession`). See ARCHITECTURE §4.3.
- **Realtime events:** one broadcast channel per room (`room:{id}`). Event schema lives in `src/types/index.ts` (`RealtimeEvent` union). Always include a monotonic `ts` so clients can drop stale events.

## Supabase
- Client factory: `src/lib/supabase.ts` → `getBrowserSupabase()` / `getServerSupabase()`.
- Schema: `supabase/migrations/0001_init.sql`. Apply via Supabase Dashboard SQL editor or `supabase db push`.
- RLS is enabled with permissive anon policies (SPEC has no auth). Tighten before shipping to untrusted users.

## Directory map
```
src/
  app/          # App Router pages + API routes
  components/   # React components
  hooks/        # Client-only hooks
  lib/          # Pure utilities + supabase client
  types/        # Shared TS types (Room, RoomMember, RealtimeEvent, ...)
supabase/
  migrations/   # SQL migrations (numbered)
tests/          # Vitest specs
```

## Issue plan
8 issues tracking the 8 milestones in SPEC §"Issue Decomposition". Detailed breakdown lives in the project plan; current phase is tracked via the `dev` branch and GitHub Issues.

## Don'ts
- Don't introduce a separate Express/Socket.IO server — Supabase Realtime is the real-time transport.
- Don't bypass the `RealtimeEvent` union when broadcasting; add a new variant instead.
- Don't commit `.env.local` (it's in `.gitignore`). Use `.env.local.example` as the template.
- Don't call Supabase directly from server-side code without `getServerSupabase()` (keeps the client contract consistent and lets us swap key handling later).

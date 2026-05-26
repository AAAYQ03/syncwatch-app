# SyncWatch 🎬

Watch YouTube & Bilibili videos in perfect sync with your friends — no more awkward "3, 2, 1, play!"

## 🌐 Live Demo

**https://510-syncwatch.vercel.app**

Open the link, create a room, share the 6-character code with a friend, and you're watching together. No account required.

## What It Does

SyncWatch lets you create a watch room, paste a video link, and enjoy synchronized playback with anyone who joins. Play, pause, and seek are mirrored in real time across all participants. Your watch history is saved so you can pick up right where you left off.

## Core Features

- **Room creation & sharing** — Generate a room and invite friends via link or code.
- **Avatar grab lobby** — Preset character avatars, first-come-first-served claiming (like Ultimate Chicken Horse). No registration needed; latecomers get a "?" avatar.
- **Ready check & countdown** — Everyone hits "Ready", then a 3-2-1 countdown auto-starts playback.
- **Auto-fetch video title** — Paste a YouTube or Bilibili URL; the title appears automatically.
- **Real-time sync** — All playback controls are mirrored to every participant within ≤500 ms.
- **Buffering detection** *(in progress)* — If anyone is loading, playback pauses for all with a "Waiting for [avatar]..." notice.
- **Floating emoji reactions** *(in progress)* — Send reactions that float up over the video, visible to everyone.
- **Watch history & resume** *(in progress)* — Browse past sessions and continue from your last position.

## Team

| Role | Name |
|------|------|
| Product Owner | Yewen Zhou |
| Developer | Youqian Cui |

## Timeline

| Check-in | Date | Expected Progress | Status |
|----------|------|-------------------|--------|
| **Check-in 1** | Apr 5, 2026 | Project scaffolding complete; room create/join working; lobby page with real-time avatar grab and ready-check countdown functional. (Issues #1–#3) | ✅ Completed — PRs #12, #13, #14 merged |
| **Check-in 2** | Apr 30, 2026 | Video URL auto-fetch working; embedded player with synchronized playback (play/pause/seek) across multiple clients. (Issues #4–#5) | ✅ Completed — PRs #15, #16 reviewed & approved |
| **Check-in 3** | May 15, 2026 | Buffering auto-pause, floating emoji reactions, watch history & resume all implemented. (Issues #6–#7) | 🔲 Upcoming |
| **Final Delivery** | May 25, 2026 | UI polish (avatar animations, countdown transitions), responsive design, deployed to public URL. Demo-ready. (Issue #8) | 🔲 Upcoming |

## Mid-Point Check (May 5, 2026)

**Developer status: ✅ On track**

Issues #1–#5 are complete and merged/approved, covering project scaffolding, room creation, lobby with avatar grab & ready check, video URL auto-fetch, and synchronized playback. This represents 5 of 8 issues delivered by the midpoint, ahead of the original timeline.

**Tested and verified:**
- Room creation and join via code/link — working
- Avatar grab lobby with real-time claiming — working
- Ready check with 3-2-1 countdown — working
- YouTube & Bilibili URL paste with auto-fetched title — working
- Synchronized play/pause/seek across two browser windows — working (~300ms latency)

**Known limitations filed:** See Issue “Known limitations & considerations (living tracker) #17” for mobile playback, fullscreen sync, and other considerations.

**Remaining work (Issues #6–#8):**
- Buffering detection & auto-pause
- Floating emoji reactions
- Watch history & resume
- UI polish & deployment

## Tech Stack

- **Framework** — Next.js 14 (App Router) + TypeScript strict mode
- **Real-time + Database** — Supabase (Postgres + Realtime broadcast channels)
- **Player** — YouTube IFrame API + Bilibili iframe embed
- **Styling** — Tailwind CSS
- **Hosting** — Vercel (frontend + API routes) + Supabase (DB)
- **CI** — GitHub Actions (lint + typecheck + test on every push and PR)
- **Security** — Automated TruffleHog secret scan on every push + PR + weekly cron; see `SECURITY.md` for threat model and the manual review checklist

See `ARCHITECTURE.md` for the C4 diagrams, data model, and design rationale.

## Getting Started (local development)

## Getting Started

```bash
# clone & install
git clone https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux.git syncwatch
cd syncwatch
pnpm install                    # uses pnpm@10 from package.json's packageManager field

# configure
cp .env.example .env.local      # then fill in your Supabase URL + anon key
# Apply the three SQL migrations in supabase/migrations/ via the Supabase
# Dashboard SQL editor (in numbered order: 0001 → 0002 → 0003).

# run
pnpm dev                        # http://localhost:3000
```

### Required environment variables

| Name | Where it's used | How to get it |
|------|-----------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server Supabase client | Supabase Dashboard → Project Settings → API → "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server Supabase client | Supabase Dashboard → Project Settings → API → "anon public" (or `sb_publishable_*` for newer projects) |

Both are safe to expose in the client bundle. **Never commit `.env.local`** — it's gitignored. The `anon` key is protected by row-level security policies (see `supabase/migrations/0001_init.sql`).

## Deployment

### Production environment

- **Frontend / API routes** — Vercel: https://510-syncwatch.vercel.app
- **Database / Realtime** — Supabase project `pbygfrwmptwzfsfajbve.supabase.co`
- **Production env vars** — Configured in the Vercel project's Environment Variables tab (Production scope). Not stored anywhere in this repo.

### Automated deployment pipeline

```
        GIX-Luyao/main (this repo)
                  │
                  │  GitHub Action: .github/workflows/mirror-to-deploy.yml
                  │  fires on push to main, mirrors HEAD to ↓
                  ▼
        AAAYQ03/syncwatch-app (public deploy mirror)
                  │
                  │  Vercel GitHub Integration auto-detects push
                  ▼
        Production build + deploy to https://510-syncwatch.vercel.app

git clone https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux.git
cd final-project-codebase-yzhou30-ux
pnpm install

# set up environment
cp .env.local.example .env.local
# fill in your Supabase URL and anon key

# run locally
pnpm dev

```

**Why the mirror?** Vercel's free Hobby plan can't deploy private repositories belonging to a GitHub organization (this repo is in the `GIX-Luyao` org). The workaround is to keep a public mirror under the developer's personal account and connect Vercel to that. **This is the deployment pattern explicitly recommended by the course instructor** ("add a public personal repo as a remote and use it for deployment; use GitHub Classroom for submission") — the mirror workflow keeps the two in sync.

**To enable the auto-mirror**, the repo admin must add a `DEPLOY_MIRROR_TOKEN` secret (a GitHub personal access token with `Contents: write` on `AAAYQ03/syncwatch-app`). See the workflow file for details. Until that secret is configured, the developer mirrors manually with:

```bash
git push deploy main:main       # where "deploy" remote = AAAYQ03/syncwatch-app
```

### Manual operations cheat sheet

```bash
# CI / PR / class submission
git push origin <branch>

# Trigger production deploy (until secret-based auto-mirror is set up)
git push deploy <local-ref>:main
```

## Project Structure

```
syncwatch/
├── src/
│   ├── app/               # Next.js App Router (pages + API routes)
│   │   ├── api/           # rooms, video-info, members
│   │   └── room/[id]/     # lobby + watch room
│   ├── components/        # AvatarGrid, VideoPlayer, VideoUrlInput, ...
│   ├── hooks/             # useSession, useLobby, useWatchRoom, usePlaybackSync
│   ├── lib/               # supabase client, room-code, video-url, youtube-api
│   └── types/             # shared TS types
├── supabase/migrations/   # numbered SQL files (0001, 0002, 0003)
├── tests/                 # Vitest specs
├── ARCHITECTURE.md        # C4 + data model + tech stack rationale
├── SPEC.md                # User stories + acceptance criteria
└── CLAUDE.md              # AI-assistant project context
```

## Contributing

This is a course project; PRs are accepted from the contracted developer only. Workflow:

1. Branch from `dev` (e.g., `feature/issue-N-short-name`)
2. Implement, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` locally
3. Open a PR referencing the GitHub Issue it closes (use the template)
4. Wait for proposer review + CI green, then merge

## License

MIT

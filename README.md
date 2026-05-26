# SyncWatch 🎬

Watch YouTube & Bilibili videos in perfect sync with your friends — no more awkward "3, 2, 1, play!"

## 🌐 Live Demo

**https://510-syncwatch.vercel.app**

Open the link, create a room, share the 6-character code with a friend, and you're watching together. No account required.

## What It Does

SyncWatch lets you create a watch room, paste a video link, and enjoy synchronized playback with anyone who joins. Play, pause, and seek are mirrored in real time across all participants, and reactions float over the video so the whole room can feel the moment.

## Core Features

- **Room creation & sharing** — Generate a room and invite friends via link or code.
- **Avatar grab lobby** — Preset character avatars, first-come-first-served claiming (like Ultimate Chicken Horse). No registration needed; latecomers get a "?" avatar.
- **Ready check & countdown** — Everyone hits "Ready", then a 3-2-1 countdown auto-starts playback.
- **Auto-fetch video title** — Paste a YouTube or Bilibili URL; the title appears automatically.
- **Real-time sync** — All playback controls are mirrored to every participant within ≤500 ms.
- **Buffering auto-pause** — If anyone is loading, playback pauses for all with a "Waiting for [avatar]..." overlay; auto-resumes once everyone's caught up.
- **Floating emoji reactions** — Send reactions that float up over the video, visible to everyone in real time.

## Team

| Role | Name |
|------|------|
| Product Owner | Yewen Zhou |
| Developer | Youqian Cui |

## Timeline

| Check-in | Date | Scope | Status |
|----------|------|-------|--------|
| **Check-in 1** | Apr 5, 2026 | Project scaffolding; room create/join; lobby with avatar grab & ready-check countdown. (Issues #1–#3) | ✅ Completed — PRs [#12](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/12), [#13](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/13), [#14](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/14), [#24](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/24) merged |
| **Check-in 2** | Apr 30, 2026 | Video URL auto-fetch; embedded player with synchronized play/pause/seek. (Issues #4–#5) | ✅ Completed — PRs [#15](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/15), [#16](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/16) merged |
| **Check-in 3** | May 15, 2026 | Buffering auto-pause + floating emoji reactions. (Issue #6) | ✅ Completed — PR [#21](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/21) merged |
| **Final Delivery** | May 25, 2026 | Deployment polish, automated tests (41 passing), security review, bug fixes (#18, #19). (Issue #8 + checkpoint requirements) | ✅ Completed — PRs [#20](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/20), [#22](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/22), [#23](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/23), [#25](https://github.com/GIX-Luyao/final-project-codebase-yzhou30-ux/pull/25) merged |

## Tech Stack

- **Framework** — Next.js 14 (App Router) + TypeScript strict mode
- **Real-time + Database** — Supabase (Postgres + Realtime broadcast channels)
- **Player** — YouTube IFrame API + Bilibili iframe embed
- **Styling** — Tailwind CSS
- **Hosting** — Vercel (frontend + API routes) + Supabase (DB)
- **CI** — GitHub Actions (lint + typecheck + 41 tests on every push and PR)
- **Security** — Automated TruffleHog secret scan on every push + PR + weekly cron; see `SECURITY.md` for threat model and the manual review checklist

See `ARCHITECTURE.md` for the C4 diagrams, data model, and design rationale.

## Getting Started (local development)

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
│   ├── components/        # AvatarGrid, VideoPlayer, VideoUrlInput,
│   │                      # BufferingOverlay, EmojiReactionBar, ...
│   ├── hooks/             # useSession, useLobby, useWatchRoom,
│   │                      # useRoomMembers, usePlaybackSync
│   ├── lib/               # supabase client, room-code, video-url,
│   │                      # youtube-api, lobby-rules, avatars
│   └── types/             # shared TS types
├── supabase/migrations/   # numbered SQL files (0001, 0002, 0003)
├── tests/                 # Vitest specs (41 tests across 5 files)
├── ARCHITECTURE.md        # C4 + data model + tech stack rationale
├── SECURITY.md            # threat model + secret-scan pipeline
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

# SyncWatch 🎬

Watch YouTube & Bilibili videos in perfect sync with your friends — no more awkward "3, 2, 1, play!"

## What It Does

SyncWatch lets you create a watch room, paste a video link, and enjoy synchronized playback with anyone who joins. Play, pause, and seek are mirrored in real time across all participants. Your watch history is saved so you can pick up right where you left off.

## Core Features

- **Room creation & sharing** — Generate a room and invite friends via link or code.
- **Avatar grab lobby** — Preset character avatars, first-come-first-served claiming (like Ultimate Chicken Horse). No registration needed; latecomers get a "?" avatar.
- **Ready check & countdown** — Everyone hits "Ready", then a 3-2-1 countdown auto-starts playback.
- **Auto-fetch video title** — Paste a YouTube or Bilibili URL; the title appears automatically.
- **Real-time sync** — All playback controls are mirrored to every participant within milliseconds.
- **Buffering detection** — If anyone is loading, playback pauses for all with a "Waiting for [avatar]..." notice.
- **Floating emoji reactions** — Send reactions that float up over the video, visible to everyone.
- **Watch history & resume** — Browse past sessions and continue from your last position.

## Team

| Role | Name |
|------|------|
| Product Owner | Yewen Zhou |
| Developer | Youqian Cui |

## Timeline

| Check-in | Date | Expected Progress |
|----------|------|-------------------|
| **Check-in 1** | Apr 5, 2026 | Project scaffolding complete; room create/join working; lobby page with real-time avatar grab and ready-check countdown functional. (Issues #1–#3) |
| **Check-in 2** | Apr 30, 2026 | Video URL auto-fetch working; embedded player with synchronized playback (play/pause/seek) across multiple clients. (Issues #4–#5) |
| **Check-in 3** | May 15, 2026 | Buffering auto-pause, floating emoji reactions, watch history & resume all implemented. (Issues #6–#7) |
| **Final Delivery** | May 25, 2026 | UI polish (avatar animations, countdown transitions), responsive design, deployed to public URL. Demo-ready. (Issue #8) |

## Tech Stack (tentative)

React / Next.js · Supabase (Postgres + Realtime) · Vercel · YouTube IFrame API

> Stack is negotiable — see `SPEC.md` for details.

## Getting Started

```bash
# clone & install
git clone <repo-url>
cd syncwatch
npm install

# run locally
npm run dev
```

## License

MIT

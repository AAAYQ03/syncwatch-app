# SPEC.md — SyncWatch

## Project Overview

**SyncWatch** is a web app that lets remote friends watch YouTube / Bilibili videos together in real-time. One person creates a room, pastes a video link, and everyone in the room sees synchronized playback — pause, seek, and resume are mirrored instantly.

## Team

| Role | Name |
|------|------|
| Product Owner | Yewen Zhou |
| Developer | Youqian Cui |

**Agreed Development Fee:** 25 GIX Bucks

---

## User Stories

1. **Create a Room** — As a user, I want to create a watch room so that I can invite friends to watch together.
2. **Join a Room** — As a user, I want to join an existing room via a link or room code so that I can watch with the host.
3. **Paste & Auto-fetch** — As a host, I want to paste a YouTube or Bilibili URL and have the app automatically fetch and display the video title so that everyone knows what we're watching.
4. **Synchronized Playback** — As a room member, I want play / pause / seek actions to be mirrored to all participants in real time so that we stay perfectly in sync.
5. **Watch History** — As a user, I want to see a list of past sessions (video title, date, progress) so that I can resume or revisit them.
6. **Resume Progress** — As a user, I want to resume a previously watched video from where I left off so that I don't lose my place.
7. **Avatar Grab (Lobby)** — As a user joining a room, I want to see a set of preset character avatars and race to claim one in real time (first-come-first-served), so I have a fun identity for the session without needing to register. Latecomers who miss all avatars get a "?" placeholder.
8. **Ready Check & Countdown** — As a room member, I want a "Ready" button that collects everyone's confirmation before a 3-2-1 countdown auto-starts playback, so nobody misses the beginning.
9. **Floating Emoji Reactions** — As a viewer, I want to send emoji reactions that float up over the video (visible to all participants in real time), so we can share reactions without breaking the viewing experience.
10. **Buffering Detection & Auto-Pause** — As a room member, I want the system to detect when any participant is buffering and automatically pause playback for everyone (with a notice like "Waiting for XX..."), then auto-resume once everyone is loaded.

### Nice-to-Have (stretch)

11. User-uploaded video support.
12. Group library archive with member ratings.
13. Year-end summary / stats (total watch time, most-watched, etc.).

---

## Desired Specifications

### Pages / Views

| # | Page | Description |
|---|------|-------------|
| 1 | **Home / Dashboard** | Create a new room or join an existing one; view personal watch history. |
| 2 | **Lobby (Avatar Select)** | After joining, players see a grid of preset character avatars and race to claim one in real time. A "Ready" button per player; once all ready, a 3-2-1 countdown starts playback. |
| 3 | **Watch Room** | Embedded video player, live avatar presence bar, synced playback controls, floating emoji reactions, buffering indicator, current video title. |
| 4 | **History** | List of past sessions with video title, date, and a "Resume" button. |

### Data Model

**rooms**
| Column | Type | Note |
|--------|------|------|
| id | uuid / string | Primary key / room code |
| video_url | text | YouTube or Bilibili link |
| video_title | text | Auto-fetched from URL |
| playback_state | jsonb | `{ playing: bool, current_time: float }` |
| avatar_pool | jsonb | Array of available preset avatar ids (e.g. `["cat","dog","fox","panda"]`); pool size ≈ expected group size, set by host on creation |
| created_at | timestamp | |

**room_members** (real-time presence)
| Column | Type | Note |
|--------|------|------|
| id | serial | Primary key |
| room_id | fk → rooms | |
| session_id | text | Browser session identifier |
| display_name | text | Optional nickname |
| avatar_id | text | Claimed avatar from pool, or `"?"` if none left |
| is_ready | boolean | Ready-check status |
| is_buffering | boolean | Current buffering state, reported by client |
| joined_at | timestamp | |

**watch_history**
| Column | Type | Note |
|--------|------|------|
| id | serial | Primary key |
| room_id | fk → rooms | |
| user_id | text | Session id or display name |
| last_position | float | Seconds into video |
| watched_at | timestamp | |

### Real-Time Sync Mechanism

- Use **WebSocket** (e.g., Supabase Realtime, Socket.IO, or Liveblocks) to broadcast events to all room participants.
- **Playback events:** `play`, `pause`, `seek` — one client acts as source of truth; others follow within ≤500 ms drift.
- **Presence events:** `avatar_claim`, `ready_toggle`, `buffering_state` — updates the lobby and watch room UI for all members.
- **Reaction events:** `emoji_reaction { emoji, sender_avatar }` — triggers a floating animation on all clients.
- **Buffering logic:** Each client reports its `YT.PlayerState.BUFFERING` status. If any member is buffering, the server broadcasts a global pause with a "Waiting for [avatar]..." overlay. Auto-resumes when all members report `PLAYING` or `PAUSED`.

### Stack (negotiable)

The following is a suggested stack — open to the developer's recommendation:

- **Frontend:** React / Next.js
- **Backend / DB:** Supabase (Postgres + Realtime) or a lightweight Express + Socket.IO server
- **Hosting:** Vercel / Railway
- **Video Embed:** YouTube IFrame API, Bilibili embed

---

## Issue Decomposition

The project is broken into **8 GitHub Issues** corresponding to incremental milestones:

| # | Issue Title | Description |
|---|-------------|-------------|
| 1 | **Project setup & repo scaffolding** | Initialize repo, choose stack, set up dev environment, CI basics. |
| 2 | **Room creation & joining** | Implement create-room and join-room flows; generate shareable room link / code; host sets avatar pool size. |
| 3 | **Lobby: avatar grab & ready check** | Build the lobby page with a grid of preset character avatars. First-come-first-served claiming via WebSocket. "?" fallback for latecomers. Ready button per player; 3-2-1 countdown when all ready. |
| 4 | **Video URL paste & title auto-fetch** | Accept a YouTube / Bilibili URL, extract and display the video title (oEmbed or page scraping). |
| 5 | **Embedded player & synchronized playback** | Render the video via iframe / player API; implement WebSocket-based sync for play / pause / seek across all participants. |
| 6 | **Buffering detection & emoji reactions** | Report buffering state per client; auto-pause for all with "Waiting for [avatar]..." overlay. Emoji reaction bar that broadcasts floating animations to all viewers. |
| 7 | **Watch history & resume** | Persist session data; build History page with resume capability. |
| 8 | **Polish, testing & deployment** | UI polish (avatar animations, countdown transitions, responsive design), edge-case handling, deploy to production. |

---

## Acceptance Criteria (Definition of Done)

- A user can create a room, paste a YouTube or Bilibili link, and see the video title auto-populated.
- Joining users enter a lobby where they race to grab a preset avatar in real time; latecomers get a "?" avatar.
- All members click "Ready"; a 3-2-1 countdown auto-starts synchronized playback.
- Play / pause / seek are mirrored across all participants within ≤500 ms.
- If any participant is buffering, all others are auto-paused with a "Waiting for [avatar]..." notice; playback resumes automatically.
- Users can send emoji reactions that float up over the video for all participants.
- Watch history is persisted and a user can resume a previous session.
- The app is deployed and accessible via a public URL.

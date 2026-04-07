# ARCHITECTURE.md — SyncWatch

## 1. System Context (C4 — Level 1)

```
                         +---------------------+
                         |    SyncWatch User    |
                         | (Browser / Mobile)   |
                         +----------+----------+
                                    |
                                    | HTTPS / WSS
                                    v
                         +----------+----------+
                         |   SyncWatch Web App  |
                         |   (Next.js on Vercel)|
                         +----------+----------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
          +---------+---------+          +----------+----------+
          |     Supabase      |          |   External APIs     |
          | Postgres + Realtime|         | YouTube oEmbed      |
          | (DB, Auth, WS)    |          | Bilibili oEmbed     |
          +-------------------+          +---------------------+
```

**Users** interact with SyncWatch through a browser. The **Next.js app** (hosted on Vercel) serves the UI and API routes. **Supabase** provides the database, real-time WebSocket channels, and row-level security. **External APIs** (YouTube/Bilibili oEmbed endpoints) supply video metadata.

---

## 2. Container Diagram (C4 — Level 2)

```
+------------------------------------------------------------------+
|                        Vercel Edge Network                       |
|                                                                  |
|  +---------------------------+  +-----------------------------+  |
|  |   Next.js Frontend (App)  |  |   Next.js API Routes        |  |
|  |                           |  |                             |  |
|  |  /          Home/Dashboard|  |  /api/rooms      CRUD rooms |  |
|  |  /room/[id] Lobby + Watch |  |  /api/video-info oEmbed     |  |
|  |  /history   Watch History |  |  /api/history    History     |  |
|  +-------------+-------------+  +-------------+---------------+  |
|                |                              |                  |
+------------------------------------------------------------------+
                 |                              |
                 | WSS (Supabase Realtime)      | REST (Supabase Client)
                 v                              v
+------------------------------------------------------------------+
|                         Supabase                                 |
|                                                                  |
|  +------------------+  +------------------+  +-----------------+ |
|  |    Postgres DB   |  | Realtime Engine  |  |   Row-Level     | |
|  |  rooms           |  | (WebSocket)      |  |   Security      | |
|  |  room_members    |  |                  |  |                 | |
|  |  watch_history   |  | Channels:        |  |                 | |
|  |                  |  |  room:{id}       |  |                 | |
|  +------------------+  +------------------+  +-----------------+ |
+------------------------------------------------------------------+
```

### Key Containers

| Container | Technology | Responsibility |
|-----------|-----------|----------------|
| **Frontend SPA** | Next.js (App Router) + React 18 | UI rendering, player embed, local state, WebSocket subscription |
| **API Routes** | Next.js Route Handlers | Room CRUD, video metadata proxy, history persistence |
| **Database** | Supabase Postgres | Persistent storage for rooms, members, watch history |
| **Realtime Engine** | Supabase Realtime (Phoenix Channels) | Broadcast playback events, presence, emoji reactions |

---

## 3. Component Diagram (C4 — Level 3)

### Frontend Components

```
App Shell
 |
 +-- HomePage
 |    +-- CreateRoomForm        (room name, avatar pool size)
 |    +-- JoinRoomInput         (room code / link)
 |    +-- WatchHistoryPreview   (recent 5 sessions)
 |
 +-- LobbyPage (/room/[id]/lobby)
 |    +-- AvatarGrid            (preset avatars, real-time claim state)
 |    +-- ReadyCheckPanel       (per-member ready status)
 |    +-- CountdownOverlay      (3-2-1 animation)
 |
 +-- WatchRoomPage (/room/[id])
 |    +-- VideoPlayer           (YouTube IFrame API / Bilibili embed)
 |    +-- SyncController        (play/pause/seek broadcast & receive)
 |    +-- PresenceBar           (avatar icons, buffering indicators)
 |    +-- EmojiReactionBar      (emoji picker + floating animations)
 |    +-- BufferingOverlay      ("Waiting for [avatar]...")
 |    +-- VideoUrlInput         (paste URL, auto-fetch title)
 |
 +-- HistoryPage (/history)
      +-- SessionList           (past rooms, video title, date, resume btn)
```

### Real-Time Channel Design

Each room subscribes to a single Supabase Realtime channel: `room:{room_id}`

| Event Type | Payload | Direction |
|-----------|---------|-----------|
| `playback:play` | `{ current_time }` | broadcast |
| `playback:pause` | `{ current_time }` | broadcast |
| `playback:seek` | `{ current_time }` | broadcast |
| `avatar:claim` | `{ session_id, avatar_id }` | broadcast |
| `ready:toggle` | `{ session_id, is_ready }` | broadcast |
| `buffering:state` | `{ session_id, is_buffering }` | broadcast |
| `emoji:reaction` | `{ emoji, sender_avatar }` | broadcast |
| `video:set` | `{ video_url, video_title }` | broadcast |

**Sync strategy:** The first member to join acts as the **host** (source of truth). All playback mutations originate from any member but are relayed through the channel. Clients reconcile by snapping to the broadcast `current_time` if drift exceeds 500ms.

---

## 4. Data Model

### 4.1 Entity-Relationship Diagram

```
+----------------+       1:N       +------------------+
|     rooms      +------------------>  room_members    |
+----------------+                 +------------------+
| id (uuid) PK  |                 | id (serial) PK   |
| room_code      |                 | room_id (fk)     |
| video_url      |                 | session_id       |
| video_title    |                 | display_name     |
| playback_state |                 | avatar_id        |
| avatar_pool    |                 | is_ready         |
| host_session_id|                 | is_buffering     |
| created_at     |                 | joined_at        |
+-------+--------+                 +------------------+
        |
        | 1:N
        v
+------------------+
|  watch_history   |
+------------------+
| id (serial) PK  |
| room_id (fk)    |
| session_id       |
| video_url        |
| video_title      |
| last_position    |
| watched_at       |
+------------------+
```

### 4.2 Table Definitions

```sql
-- Rooms
CREATE TABLE rooms (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code      text UNIQUE NOT NULL,          -- 6-char alphanumeric
  video_url      text,
  video_title    text,
  playback_state jsonb DEFAULT '{"playing": false, "current_time": 0}'::jsonb,
  avatar_pool    jsonb NOT NULL,                 -- ["cat","dog","fox","panda","bear","owl"]
  host_session_id text,                          -- session that created the room
  created_at     timestamptz DEFAULT now()
);

-- Room Members (presence)
CREATE TABLE room_members (
  id           serial PRIMARY KEY,
  room_id      uuid REFERENCES rooms(id) ON DELETE CASCADE,
  session_id   text NOT NULL,
  display_name text,
  avatar_id    text DEFAULT '?',
  is_ready     boolean DEFAULT false,
  is_buffering boolean DEFAULT false,
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(room_id, session_id)
);

-- Watch History
CREATE TABLE watch_history (
  id            serial PRIMARY KEY,
  room_id       uuid REFERENCES rooms(id) ON DELETE SET NULL,
  session_id    text NOT NULL,
  video_url     text,
  video_title   text,
  last_position real DEFAULT 0,
  watched_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_watch_history_session ON watch_history(session_id);
CREATE INDEX idx_rooms_code ON rooms(room_code);
```

### 4.3 Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No user auth** | SPEC requires no registration; sessions identified by browser `session_id` (UUID stored in localStorage) |
| **`room_code` as 6-char string** | Human-friendly sharing; UUID used internally for DB joins |
| **`playback_state` as JSONB** | Flexible schema for future extensions (playback speed, loop mode) |
| **`avatar_pool` as JSONB array** | Variable pool size set by host; no separate table needed for a small fixed set |
| **`watch_history` denormalizes video info** | Rooms may be deleted; history must survive independently |
| **`host_session_id` on rooms** | Identifies source-of-truth client for sync conflict resolution |

---

## 5. Tech Stack Justification

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 14 (App Router) | Server components for fast initial load; API routes eliminate a separate backend; React ecosystem for rich interactivity. The SPEC suggests React/Next.js and the team is comfortable with it. |
| **Database** | Supabase (Postgres) | Managed Postgres with built-in Realtime (WebSocket) — one service for both persistence and real-time sync. Eliminates the need to run a separate Socket.IO server. Free tier is sufficient for this project's scale. |
| **Real-Time** | Supabase Realtime (Broadcast) | Native integration with the DB layer. Broadcast channels support arbitrary JSON events without DB writes — ideal for ephemeral playback/emoji events. Presence tracking is built in. |
| **Video Embed** | YouTube IFrame API + Bilibili iframe | YouTube IFrame API provides programmatic control (play, pause, seek, state events including `BUFFERING`). Bilibili embedded via standard iframe with postMessage-based control where available. |
| **Styling** | Tailwind CSS | Utility-first approach accelerates UI development with AI tools; no context-switching to CSS files. Well-supported by Cursor/Claude Code. |
| **Deployment** | Vercel | Zero-config deployment for Next.js; automatic preview deployments per PR; global CDN. Free tier covers the project. |
| **Package Manager** | pnpm | Fast, disk-efficient; strict dependency resolution prevents phantom deps. |

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|----------------|
| Socket.IO + Express | Requires a separate server process, adds deployment complexity (need Railway/Fly.io). Supabase Realtime covers the same use case with zero extra infrastructure. |
| Streamlit (Python) | Not suitable for real-time multi-user interactive applications. No WebSocket broadcast capability. |
| Firebase | Comparable to Supabase but Firestore's document model is less natural for relational data (room-member joins, history queries). |
| LiveKit / Liveblocks | Powerful but overkill for this scope; adds vendor complexity and cost. |

---

## 6. Agentic Engineering Plan

All development will use **AI-first engineering** with Claude Code and Cursor as primary tools.

### 6.1 AI Tool Allocation

| Tool | Usage |
|------|-------|
| **Claude Code (CLI)** | Architecture design, complex multi-file implementations, debugging, git operations, PR creation, test writing, code review responses |
| **Cursor (IDE)** | In-editor AI completions, inline edits, quick iterations on UI components |

### 6.2 Development Workflow per Issue

```
1. Read the GitHub Issue and acceptance criteria
2. Create a feature branch: git checkout -b issue-N-description
3. Use Claude Code to scaffold the implementation:
   - Break the issue into sub-tasks
   - Implement each sub-task with AI assistance
   - Write tests alongside implementation
4. Self-review: Use Claude Code to review the diff for:
   - Security vulnerabilities (XSS, injection)
   - Missing error handling at system boundaries
   - Adherence to acceptance criteria
5. Push and create PR referencing the Issue
6. Address PR review feedback using Claude Code
7. Merge after approval
```

### 6.3 AI-Assisted Quality Gates

| Gate | How AI Is Used |
|------|---------------|
| **Implementation** | Claude Code generates feature code from Issue requirements; developer verifies correctness |
| **Testing** | Claude Code writes unit tests (Vitest) and integration tests; developer validates coverage |
| **Security Review** | Claude Code scans for OWASP top-10 issues before each PR |
| **Code Review Response** | Claude Code drafts responses to reviewer comments; developer verifies and submits |
| **Bug Fixes** | Claude Code analyzes bug reports and proposes fixes; developer validates against reproduction steps |

### 6.4 CLAUDE.md Strategy

A `CLAUDE.md` file will be maintained at the repo root with:
- Project context (what SyncWatch does, who the stakeholders are)
- Coding conventions (TypeScript strict mode, Tailwind for styling, component naming)
- File structure expectations
- Common commands (`pnpm dev`, `pnpm test`, `pnpm lint`)
- Supabase-specific patterns (client initialization, channel subscription patterns)

This file ensures that every Claude Code session starts with consistent project context, reducing hallucination and improving code quality across sessions.

### 6.5 Issue-to-Delivery Map

| Issue | Key AI Tasks | Estimated Complexity |
|-------|-------------|---------------------|
| #1 Project Setup | Scaffold Next.js app, configure Supabase, set up CI | Low |
| #2 Room Create/Join | CRUD API routes, room code generation, join flow UI | Medium |
| #3 Lobby & Avatar Grab | Real-time avatar claiming, ready check, countdown timer | High |
| #4 Video URL & Title | oEmbed API integration, URL validation, title display | Low |
| #5 Synced Playback | YouTube IFrame API integration, WebSocket sync logic, drift correction | High |
| #6 Buffering & Emoji | Buffering state machine, global pause logic, floating animations | High |
| #7 Watch History | History persistence, resume flow, periodic position saving | Medium |
| #8 Polish & Deploy | Responsive design, animations, edge cases, production deploy | Medium |

---

## 7. Project Structure

```
syncwatch/
 +-- src/
 |    +-- app/                    # Next.js App Router
 |    |    +-- page.tsx           # Home / Dashboard
 |    |    +-- room/
 |    |    |    +-- [id]/
 |    |    |         +-- lobby/page.tsx
 |    |    |         +-- page.tsx  # Watch Room
 |    |    +-- history/
 |    |    |    +-- page.tsx
 |    |    +-- api/
 |    |         +-- rooms/route.ts
 |    |         +-- video-info/route.ts
 |    |         +-- history/route.ts
 |    +-- components/
 |    |    +-- AvatarGrid.tsx
 |    |    +-- VideoPlayer.tsx
 |    |    +-- SyncController.tsx
 |    |    +-- EmojiReactionBar.tsx
 |    |    +-- BufferingOverlay.tsx
 |    |    +-- CountdownOverlay.tsx
 |    |    +-- PresenceBar.tsx
 |    +-- hooks/
 |    |    +-- useSupabaseChannel.ts
 |    |    +-- usePlaybackSync.ts
 |    |    +-- useSession.ts
 |    +-- lib/
 |    |    +-- supabase.ts         # Client initialization
 |    |    +-- room-code.ts        # Code generation utility
 |    |    +-- video-metadata.ts   # oEmbed fetching
 |    +-- types/
 |         +-- index.ts            # Shared TypeScript types
 +-- supabase/
 |    +-- migrations/              # SQL migration files
 +-- public/
 |    +-- avatars/                 # Preset avatar images
 +-- tests/
 +-- ARCHITECTURE.md
 +-- CLAUDE.md
 +-- .cursorrules
 +-- package.json
 +-- tailwind.config.ts
 +-- tsconfig.json
```

---

## 8. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Bilibili embed restrictions** | Bilibili may block iframe embedding from foreign domains | Detect and show a fallback message; prioritize YouTube support. Test Bilibili embed early in Issue #5. |
| **Playback drift > 500ms** | Poor user experience, out-of-sync viewing | Implement periodic drift check (every 5s); snap to broadcast time if drift exceeds threshold. |
| **Supabase Realtime message ordering** | Events arriving out of order could cause state conflicts | Include monotonic timestamps in all events; clients discard stale events. |
| **Session persistence** | localStorage-based sessions lost on clear/incognito | Acceptable per SPEC (no auth required); warn users in UI. |
| **Free-tier rate limits** | Supabase free tier: 500 concurrent connections, 2GB DB | Sufficient for demo scale; monitor usage during testing. |

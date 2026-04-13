-- SyncWatch initial schema
-- Tables: rooms, room_members, watch_history
-- See ARCHITECTURE.md §4 for rationale.

create extension if not exists "pgcrypto";

-- ---------- rooms ----------
create table if not exists public.rooms (
  id               uuid primary key default gen_random_uuid(),
  room_code        text unique not null,
  name             text,
  video_url        text,
  video_title      text,
  playback_state   jsonb not null default '{"playing": false, "current_time": 0}'::jsonb,
  avatar_pool      jsonb not null,
  host_session_id  text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_rooms_code on public.rooms(room_code);

-- ---------- room_members ----------
create table if not exists public.room_members (
  id            bigserial primary key,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  session_id    text not null,
  display_name  text,
  avatar_id     text not null default '?',
  is_ready      boolean not null default false,
  is_buffering  boolean not null default false,
  joined_at     timestamptz not null default now(),
  unique (room_id, session_id)
);

create index if not exists idx_room_members_room on public.room_members(room_id);

-- ---------- watch_history ----------
create table if not exists public.watch_history (
  id            bigserial primary key,
  room_id       uuid references public.rooms(id) on delete set null,
  session_id    text not null,
  video_url     text,
  video_title   text,
  last_position real not null default 0,
  watched_at    timestamptz not null default now()
);

create index if not exists idx_watch_history_session
  on public.watch_history(session_id, watched_at desc);

-- ---------- Realtime ----------
-- Publish tables so Supabase Realtime can stream changes.
-- Run only if not already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'room_members'
  ) then
    execute 'alter publication supabase_realtime add table public.room_members';
  end if;
end
$$;

-- ---------- Row-Level Security ----------
-- SPEC: no auth. Anon key has full access to these three tables.
-- We still enable RLS and add permissive policies so we can tighten later
-- without a migration-shaped hole.

alter table public.rooms         enable row level security;
alter table public.room_members  enable row level security;
alter table public.watch_history enable row level security;

drop policy if exists "rooms_anon_all"         on public.rooms;
drop policy if exists "room_members_anon_all"  on public.room_members;
drop policy if exists "watch_history_anon_all" on public.watch_history;

create policy "rooms_anon_all"
  on public.rooms for all
  to anon, authenticated
  using (true) with check (true);

create policy "room_members_anon_all"
  on public.room_members for all
  to anon, authenticated
  using (true) with check (true);

create policy "watch_history_anon_all"
  on public.watch_history for all
  to anon, authenticated
  using (true) with check (true);

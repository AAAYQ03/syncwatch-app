-- Supabase Realtime postgres_changes filters match against both the `old`
-- and `new` records of an UPDATE event. With the default REPLICA IDENTITY
-- (primary key only), the `old` record is missing non-PK columns like
-- room_id, so a filter like `room_id=eq.<uuid>` silently drops UPDATE
-- events — clients never see avatar claims or ready toggles.
--
-- Setting REPLICA IDENTITY FULL makes Postgres emit the entire row for
-- the `old` payload, so filters work correctly.

alter table public.room_members replica identity full;
alter table public.rooms         replica identity full;

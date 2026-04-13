-- Atomic avatar claiming: within a room, a claimed avatar_id can only belong
-- to one member. '?' (unclaimed) is excluded so multiple members can hold it
-- simultaneously before picking.
create unique index if not exists uniq_room_avatar_claimed
  on public.room_members (room_id, avatar_id)
  where avatar_id <> '?';

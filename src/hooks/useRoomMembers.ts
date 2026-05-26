"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";
import type { RoomMember } from "@/types";

/**
 * Subscribe to the membership list of a given room. Lighter alternative to
 * useLobby — for pages (like the watch room) that need avatar lookups by
 * session_id but don't need claimAvatar/toggleReady.
 */
export function useRoomMembers(roomId: string): {
  members: RoomMember[];
  byId: Map<string, RoomMember>;
} {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const supabase = useMemo(() => getBrowserSupabase(), []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    async function load() {
      const { data, error } = await supabase
        .from("room_members")
        .select("*")
        .eq("room_id", roomId);
      if (cancelled || error) return;
      setMembers((data ?? []) as RoomMember[]);

      channel = supabase
        .channel(`room-members:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_members",
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            setMembers((prev) => {
              if (payload.eventType === "INSERT") {
                const row = payload.new as RoomMember;
                return [...prev.filter((m) => m.id !== row.id), row];
              }
              if (payload.eventType === "UPDATE") {
                const row = payload.new as RoomMember;
                return prev.map((m) => (m.id === row.id ? row : m));
              }
              if (payload.eventType === "DELETE") {
                const row = payload.old as Partial<RoomMember>;
                return prev.filter((m) => m.id !== row.id);
              }
              return prev;
            });
          }
        )
        .subscribe();
    }

    load();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  const byId = useMemo(() => {
    const map = new Map<string, RoomMember>();
    for (const m of members) map.set(m.session_id, m);
    return map;
  }, [members]);

  return { members, byId };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";
import type { Room, RoomMember } from "@/types";

type LobbyState = {
  room: Room | null;
  members: RoomMember[];
  loading: boolean;
  error: string | null;
};

type UseLobbyReturn = LobbyState & {
  myMember: RoomMember | null;
  claimAvatar: (avatarId: string) => Promise<{ ok: boolean; error?: string }>;
  toggleReady: () => Promise<{ ok: boolean; error?: string }>;
};

export function useLobby(roomId: string, sessionId: string | null): UseLobbyReturn {
  const [state, setState] = useState<LobbyState>({
    room: null,
    members: [],
    loading: true,
    error: null
  });

  const supabase = useMemo(() => getBrowserSupabase(), []);

  // Initial fetch + realtime subscriptions.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    async function load() {
      const [roomRes, membersRes] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("*").eq("room_id", roomId)
      ]);

      if (cancelled) return;

      if (roomRes.error) {
        setState((s) => ({ ...s, loading: false, error: roomRes.error!.message }));
        return;
      }
      if (!roomRes.data) {
        setState((s) => ({ ...s, loading: false, error: "Room not found" }));
        return;
      }
      if (membersRes.error) {
        setState((s) => ({ ...s, loading: false, error: membersRes.error!.message }));
        return;
      }

      setState({
        room: roomRes.data as Room,
        members: (membersRes.data ?? []) as RoomMember[],
        loading: false,
        error: null
      });

      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_members",
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            setState((prev) => {
              let next = prev.members;
              if (payload.eventType === "INSERT") {
                const row = payload.new as RoomMember;
                next = [...prev.members.filter((m) => m.id !== row.id), row];
              } else if (payload.eventType === "UPDATE") {
                const row = payload.new as RoomMember;
                next = prev.members.map((m) => (m.id === row.id ? row : m));
              } else if (payload.eventType === "DELETE") {
                const row = payload.old as Partial<RoomMember>;
                next = prev.members.filter((m) => m.id !== row.id);
              }
              return { ...prev, members: next };
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomId}`
          },
          (payload) => {
            setState((prev) => ({ ...prev, room: payload.new as Room }));
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

  const myMember = useMemo(() => {
    if (!sessionId) return null;
    return state.members.find((m) => m.session_id === sessionId) ?? null;
  }, [state.members, sessionId]);

  const claimAvatar = useCallback(
    async (avatarId: string) => {
      if (!sessionId) return { ok: false, error: "No session" };
      const { error } = await supabase
        .from("room_members")
        .update({ avatar_id: avatarId })
        .eq("room_id", roomId)
        .eq("session_id", sessionId);
      if (error) {
        // 23505 = partial unique index violation (someone else has it).
        if (error.code === "23505") {
          return { ok: false, error: "Avatar just taken" };
        }
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
    [roomId, sessionId, supabase]
  );

  const toggleReady = useCallback(async () => {
    if (!sessionId || !myMember) return { ok: false, error: "Not in room" };
    const { error } = await supabase
      .from("room_members")
      .update({ is_ready: !myMember.is_ready })
      .eq("room_id", roomId)
      .eq("session_id", sessionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, [roomId, sessionId, myMember, supabase]);

  return {
    ...state,
    myMember,
    claimAvatar,
    toggleReady
  };
}

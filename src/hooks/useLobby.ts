"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * How long to wait after a presence "leave" before releasing the member's
 * avatar. Gives a window for quick reconnect (page refresh, brief network
 * blip) before someone else can grab the avatar. See Bug Report #1 (#18).
 */
const PRESENCE_CLEANUP_DELAY_MS = 3000;

type PresenceMeta = { session_id: string };

export function useLobby(roomId: string, sessionId: string | null): UseLobbyReturn {
  const [state, setState] = useState<LobbyState>({
    room: null,
    members: [],
    loading: true,
    error: null
  });

  const supabase = useMemo(() => getBrowserSupabase(), []);

  // Pending cleanup timers, keyed by the leaver's session_id, so a fast
  // reconnect can cancel the release.
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Initial fetch + realtime subscriptions.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    // Capture the Map at effect setup so the cleanup function references
    // the same instance regardless of any future ref reassignment.
    const cleanupTimers = cleanupTimersRef.current;

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

      const scheduleCleanup = (sid: string) => {
        // Don't clean up ourselves (we're obviously still here).
        if (sessionId && sid === sessionId) return;
        const existing = cleanupTimers.get(sid);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(async () => {
          cleanupTimers.delete(sid);
          await supabase
            .from("room_members")
            .update({
              avatar_id: "?",
              is_ready: false,
              is_buffering: false
            })
            .eq("room_id", roomId)
            .eq("session_id", sid);
        }, PRESENCE_CLEANUP_DELAY_MS);
        cleanupTimers.set(sid, timer);
      };

      const cancelCleanup = (sid: string) => {
        const t = cleanupTimers.get(sid);
        if (t) {
          clearTimeout(t);
          cleanupTimers.delete(sid);
        }
      };

      channel = supabase
        .channel(`room:${roomId}`, {
          config: { presence: { key: sessionId ?? "anon" } }
        })
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
        .on("presence", { event: "join" }, ({ newPresences }) => {
          for (const p of newPresences as unknown as PresenceMeta[]) {
            if (p?.session_id) cancelCleanup(p.session_id);
          }
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          for (const p of leftPresences as unknown as PresenceMeta[]) {
            if (p?.session_id) scheduleCleanup(p.session_id);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel && sessionId) {
            await channel.track({ session_id: sessionId });
          }
        });
    }

    load();

    return () => {
      cancelled = true;
      for (const t of cleanupTimers.values()) clearTimeout(t);
      cleanupTimers.clear();
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, sessionId, supabase]);

  const myMember = useMemo(() => {
    if (!sessionId) return null;
    return state.members.find((m) => m.session_id === sessionId) ?? null;
  }, [state.members, sessionId]);

  const claimAvatar = useCallback(
    async (avatarId: string) => {
      if (!sessionId) return { ok: false, error: "No session" };
      const { data, error } = await supabase
        .from("room_members")
        .update({ avatar_id: avatarId })
        .eq("room_id", roomId)
        .eq("session_id", sessionId)
        .select()
        .single();
      if (error) {
        // 23505 = partial unique index violation (someone else has it).
        if (error.code === "23505") {
          return { ok: false, error: "Avatar just taken" };
        }
        return { ok: false, error: error.message };
      }
      // Optimistic local update so we don't wait for realtime round-trip.
      if (data) {
        const updated = data as RoomMember;
        setState((prev) => ({
          ...prev,
          members: prev.members.map((m) => (m.id === updated.id ? updated : m))
        }));
      }
      return { ok: true };
    },
    [roomId, sessionId, supabase]
  );

  const toggleReady = useCallback(async () => {
    if (!sessionId || !myMember) return { ok: false, error: "Not in room" };
    const { data, error } = await supabase
      .from("room_members")
      .update({ is_ready: !myMember.is_ready })
      .eq("room_id", roomId)
      .eq("session_id", sessionId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    if (data) {
      const updated = data as RoomMember;
      setState((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === updated.id ? updated : m))
      }));
    }
    return { ok: true };
  }, [roomId, sessionId, myMember, supabase]);

  return {
    ...state,
    myMember,
    claimAvatar,
    toggleReady
  };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";
import type { Room } from "@/types";

type State = {
  room: Room | null;
  loading: boolean;
  error: string | null;
};

type SetVideoArgs = {
  video_url: string;
  video_title: string;
};

type PlaybackStatePatch = {
  playing: boolean;
  current_time: number;
};

type UseWatchRoomReturn = State & {
  setVideo: (args: SetVideoArgs) => Promise<{ ok: boolean; error?: string }>;
  setPlaybackState: (
    patch: PlaybackStatePatch
  ) => Promise<{ ok: boolean; error?: string }>;
};

export function useWatchRoom(roomId: string): UseWatchRoomReturn {
  const [state, setState] = useState<State>({
    room: null,
    loading: true,
    error: null
  });
  const supabase = useMemo(() => getBrowserSupabase(), []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    async function load() {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setState({ room: null, loading: false, error: error.message });
        return;
      }
      if (!data) {
        setState({ room: null, loading: false, error: "Room not found" });
        return;
      }
      setState({ room: data as Room, loading: false, error: null });

      channel = supabase
        .channel(`watch-room:${roomId}`)
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

  const setVideo = useCallback(
    async ({ video_url, video_title }: SetVideoArgs) => {
      const { data, error } = await supabase
        .from("rooms")
        .update({ video_url, video_title })
        .eq("id", roomId)
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      if (data) {
        setState((prev) => ({ ...prev, room: data as Room }));
      }
      return { ok: true };
    },
    [roomId, supabase]
  );

  const setPlaybackState = useCallback(
    async ({ playing, current_time }: PlaybackStatePatch) => {
      const { data, error } = await supabase
        .from("rooms")
        .update({
          playback_state: {
            playing,
            current_time,
            updated_at: new Date().toISOString()
          }
        })
        .eq("id", roomId)
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      if (data) {
        setState((prev) => ({ ...prev, room: data as Room }));
      }
      return { ok: true };
    },
    [roomId, supabase]
  );

  return { ...state, setVideo, setPlaybackState };
}

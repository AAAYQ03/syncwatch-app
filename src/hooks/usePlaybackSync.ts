"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";

export type RemotePlaybackEvent =
  | { type: "play"; current_time: number; ts: number; sender: string }
  | { type: "pause"; current_time: number; ts: number; sender: string }
  | { type: "seek"; current_time: number; ts: number; sender: string };

type Args = {
  roomId: string;
  sessionId: string | null;
  onRemoteEvent: (event: RemotePlaybackEvent) => void;
};

type Broadcast = (
  type: "play" | "pause" | "seek",
  currentTime: number
) => void;

const CHANNEL_PREFIX = "playback:";
const BROADCAST_EVENT = "playback";

/**
 * Subscribes to a Supabase Realtime broadcast channel scoped to a room and
 * exposes a `broadcast` function plus an `onRemoteEvent` callback.
 *
 * - Broadcast { self: false } prevents the sender from receiving their own
 *   event. We additionally drop events whose `sender` matches our session id,
 *   which closes a small race when self-suppression is in flight.
 * - Each event carries a monotonic `ts` (Date.now()) so receivers can drop
 *   stale events that arrive out-of-order.
 */
export function usePlaybackSync({ roomId, sessionId, onRemoteEvent }: Args): {
  broadcast: Broadcast;
} {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTsRef = useRef<number>(0);

  // Hold onRemoteEvent in a ref so the channel subscription is stable.
  const onRemoteEventRef = useRef(onRemoteEvent);
  useEffect(() => {
    onRemoteEventRef.current = onRemoteEvent;
  }, [onRemoteEvent]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`${CHANNEL_PREFIX}${roomId}`, {
      config: { broadcast: { self: false, ack: false } }
    });

    channel.on("broadcast", { event: BROADCAST_EVENT }, ({ payload }) => {
      const evt = payload as RemotePlaybackEvent;
      if (!evt || typeof evt !== "object") return;
      if (evt.sender && sessionId && evt.sender === sessionId) return;
      // Drop stale events.
      if (typeof evt.ts !== "number" || evt.ts < lastTsRef.current - 50) return;
      lastTsRef.current = Math.max(lastTsRef.current, evt.ts);
      onRemoteEventRef.current(evt);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, sessionId, supabase]);

  const broadcast = useCallback<Broadcast>(
    (type, currentTime) => {
      const channel = channelRef.current;
      if (!channel || !sessionId) return;
      const ts = Date.now();
      lastTsRef.current = Math.max(lastTsRef.current, ts);
      channel.send({
        type: "broadcast",
        event: BROADCAST_EVENT,
        payload: {
          type,
          current_time: currentTime,
          ts,
          sender: sessionId
        }
      });
    },
    [sessionId]
  );

  return { broadcast };
}

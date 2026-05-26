"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase";

export type RemotePlaybackEvent =
  | { type: "play"; current_time: number; ts: number; sender: string }
  | { type: "pause"; current_time: number; ts: number; sender: string }
  | { type: "seek"; current_time: number; ts: number; sender: string }
  | { type: "buffering"; is_buffering: boolean; ts: number; sender: string }
  | { type: "emoji"; emoji: string; sender_avatar: string; ts: number; sender: string };

type Args = {
  roomId: string;
  sessionId: string | null;
  onRemoteEvent: (event: RemotePlaybackEvent) => void;
};

type BroadcastPlayback = (
  type: "play" | "pause" | "seek",
  currentTime: number
) => void;

type BroadcastBuffering = (isBuffering: boolean) => void;
type BroadcastEmoji = (emoji: string, senderAvatar: string) => void;

const CHANNEL_PREFIX = "playback:";
const BROADCAST_EVENT = "playback";

/**
 * Subscribes to a Supabase Realtime broadcast channel scoped to a room
 * and exposes broadcast helpers for playback, buffering, and emoji events.
 *
 * - { broadcast: { self: false } } prevents the sender from receiving their
 *   own event. We additionally drop events whose `sender` matches our
 *   session id, which closes a small race when self-suppression is in flight.
 * - Each event carries a monotonic `ts` (Date.now()) so receivers can drop
 *   stale events that arrive out-of-order.
 */
export function usePlaybackSync({ roomId, sessionId, onRemoteEvent }: Args): {
  broadcast: BroadcastPlayback;
  broadcastBuffering: BroadcastBuffering;
  broadcastEmoji: BroadcastEmoji;
} {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTsRef = useRef<number>(0);

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

  const send = useCallback(
    (payload: RemotePlaybackEvent) => {
      const channel = channelRef.current;
      if (!channel) return;
      lastTsRef.current = Math.max(lastTsRef.current, payload.ts);
      channel.send({
        type: "broadcast",
        event: BROADCAST_EVENT,
        payload
      });
    },
    []
  );

  const broadcast = useCallback<BroadcastPlayback>(
    (type, currentTime) => {
      if (!sessionId) return;
      send({ type, current_time: currentTime, ts: Date.now(), sender: sessionId });
    },
    [send, sessionId]
  );

  const broadcastBuffering = useCallback<BroadcastBuffering>(
    (isBuffering) => {
      if (!sessionId) return;
      send({
        type: "buffering",
        is_buffering: isBuffering,
        ts: Date.now(),
        sender: sessionId
      });
    },
    [send, sessionId]
  );

  const broadcastEmoji = useCallback<BroadcastEmoji>(
    (emoji, senderAvatar) => {
      if (!sessionId) return;
      send({
        type: "emoji",
        emoji,
        sender_avatar: senderAvatar,
        ts: Date.now(),
        sender: sessionId
      });
    },
    [send, sessionId]
  );

  return { broadcast, broadcastBuffering, broadcastEmoji };
}

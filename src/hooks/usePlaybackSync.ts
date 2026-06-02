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

// Verbose console diagnostics — opt in by running
// `localStorage.setItem("syncwatch_debug", "1")` in the browser console.
const DEBUG =
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined" &&
  window.localStorage.getItem("syncwatch_debug") === "1";

function debug(...args: unknown[]) {
  if (DEBUG) console.debug("[playback-sync]", ...args);
}

/**
 * Subscribes to a Supabase Realtime broadcast channel scoped to a room
 * and exposes broadcast helpers for playback, buffering, and emoji events.
 *
 * - { broadcast: { self: false } } prevents the sender from receiving their
 *   own event. We additionally drop events whose `sender` matches our
 *   session id, which closes a small race when self-suppression is in flight.
 * - Each event carries a monotonic `ts` (Date.now()) so receivers can drop
 *   stale events that arrive out-of-order.
 * - Sends are queued until the channel reaches SUBSCRIBED state. Without
 *   this gate, the very first broadcast from a freshly-mounted page could
 *   land before the channel was ready and be silently dropped — which
 *   notably affected the host (Bug #28), since they create the room and
 *   are the first to act inside it.
 */
export function usePlaybackSync({ roomId, sessionId, onRemoteEvent }: Args): {
  broadcast: BroadcastPlayback;
  broadcastBuffering: BroadcastBuffering;
  broadcastEmoji: BroadcastEmoji;
} {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const pendingSendsRef = useRef<RemotePlaybackEvent[]>([]);
  const lastTsRef = useRef<number>(0);

  const onRemoteEventRef = useRef(onRemoteEvent);
  useEffect(() => {
    onRemoteEventRef.current = onRemoteEvent;
  }, [onRemoteEvent]);

  // Keep an always-current sessionId ref so the self-filter inside the channel
  // callback never sees a stale value if sessionId resolves after subscribe.
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`${CHANNEL_PREFIX}${roomId}`, {
      config: { broadcast: { self: false, ack: false } }
    });

    channel.on("broadcast", { event: BROADCAST_EVENT }, ({ payload }) => {
      const evt = payload as RemotePlaybackEvent;
      if (!evt || typeof evt !== "object") return;
      const mySid = sessionIdRef.current;
      if (evt.sender && mySid && evt.sender === mySid) {
        debug("drop self-echo", evt.type);
        return;
      }
      if (typeof evt.ts !== "number" || evt.ts < lastTsRef.current - 50) {
        debug("drop stale", evt.type, "ts", evt.ts, "last", lastTsRef.current);
        return;
      }
      lastTsRef.current = Math.max(lastTsRef.current, evt.ts);
      debug("recv", evt.type, "from", evt.sender?.slice(0, 6), evt);
      onRemoteEventRef.current(evt);
    });

    channel.subscribe((status) => {
      debug("subscribe status:", status);
      if (status === "SUBSCRIBED") {
        subscribedRef.current = true;
        // Flush anything that tried to send before we were ready.
        const queued = pendingSendsRef.current;
        pendingSendsRef.current = [];
        for (const payload of queued) {
          debug("flush queued", payload.type);
          channel.send({
            type: "broadcast",
            event: BROADCAST_EVENT,
            payload
          });
        }
      } else {
        subscribedRef.current = false;
      }
    });
    channelRef.current = channel;

    return () => {
      subscribedRef.current = false;
      pendingSendsRef.current = [];
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, supabase]);

  const send = useCallback((payload: RemotePlaybackEvent) => {
    lastTsRef.current = Math.max(lastTsRef.current, payload.ts);
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) {
      debug("queue (not subscribed yet)", payload.type);
      pendingSendsRef.current.push(payload);
      return;
    }
    debug("send", payload.type, payload);
    channel.send({
      type: "broadcast",
      event: BROADCAST_EVENT,
      payload
    });
  }, []);

  const broadcast = useCallback<BroadcastPlayback>(
    (type, currentTime) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      send({ type, current_time: currentTime, ts: Date.now(), sender: sid });
    },
    [send]
  );

  const broadcastBuffering = useCallback<BroadcastBuffering>(
    (isBuffering) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      send({
        type: "buffering",
        is_buffering: isBuffering,
        ts: Date.now(),
        sender: sid
      });
    },
    [send]
  );

  const broadcastEmoji = useCallback<BroadcastEmoji>(
    (emoji, senderAvatar) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      send({
        type: "emoji",
        emoji,
        sender_avatar: senderAvatar,
        ts: Date.now(),
        sender: sid
      });
    },
    [send]
  );

  return { broadcast, broadcastBuffering, broadcastEmoji };
}

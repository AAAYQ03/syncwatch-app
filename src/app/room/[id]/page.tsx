"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { useWatchRoom } from "@/hooks/useWatchRoom";
import { useRoomMembers } from "@/hooks/useRoomMembers";
import { usePlaybackSync, type RemotePlaybackEvent } from "@/hooks/usePlaybackSync";
import { VideoPlayer, type PlayerHandle, type PlayerStatus } from "@/components/VideoPlayer";
import { VideoUrlInput } from "@/components/VideoUrlInput";
import { BufferingOverlay } from "@/components/BufferingOverlay";
import { EmojiReactionBar } from "@/components/EmojiReactionBar";
import { FloatingEmojiLayer, type FloatingEmoji } from "@/components/FloatingEmojiLayer";

const SEEK_DRIFT_THRESHOLD_S = 0.5;
const HOST_TICK_INTERVAL_MS = 4000;
// Bug #27: don't report buffering until the player has been continuously
// buffering for ≥1.5s. Filters out brief BUFFERING blips that fire during
// the pause/resume transition itself, which previously caused a global
// pause→resume ping-pong loop between users.
const BUFFER_REPORT_DELAY_MS = 1500;
// After a global resume, ignore *any* buffering signal for 3s. Gives every
// client a stable window to settle before re-engaging the detector.
const BUFFER_RESUME_COOLDOWN_MS = 3000;

export default function WatchRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = useSession();
  const roomId = params.id;
  const { room, loading, error, setVideo, setPlaybackState } =
    useWatchRoom(roomId);
  const { byId: memberById } = useRoomMembers(roomId);

  const playerRef = useRef<PlayerHandle | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const applyingRemoteRef = useRef(false);

  // Track which other members are currently buffering (session_id set).
  const [bufferingMembers, setBufferingMembers] = useState<Set<string>>(
    () => new Set()
  );
  // Whether *I* have reported myself as buffering.
  const iAmBufferingRef = useRef(false);
  // Whether playback was running before we paused for someone's buffer.
  const wasPlayingBeforeBufferRef = useRef(false);
  // Pending "broadcast buffering=true after debounce" timer.
  const bufferReportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Time in ms (Date.now() comparable) before which buffering signals are
  // ignored. Set by the global-resume path to give players time to settle.
  const bufferCooldownUntilRef = useRef(0);

  // Floating emoji queue.
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const emojiIdRef = useRef(1);

  const isHost = Boolean(
    room && sessionId && room.host_session_id === sessionId
  );

  const myAvatar = sessionId
    ? memberById.get(sessionId)?.avatar_id ?? "?"
    : "?";

  function pushFloatingEmoji(emoji: string, senderAvatar: string) {
    setFloatingEmojis((prev) => {
      // Cap at 30 simultaneous to avoid DOM explosions.
      const next = prev.length > 30 ? prev.slice(-25) : prev;
      return [
        ...next,
        {
          id: emojiIdRef.current++,
          emoji,
          leftPct: 15 + Math.random() * 70,
          badge: senderAvatar !== "?" ? undefined : undefined
        }
      ];
    });
  }

  const handleRemoteEvent = useCallback(
    (evt: RemotePlaybackEvent) => {
      if (evt.type === "emoji") {
        pushFloatingEmoji(evt.emoji, evt.sender_avatar);
        return;
      }
      if (evt.type === "buffering") {
        setBufferingMembers((prev) => {
          const next = new Set(prev);
          if (evt.is_buffering) next.add(evt.sender);
          else next.delete(evt.sender);
          return next;
        });
        return;
      }
      const player = playerRef.current;
      if (!player) return;
      applyingRemoteRef.current = true;
      try {
        const localTime = player.getCurrentTime();
        const drift = Math.abs(localTime - evt.current_time);
        if (drift > SEEK_DRIFT_THRESHOLD_S) {
          player.seek(evt.current_time);
        }
        if (evt.type === "play") player.play();
        else if (evt.type === "pause") player.pause();
        else if (evt.type === "seek") player.seek(evt.current_time);
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 250);
      }
    },
    []
  );

  const { broadcast, broadcastBuffering, broadcastEmoji } = usePlaybackSync({
    roomId,
    sessionId,
    onRemoteEvent: handleRemoteEvent
  });

  // Coordinate the buffering-induced pause/resume across all clients.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const anyoneBuffering = bufferingMembers.size > 0;
    if (anyoneBuffering) {
      if (player.getStatus() === "playing") {
        wasPlayingBeforeBufferRef.current = true;
      }
      applyingRemoteRef.current = true;
      player.pause();
      setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 250);
    } else if (wasPlayingBeforeBufferRef.current) {
      wasPlayingBeforeBufferRef.current = false;
      // Bug #27: arm the cooldown so the brief BUFFERING blip emitted by
      // the player as it resumes doesn't immediately re-trigger us.
      bufferCooldownUntilRef.current =
        Date.now() + BUFFER_RESUME_COOLDOWN_MS;
      applyingRemoteRef.current = true;
      player.play();
      setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 250);
    }
  }, [bufferingMembers]);

  const handlePlayerEvent = useCallback(
    (event: {
      type: "play" | "pause" | "seek-end" | "buffering" | "playing";
      currentTime: number;
    }) => {
      if (applyingRemoteRef.current) return;
      if (event.type === "play") {
        broadcast("play", event.currentTime);
        if (isHost) {
          void setPlaybackState({ playing: true, current_time: event.currentTime });
        }
      } else if (event.type === "pause") {
        broadcast("pause", event.currentTime);
        if (isHost) {
          void setPlaybackState({ playing: false, current_time: event.currentTime });
        }
      } else if (event.type === "seek-end") {
        broadcast("seek", event.currentTime);
      }
    },
    [broadcast, isHost, setPlaybackState]
  );

  // Detect *my* buffering transitions and broadcast them, with debounce +
  // post-resume cooldown so a transient pause/resume BUFFERING blip doesn't
  // trigger another global pause (Bug #27).
  const handleStatusChange = useCallback(
    (status: PlayerStatus, _currentTime: number) => {
      // Cooldown: skip everything in the window right after a global resume.
      if (Date.now() < bufferCooldownUntilRef.current) return;

      if (status === "buffering") {
        if (iAmBufferingRef.current) return; // already reported
        if (bufferReportTimerRef.current) return; // already pending
        bufferReportTimerRef.current = setTimeout(() => {
          bufferReportTimerRef.current = null;
          // Re-check the cooldown — it may have armed during the delay.
          if (Date.now() < bufferCooldownUntilRef.current) return;
          iAmBufferingRef.current = true;
          broadcastBuffering(true);
        }, BUFFER_REPORT_DELAY_MS);
        return;
      }

      // Status moved away from buffering. Cancel any pending report (we
      // were only buffering for a moment) and tell others if we'd
      // already reported.
      if (bufferReportTimerRef.current) {
        clearTimeout(bufferReportTimerRef.current);
        bufferReportTimerRef.current = null;
      }
      if (iAmBufferingRef.current) {
        iAmBufferingRef.current = false;
        broadcastBuffering(false);
      }
    },
    [broadcastBuffering]
  );

  // Clear pending buffer timer on unmount.
  useEffect(() => {
    return () => {
      if (bufferReportTimerRef.current) {
        clearTimeout(bufferReportTimerRef.current);
        bufferReportTimerRef.current = null;
      }
    };
  }, []);

  // Late-joiner seeding from rooms.playback_state.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!playerReady || seededRef.current || !room?.playback_state) return;
    const player = playerRef.current;
    if (!player) return;
    seededRef.current = true;
    const { playing, current_time, updated_at } = room.playback_state;
    let target = current_time;
    if (playing && updated_at) {
      const elapsedMs = Date.now() - new Date(updated_at).getTime();
      if (elapsedMs > 0 && elapsedMs < 6 * 60 * 60 * 1000) {
        target = current_time + elapsedMs / 1000;
      }
    }
    applyingRemoteRef.current = true;
    try {
      if (target > 0.5) player.seek(target);
      if (playing) player.play();
    } finally {
      setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 400);
    }
  }, [playerReady, room?.playback_state]);

  // Host periodically writes its current position.
  useEffect(() => {
    if (!isHost || !playerReady) return;
    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const status = player.getStatus();
      if (status !== "playing" && status !== "paused") return;
      void setPlaybackState({
        playing: status === "playing",
        current_time: player.getCurrentTime()
      });
    }, HOST_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isHost, playerReady, setPlaybackState]);

  // Local emoji send: broadcast + immediate self-feedback.
  const handleEmojiPick = useCallback(
    (emoji: string) => {
      broadcastEmoji(emoji, myAvatar);
      pushFloatingEmoji(emoji, myAvatar);
    },
    [broadcastEmoji, myAvatar]
  );

  const removeFloatingEmoji = useCallback((id: number) => {
    setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Buffering overlay needs avatar_ids for the people currently buffering.
  const bufferingAvatars = Array.from(bufferingMembers)
    .map((sid) => memberById.get(sid)?.avatar_id ?? "?");

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-neutral-400">Loading room…</p>
      </main>
    );
  }
  if (error || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-red-400">{error ?? "Room not found"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{room.name ?? "Watch room"}</h1>
          <Link
            href={`/room/${roomId}/lobby?code=${room.room_code}`}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            ← Back to lobby
          </Link>
        </div>
        <p className="text-sm text-neutral-400">
          Room code:{" "}
          <span className="font-mono tracking-widest text-indigo-300">
            {room.room_code}
          </span>
          {isHost && (
            <span className="ml-3 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200">
              host
            </span>
          )}
        </p>
        {room.video_title && (
          <p className="mt-1 text-sm text-neutral-200">
            ▶ <span className="font-medium">{room.video_title}</span>
          </p>
        )}
      </header>

      {room.video_url ? (
        <div className="relative">
          <VideoPlayer
            videoUrl={room.video_url}
            onReady={(handle) => {
              playerRef.current = handle;
              setPlayerReady(true);
            }}
            onPlayerEvent={handlePlayerEvent}
            onStatusChange={handleStatusChange}
          />
          <FloatingEmojiLayer
            emojis={floatingEmojis}
            onExpire={removeFloatingEmoji}
          />
          <BufferingOverlay bufferingAvatars={bufferingAvatars} />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/60 text-center text-sm text-neutral-500">
          No video set yet. Paste a URL below to get started.
        </div>
      )}

      {room.video_url && (
        <EmojiReactionBar onPick={handleEmojiPick} disabled={!sessionId} />
      )}

      <VideoUrlInput onSetVideo={setVideo} currentUrl={room.video_url} />
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { useWatchRoom } from "@/hooks/useWatchRoom";
import { usePlaybackSync, type RemotePlaybackEvent } from "@/hooks/usePlaybackSync";
import { VideoPlayer, type PlayerHandle } from "@/components/VideoPlayer";
import { VideoUrlInput } from "@/components/VideoUrlInput";

const SEEK_DRIFT_THRESHOLD_S = 0.5;
const HOST_TICK_INTERVAL_MS = 4000;

export default function WatchRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = useSession();
  const roomId = params.id;
  const { room, loading, error, setVideo, setPlaybackState } =
    useWatchRoom(roomId);

  const playerRef = useRef<PlayerHandle | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  // Suppress local→broadcast loops while applying a remote event.
  const applyingRemoteRef = useRef(false);

  const isHost = Boolean(
    room && sessionId && room.host_session_id === sessionId
  );

  const handleRemoteEvent = useCallback(
    (evt: RemotePlaybackEvent) => {
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
        // Player events fire async after these calls; clear shortly.
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 250);
      }
    },
    []
  );

  const { broadcast } = usePlaybackSync({
    roomId,
    sessionId,
    onRemoteEvent: handleRemoteEvent
  });

  // Local player events → broadcast + (host only) persist to rooms.playback_state
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

  // Seed late joiners from rooms.playback_state when player becomes ready.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!playerReady || seededRef.current || !room?.playback_state) return;
    const player = playerRef.current;
    if (!player) return;
    seededRef.current = true;
    const { playing, current_time, updated_at } = room.playback_state;
    let target = current_time;
    // If host marked it playing, advance by elapsed wall time so we land near
    // the live position rather than where the host last paused/checkpointed.
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

  // Host periodically writes its current position so late joiners stay close.
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
        <VideoPlayer
          videoUrl={room.video_url}
          onReady={(handle) => {
            playerRef.current = handle;
            setPlayerReady(true);
          }}
          onPlayerEvent={handlePlayerEvent}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/60 text-center text-sm text-neutral-500">
          No video set yet. Paste a URL below to get started.
        </div>
      )}

      <VideoUrlInput onSetVideo={setVideo} currentUrl={room.video_url} />
    </main>
  );
}

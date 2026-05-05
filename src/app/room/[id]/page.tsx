"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useWatchRoom } from "@/hooks/useWatchRoom";
import { VideoUrlInput } from "@/components/VideoUrlInput";

export default function WatchRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const { room, loading, error, setVideo } = useWatchRoom(roomId);

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
          <h1 className="text-2xl font-bold">
            {room.name ?? "Watch room"}
          </h1>
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
        </p>
      </header>

      <section className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/60 text-center text-sm text-neutral-500">
        {room.video_title ? (
          <div className="flex flex-col gap-2 px-6">
            <p className="text-base font-medium text-neutral-200">
              {room.video_title}
            </p>
            <p className="text-xs text-neutral-500">
              Embedded player + synced playback land in Issue #5.
            </p>
          </div>
        ) : (
          <p>No video set yet. Paste a URL below to get started.</p>
        )}
      </section>

      <VideoUrlInput onSetVideo={setVideo} currentUrl={room.video_url} />
    </main>
  );
}

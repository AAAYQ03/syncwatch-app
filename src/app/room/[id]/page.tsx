"use client";

import { useParams } from "next/navigation";

export default function WatchRoomPage() {
  const params = useParams<{ id: string }>();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Watch room</h1>
      <p className="text-neutral-400">
        Room <code className="text-neutral-200">{params.id.slice(0, 8)}</code>
      </p>
      <p className="text-sm text-neutral-500">
        Video player + synced playback land in Issues #4 and #5.
      </p>
    </main>
  );
}

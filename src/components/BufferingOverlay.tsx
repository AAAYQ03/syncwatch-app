"use client";

import { avatarEmoji } from "@/lib/avatars";

type Props = {
  /** avatar_ids of currently-buffering members. Empty = overlay hidden. */
  bufferingAvatars: string[];
};

export function BufferingOverlay({ bufferingAvatars }: Props) {
  if (bufferingAvatars.length === 0) return null;
  const unique = Array.from(new Set(bufferingAvatars));
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-900/90 px-6 py-5 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-3xl">
          {unique.map((id) => (
            <span key={id}>{avatarEmoji(id)}</span>
          ))}
        </div>
        <p className="text-sm font-medium">
          Waiting for{" "}
          {unique.length === 1 ? "this player" : `${unique.length} players`} to
          buffer…
        </p>
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/70 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/70 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );
}

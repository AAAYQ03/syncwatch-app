"use client";

import { avatarEmoji } from "@/lib/avatars";
import type { RoomMember } from "@/types";

type Props = {
  pool: string[];
  members: RoomMember[];
  mySessionId: string | null;
  onClaim: (avatarId: string) => void;
  disabled?: boolean;
};

export function AvatarGrid({ pool, members, mySessionId, onClaim, disabled }: Props) {
  const claimedBy = new Map<string, RoomMember>();
  for (const m of members) {
    if (m.avatar_id !== "?") claimedBy.set(m.avatar_id, m);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {pool.map((avatarId) => {
        const owner = claimedBy.get(avatarId);
        const isMine = owner?.session_id === mySessionId;
        const taken = Boolean(owner) && !isMine;
        return (
          <button
            key={avatarId}
            type="button"
            onClick={() => !taken && !disabled && onClaim(avatarId)}
            disabled={taken || disabled}
            className={[
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border text-3xl transition",
              isMine
                ? "border-indigo-400 bg-indigo-500/20 ring-2 ring-indigo-400"
                : taken
                ? "cursor-not-allowed border-neutral-800 bg-neutral-900/60 opacity-50"
                : "border-neutral-700 bg-neutral-900 hover:border-neutral-500 hover:bg-neutral-800"
            ].join(" ")}
            aria-label={`Claim ${avatarId}`}
          >
            <span className="text-4xl">{avatarEmoji(avatarId)}</span>
            <span className="text-xs font-medium text-neutral-300">
              {owner ? (isMine ? "You" : "Taken") : avatarId}
            </span>
          </button>
        );
      })}
    </div>
  );
}

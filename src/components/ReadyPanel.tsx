"use client";

import { avatarEmoji } from "@/lib/avatars";
import type { RoomMember } from "@/types";

type Props = {
  members: RoomMember[];
  mySessionId: string | null;
  onToggleReady: () => void;
  disabled?: boolean;
};

export function ReadyPanel({ members, mySessionId, onToggleReady, disabled }: Props) {
  const me = members.find((m) => m.session_id === mySessionId);
  const meReady = me?.is_ready ?? false;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <h2 className="text-lg font-semibold">Ready check</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {members.length === 0 && (
          <li className="text-neutral-500">Waiting for players...</li>
        )}
        {members.map((m) => {
          const isMe = m.session_id === mySessionId;
          return (
            <li key={m.id} className="flex items-center gap-2">
              <span className="text-xl">{avatarEmoji(m.avatar_id)}</span>
              <span className="flex-1 text-neutral-200">
                {isMe ? "You" : m.display_name ?? `Session ${m.session_id.slice(0, 6)}`}
              </span>
              <span
                className={
                  m.is_ready ? "text-emerald-400" : "text-neutral-500"
                }
              >
                {m.is_ready ? "✓ Ready" : "…"}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onToggleReady}
        disabled={disabled || !me}
        className={[
          "mt-1 rounded-md px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
          meReady
            ? "bg-emerald-500 text-white hover:bg-emerald-400"
            : "bg-indigo-500 text-white hover:bg-indigo-400"
        ].join(" ")}
      >
        {meReady ? "Ready ✓" : "I'm ready"}
      </button>
    </div>
  );
}

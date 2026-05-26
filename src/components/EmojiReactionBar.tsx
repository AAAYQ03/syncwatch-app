"use client";

import { useRef } from "react";

export const REACTION_EMOJIS = ["❤️", "😂", "🔥", "👏", "😮", "💯"] as const;

const MIN_INTERVAL_MS = 300; // ~3 emojis/sec per session

type Props = {
  onPick: (emoji: string) => void;
  disabled?: boolean;
};

export function EmojiReactionBar({ onPick, disabled }: Props) {
  const lastSentRef = useRef(0);

  function handle(emoji: string) {
    const now = Date.now();
    if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
    lastSentRef.current = now;
    onPick(emoji);
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <span className="text-xs text-neutral-500">React:</span>
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handle(emoji)}
          disabled={disabled}
          className="rounded-full px-2 py-1 text-2xl transition hover:scale-125 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Send ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

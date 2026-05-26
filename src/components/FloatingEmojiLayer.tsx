"use client";

import { useEffect, useState } from "react";

export type FloatingEmoji = {
  id: number;
  emoji: string;
  /** Horizontal start position as percent (0–100). */
  leftPct: number;
  /** Optional small badge — typically the sender's avatar emoji. */
  badge?: string;
};

type Props = {
  emojis: FloatingEmoji[];
  /** Called when an emoji's lifetime ends so the parent can drop it. */
  onExpire: (id: number) => void;
};

const LIFETIME_MS = 2500;

export function FloatingEmojiLayer({ emojis, onExpire }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {emojis.map((e) => (
        <FloatingItem key={e.id} item={e} onExpire={onExpire} />
      ))}
    </div>
  );
}

function FloatingItem({
  item,
  onExpire
}: {
  item: FloatingEmoji;
  onExpire: (id: number) => void;
}) {
  // Trigger expiry via mount-level timeout; CSS animation drives the visuals.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => onExpire(item.id), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [item.id, onExpire]);

  return (
    <span
      className="absolute bottom-0 select-none text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
      style={{
        left: `${item.leftPct}%`,
        transform: "translateX(-50%)",
        animation: mounted
          ? `floatUp ${LIFETIME_MS}ms cubic-bezier(0.2, 0.6, 0.4, 1) forwards`
          : undefined,
        opacity: 0
      }}
    >
      {item.emoji}
      {item.badge && (
        <span className="ml-1 align-super text-base">{item.badge}</span>
      )}
    </span>
  );
}

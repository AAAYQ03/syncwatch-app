"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { ALL_AVATARS } from "@/lib/avatars";
import type { Room } from "@/types";

export function CreateRoomForm() {
  const router = useRouter();
  const sessionId = useSession();
  const [name, setName] = useState("");
  const [poolSize, setPoolSize] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          avatar_pool_size: poolSize,
          host_session_id: sessionId
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const room = (await res.json()) as Room;
      router.push(`/room/${room.id}/lobby?code=${room.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5"
    >
      <h2 className="text-xl font-semibold">Create a room</h2>
      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Room name <span className="text-neutral-500">(optional)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday movie night"
          maxLength={80}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-50 outline-none focus:border-neutral-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Group size (avatar pool)
        <select
          value={poolSize}
          onChange={(e) => setPoolSize(Number(e.target.value))}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-50 outline-none focus:border-neutral-500"
        >
          {Array.from({ length: ALL_AVATARS.length - 1 }, (_, i) => i + 2).map(
            (n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            )
          )}
        </select>
      </label>
      <button
        type="submit"
        disabled={!sessionId || isSubmitting}
        className="rounded-md bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create room"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

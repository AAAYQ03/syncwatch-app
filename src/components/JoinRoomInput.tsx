"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRoomCodeInput } from "@/lib/room-code";
import type { Room } from "@/types";

export function JoinRoomInput() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isJoining) return;
    setError(null);
    const code = parseRoomCodeInput(input);
    if (!code) {
      setError("Enter a 6-character room code or paste a room link.");
      return;
    }
    setIsJoining(true);
    try {
      const res = await fetch(`/api/rooms/by-code/${code}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("No room with that code. Double-check with the host.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const room = (await res.json()) as Room;
      router.push(`/room/${room.id}/lobby?code=${room.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5"
    >
      <h2 className="text-xl font-semibold">Join a room</h2>
      <label className="flex flex-col gap-1 text-sm text-neutral-300">
        Room code or link
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ABCDEF or https://…"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-neutral-50 tracking-widest outline-none focus:border-neutral-500"
        />
      </label>
      <button
        type="submit"
        disabled={isJoining}
        className="rounded-md border border-neutral-700 px-4 py-2 font-medium text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isJoining ? "Joining..." : "Join room"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

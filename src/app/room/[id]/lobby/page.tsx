"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import type { RoomMember } from "@/types";

export default function LobbyPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const sessionId = useSession();
  const roomId = params.id;
  const roomCode = search.get("code");

  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">(
    "idle"
  );
  const [member, setMember] = useState<RoomMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !roomId || status !== "idle") return;
    setStatus("joining");
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setMember((await res.json()) as RoomMember);
        setStatus("joined");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Join failed");
        setStatus("error");
      }
    })();
  }, [sessionId, roomId, status]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">Lobby</h1>
      {roomCode && (
        <p className="text-neutral-300">
          Room code:{" "}
          <span className="font-mono text-2xl tracking-widest text-indigo-300">
            {roomCode}
          </span>
        </p>
      )}
      <p className="text-sm text-neutral-500">
        Avatar grab + ready check land in Issue #3.
      </p>
      <div className="text-sm text-neutral-400">
        {status === "joining" && "Joining room..."}
        {status === "joined" && member && (
          <span>
            You joined as session{" "}
            <code className="text-neutral-200">{member.session_id.slice(0, 8)}</code>.
          </span>
        )}
        {status === "error" && error && (
          <span className="text-red-400">{error}</span>
        )}
      </div>
    </main>
  );
}

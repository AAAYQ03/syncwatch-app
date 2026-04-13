"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { useLobby } from "@/hooks/useLobby";
import { AvatarGrid } from "@/components/AvatarGrid";
import { ReadyPanel } from "@/components/ReadyPanel";
import { CountdownOverlay } from "@/components/CountdownOverlay";

const COUNTDOWN_SECONDS = 3;

export default function LobbyPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const sessionId = useSession();
  const roomId = params.id;
  const roomCode = search.get("code");

  // Ensure this client is registered as a member of the room.
  const [joinState, setJoinState] = useState<"idle" | "joining" | "joined" | "error">(
    "idle"
  );
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !roomId || joinState !== "idle") return;
    setJoinState("joining");
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
        setJoinState("joined");
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Join failed");
        setJoinState("error");
      }
    })();
  }, [sessionId, roomId, joinState]);

  const lobby = useLobby(roomId, sessionId);
  const [claimError, setClaimError] = useState<string | null>(null);

  const handleClaim = useCallback(
    async (avatarId: string) => {
      setClaimError(null);
      const res = await lobby.claimAvatar(avatarId);
      if (!res.ok && res.error) setClaimError(res.error);
    },
    [lobby]
  );

  const handleToggleReady = useCallback(async () => {
    const res = await lobby.toggleReady();
    if (!res.ok && res.error) setClaimError(res.error);
  }, [lobby]);

  // Countdown: start when all members are ready and there is at least 1 member.
  const allReady =
    lobby.members.length >= 1 && lobby.members.every((m) => m.is_ready);
  const [countdown, setCountdown] = useState<number | null>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!allReady) {
      setCountdown(null);
      return;
    }
    if (countdown === null) setCountdown(COUNTDOWN_SECONDS);
  }, [allReady, countdown]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown < 0) return;
    if (countdown === 0) {
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        const t = setTimeout(() => router.push(`/room/${roomId}`), 400);
        return () => clearTimeout(t);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, roomId, router]);

  if (joinState === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-red-400">Join failed: {joinError}</p>
      </main>
    );
  }

  if (lobby.loading || joinState !== "joined" || !lobby.room) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-neutral-400">Loading lobby...</p>
      </main>
    );
  }

  if (lobby.error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-red-400">{lobby.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-3xl font-bold">Lobby</h1>
        {(roomCode ?? lobby.room.room_code) && (
          <p className="text-neutral-300">
            Room code:{" "}
            <span className="font-mono text-2xl tracking-widest text-indigo-300">
              {roomCode ?? lobby.room.room_code}
            </span>
          </p>
        )}
        <p className="text-sm text-neutral-500">
          Pick an avatar, then hit Ready. A 3-2-1 countdown starts once everyone&apos;s in.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h2 className="text-lg font-semibold">Pick your avatar</h2>
        <AvatarGrid
          pool={lobby.room.avatar_pool}
          members={lobby.members}
          mySessionId={sessionId}
          onClaim={handleClaim}
          disabled={countdown !== null}
        />
        {claimError && (
          <p className="text-sm text-red-400">{claimError}</p>
        )}
      </section>

      <ReadyPanel
        members={lobby.members}
        mySessionId={sessionId}
        onToggleReady={handleToggleReady}
        disabled={countdown !== null}
      />

      {countdown !== null && <CountdownOverlay seconds={countdown} />}
    </main>
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";
import { generateRoomCode } from "@/lib/room-code";
import { buildAvatarPool, ALL_AVATARS } from "@/lib/avatars";

const CreateRoomSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatar_pool_size: z.number().int().min(2).max(ALL_AVATARS.length).default(6),
  host_session_id: z.string().min(1).max(128)
});

const MAX_CODE_ATTEMPTS = 8;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const avatarPool = buildAvatarPool(parsed.data.avatar_pool_size);

  // Retry on duplicate room_code collisions (Postgres 23505).
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const roomCode = generateRoomCode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        room_code: roomCode,
        name: parsed.data.name ?? null,
        avatar_pool: avatarPool,
        host_session_id: parsed.data.host_session_id
      })
      .select("*")
      .single();

    if (!error && data) {
      return NextResponse.json(data, { status: 201 });
    }

    if (error?.code !== "23505") {
      return NextResponse.json(
        { error: error?.message ?? "Unknown error" },
        { status: 500 }
      );
    }
    // Otherwise the 6-char code collided — try again.
  }

  return NextResponse.json(
    { error: "Failed to allocate a unique room code" },
    { status: 500 }
  );
}

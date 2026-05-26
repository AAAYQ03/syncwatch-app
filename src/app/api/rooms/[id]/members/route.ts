import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

const UuidSchema = z.string().uuid();

const JoinRoomSchema = z.object({
  session_id: z.string().min(1).max(128),
  display_name: z.string().trim().min(1).max(40).optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const roomIdParse = UuidSchema.safeParse(params.id);
  if (!roomIdParse.success) {
    return NextResponse.json({ error: "Invalid room id" }, { status: 400 });
  }
  const roomId = roomIdParse.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = JoinRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Confirm the room exists before inserting a member row.
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) {
    return NextResponse.json({ error: roomErr.message }, { status: 500 });
  }
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // On (re)join, always reset is_ready and is_buffering so a user reopening
  // their browser lands back in the lobby instead of triggering a stale
  // countdown (Bug Report #1 scenario B / Issue #18). We deliberately keep
  // avatar_id so refresh doesn't lose the picked avatar; presence-based
  // cleanup releases avatars of users who fully disconnect (scenario A).
  const { data, error } = await supabase
    .from("room_members")
    .upsert(
      {
        room_id: roomId,
        session_id: parsed.data.session_id,
        display_name: parsed.data.display_name ?? null,
        is_ready: false,
        is_buffering: false
      },
      { onConflict: "room_id,session_id" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 200 });
}

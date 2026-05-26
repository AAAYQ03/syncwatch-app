import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { isRoomCode } from "@/lib/room-code";

export async function GET(
  _request: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();
  if (!isRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

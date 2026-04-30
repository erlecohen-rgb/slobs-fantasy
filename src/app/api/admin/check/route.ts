import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_name, mlb_player_id, mlb_team, primary_position")
    .eq("mlb_player_id", 0)
    .order("mlb_player_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: data?.length, players: data });
}

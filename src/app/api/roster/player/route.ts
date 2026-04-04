import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// POST /api/roster/player — add a player to a team
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { team_id, mlb_player_id, mlb_player_name, mlb_team, primary_position, is_pitcher } = body;

  if (!team_id || !mlb_player_name) {
    return NextResponse.json({ error: "team_id and mlb_player_name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("roster_players")
    .insert({
      team_id,
      mlb_player_id: mlb_player_id || 0,
      mlb_player_name,
      mlb_team: mlb_team || "TBD",
      primary_position: primary_position || "UTIL",
      is_pitcher: is_pitcher || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ player: data });
}

// DELETE /api/roster/player?id=xxx — remove a player from roster
export async function DELETE(request: NextRequest) {
  const supabase = createServiceClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("roster_players")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

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

// PATCH /api/roster/player — update a player's MLB data (resolve mlb_player_id, mlb_team, etc.)
export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { id, mlb_player_id, mlb_team, mlb_player_name, primary_position } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (mlb_player_id !== undefined) updates.mlb_player_id = mlb_player_id;
  if (mlb_team !== undefined) updates.mlb_team = mlb_team;
  if (mlb_player_name !== undefined) updates.mlb_player_name = mlb_player_name;
  if (primary_position !== undefined) updates.primary_position = primary_position;

  const { data, error } = await supabase
    .from("roster_players")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ player: data });
}

// DELETE /api/roster/player?id=xxx — soft-delete a player (set dropped_at)
// Hard delete would violate FK constraints from weekly_lineups/weekly_scores.
export async function DELETE(request: NextRequest) {
  const supabase = createServiceClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("roster_players")
    .update({ dropped_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

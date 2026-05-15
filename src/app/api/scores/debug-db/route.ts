import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/scores/debug-db?name=caminero
// GET /api/scores/debug-db?mlb_id=657746
// Looks up roster_players records matching a name pattern or MLB player ID
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const name = request.nextUrl.searchParams.get("name");
  const mlbId = request.nextUrl.searchParams.get("mlb_id");

  let query = supabase
    .from("roster_players")
    .select("id, mlb_player_id, mlb_player_name, mlb_team, primary_position, is_pitcher, dropped_at, team_id, teams(name)");

  if (mlbId) {
    query = query.eq("mlb_player_id", Number(mlbId));
  } else {
    query = query.ilike("mlb_player_name", `%${name || "caminero"}%`);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: data?.length ?? 0, records: data });
}

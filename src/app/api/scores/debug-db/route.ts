import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/scores/debug-db?name=caminero
// Looks up roster_players records matching a name pattern to verify DB state
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const name = request.nextUrl.searchParams.get("name") || "caminero";

  const { data, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_id, mlb_player_name, mlb_team, primary_position, is_pitcher, dropped_at, team_id")
    .ilike("mlb_player_name", `%${name}%`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: data?.length ?? 0, records: data });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/roster?team_id=xxx or GET /api/roster (returns all teams + rosters)
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const teamId = request.nextUrl.searchParams.get("team_id");
  const leagueId = request.nextUrl.searchParams.get("league_id");

  if (teamId) {
    const { data, error } = await supabase
      .from("roster_players")
      .select("*")
      .eq("team_id", teamId)
      .is("dropped_at", null)
      .order("is_pitcher")
      .order("primary_position");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ players: data });
  }

  // Return all teams with their rosters
  let query = supabase
    .from("teams")
    .select("*, roster_players(*)")
    .order("name");

  if (leagueId) {
    query = query.eq("league_id", leagueId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const teams = (data || []).map((team) => ({
    ...team,
    roster_players: (team.roster_players || []).filter(
      (p: { dropped_at: string | null }) => p.dropped_at === null
    ),
  }));
  return NextResponse.json({ teams });
}

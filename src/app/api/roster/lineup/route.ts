import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function getWeekNumber(date: Date): number {
  const seasonStart = new Date(`${date.getFullYear()}-03-23`);
  const startDay = seasonStart.getDay();
  const firstMonday = new Date(seasonStart);
  firstMonday.setDate(seasonStart.getDate() - ((startDay + 6) % 7));
  const diff = date.getTime() - firstMonday.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// GET /api/roster/lineup?team_id=xxx&start_date=yyyy-mm-dd&end_date=yyyy-mm-dd
// Returns activated lineup players for all weeks overlapping the date range.
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = request.nextUrl;
  const teamId = searchParams.get("team_id");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!teamId || !startDate || !endDate) {
    return NextResponse.json({ error: "team_id, start_date, and end_date are required" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const seasonYear = start.getFullYear();
  const startWeek = getWeekNumber(start);
  const endWeek = getWeekNumber(end);

  const weeks: number[] = [];
  for (let w = startWeek; w <= endWeek; w++) weeks.push(w);

  const { data, error } = await supabase
    .from("weekly_lineups")
    .select("roster_player_id, mlb_player_id, activated_position, week_number, roster_players(mlb_player_name, is_pitcher)")
    .eq("team_id", teamId)
    .eq("season_year", seasonYear)
    .eq("is_active", true)
    .in("week_number", weeks);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate by mlb_player_id (player may appear in multiple weeks)
  const seen = new Map<number, { roster_player_id: string; mlb_player_id: number; activated_position: string; mlb_player_name: string; is_pitcher: boolean }>();
  for (const row of data ?? []) {
    if (!seen.has(row.mlb_player_id)) {
      const rp = (Array.isArray(row.roster_players) ? row.roster_players[0] : row.roster_players) as { mlb_player_name: string; is_pitcher: boolean } | null;
      seen.set(row.mlb_player_id, {
        roster_player_id: row.roster_player_id,
        mlb_player_id: row.mlb_player_id,
        activated_position: row.activated_position,
        mlb_player_name: rp?.mlb_player_name ?? "",
        is_pitcher: rp?.is_pitcher ?? false,
      });
    }
  }

  return NextResponse.json({ players: Array.from(seen.values()), weeks });
}

// POST /api/roster/lineup
// Body: { team_id, start_date, active_roster_player_ids: string[] }
// Upserts weekly_lineups for the week containing start_date.
// Players in active_roster_player_ids get is_active=true, all others get is_active=false.
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { team_id, start_date, active_roster_player_ids } = await request.json();

  if (!team_id || !start_date || !Array.isArray(active_roster_player_ids)) {
    return NextResponse.json({ error: "team_id, start_date, and active_roster_player_ids required" }, { status: 400 });
  }

  const date = new Date(start_date);
  const season_year = date.getFullYear();
  const week_number = getWeekNumber(date);
  const activeSet = new Set<string>(active_roster_player_ids);

  // Fetch full roster to know all players and their mlb_player_id + position
  const { data: roster, error: rosterErr } = await supabase
    .from("roster_players")
    .select("id, mlb_player_id, primary_position, is_pitcher")
    .eq("team_id", team_id)
    .is("dropped_at", null);

  if (rosterErr) return NextResponse.json({ error: rosterErr.message }, { status: 500 });

  const rows = (roster ?? []).map((p) => ({
    team_id,
    week_number,
    season_year,
    roster_player_id: p.id,
    mlb_player_id: p.mlb_player_id,
    activated_position: p.primary_position,
    is_active: activeSet.has(p.id),
  }));

  const { error } = await supabase
    .from("weekly_lineups")
    .upsert(rows, { onConflict: "team_id,week_number,season_year,roster_player_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: rows.length, week_number, season_year });
}

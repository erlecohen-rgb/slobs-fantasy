import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// POST /api/admin/lineup-lock
// Body: { locked: boolean, week_number: number, season_year: number, team_id?: string }
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { locked, week_number, season_year, team_id } = await request.json();

  if (typeof locked !== "boolean" || !week_number || !season_year) {
    return NextResponse.json({ error: "locked, week_number, and season_year are required" }, { status: 400 });
  }

  let query = supabase
    .from("weekly_lineups")
    .update({ locked })
    .eq("week_number", week_number)
    .eq("season_year", season_year);

  if (team_id) query = query.eq("team_id", team_id);

  const { data, error } = await query.select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ updated: data?.length ?? 0, locked });
}

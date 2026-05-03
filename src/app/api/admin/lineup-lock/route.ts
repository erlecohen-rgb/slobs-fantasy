import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// POST /api/admin/lineup-lock
// Body: { locked: boolean, week_number: number, season_year: number }
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { locked, week_number, season_year } = await request.json();

  if (typeof locked !== "boolean" || !week_number || !season_year) {
    return NextResponse.json({ error: "locked, week_number, and season_year are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weekly_lineups")
    .update({ locked })
    .eq("week_number", week_number)
    .eq("season_year", season_year)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ updated: data?.length ?? 0, locked });
}

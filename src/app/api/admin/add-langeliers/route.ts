import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const LEAGUE_ID = "01756471-3bd1-4e83-8533-093d9e97bb86";

export async function GET() {
  const supabase = createServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", LEAGUE_ID)
    .eq("name", "Rippers")
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "Rippers team not found" }, { status: 404 });
  }

  const { error } = await supabase.from("roster_players").insert({
    team_id: team.id,
    mlb_player_id: 669127,
    mlb_player_name: "Shea Langeliers",
    mlb_team: "ATH",
    primary_position: "C",
    is_pitcher: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, added: "Shea Langeliers" });
}

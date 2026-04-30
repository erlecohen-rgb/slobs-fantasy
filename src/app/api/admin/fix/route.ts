import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const LEAGUE_ID = "01756471-3bd1-4e83-8533-093d9e97bb86";

export async function GET() {
  const supabase = createServiceClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", LEAGUE_ID)
    .eq("name", "Rippers")
    .single();

  if (!team) return NextResponse.json({ error: "Rippers not found" }, { status: 404 });

  const { error } = await supabase
    .from("roster_players")
    .update({ primary_position: "DH" })
    .eq("team_id", team.id)
    .eq("mlb_player_id", 701398);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: "Sal Stewart → DH" });
}

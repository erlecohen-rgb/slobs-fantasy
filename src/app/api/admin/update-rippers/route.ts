import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const LEAGUE_ID = "01756471-3bd1-4e83-8533-093d9e97bb86";

const RIPPERS_PLAYERS = [
  { mlb_player_id: 669127, mlb_player_name: "Shea Langeliers",     mlb_team: "ATH", primary_position: "C",  is_pitcher: false },
  { mlb_player_id: 621566, mlb_player_name: "Matt Olson",          mlb_team: "ATL", primary_position: "1B", is_pitcher: false },
  { mlb_player_id: 701398, mlb_player_name: "Sal Stewart",         mlb_team: "CIN", primary_position: "1B", is_pitcher: false },
  { mlb_player_id: 702284, mlb_player_name: "Cole Young",          mlb_team: "SEA", primary_position: "2B", is_pitcher: false },
  { mlb_player_id: 663586, mlb_player_name: "Austin Riley",        mlb_team: "ATL", primary_position: "3B", is_pitcher: false },
  { mlb_player_id: 682928, mlb_player_name: "CJ Abrams",           mlb_team: "WSH", primary_position: "SS", is_pitcher: false },
  { mlb_player_id: 666176, mlb_player_name: "Jo Adell",            mlb_team: "LAA", primary_position: "RF", is_pitcher: false },
  { mlb_player_id: 691016, mlb_player_name: "Tyler Soderstrom",    mlb_team: "ATH", primary_position: "LF", is_pitcher: false },
  { mlb_player_id: 669065, mlb_player_name: "Kyle Stowers",        mlb_team: "MIA", primary_position: "LF", is_pitcher: false },
  { mlb_player_id: 650911, mlb_player_name: "Cristopher Sanchez",  mlb_team: "PHI", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 664285, mlb_player_name: "Framber Valdez",      mlb_team: "DET", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 813349, mlb_player_name: "Connelly Early",      mlb_team: "BOS", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 666200, mlb_player_name: "Jesus Luzardo",       mlb_team: "PHI", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 686754, mlb_player_name: "Ryan Jensen",         mlb_team: "MIN", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 664126, mlb_player_name: "Pete Fairbanks",      mlb_team: "MIA", primary_position: "RP", is_pitcher: true  },
];

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

  await supabase.from("roster_players").delete().eq("team_id", team.id);

  const { error } = await supabase
    .from("roster_players")
    .insert(RIPPERS_PLAYERS.map((p) => ({ team_id: team.id, ...p })));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, players: RIPPERS_PLAYERS.length });
}

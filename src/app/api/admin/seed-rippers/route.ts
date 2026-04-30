import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const LEAGUE_ID = "01756471-3bd1-4e83-8533-093d9e97bb86";

const RIPPERS_PLAYERS = [
  { mlb_player_id: 660670, mlb_player_name: "Ronald Acuna Jr.", mlb_team: "ATL", primary_position: "RF", is_pitcher: false },
  { mlb_player_id: 670541, mlb_player_name: "Yordan Alvarez", mlb_team: "HOU", primary_position: "LF", is_pitcher: false },
  { mlb_player_id: 624413, mlb_player_name: "Pete Alonso", mlb_team: "BAL", primary_position: "1B", is_pitcher: false },
  { mlb_player_id: 646240, mlb_player_name: "Rafael Devers", mlb_team: "SF", primary_position: "3B", is_pitcher: false },
  { mlb_player_id: 683002, mlb_player_name: "Gunnar Henderson", mlb_team: "BAL", primary_position: "SS", is_pitcher: false },
  { mlb_player_id: 665487, mlb_player_name: "Fernando Tatis Jr.", mlb_team: "SD", primary_position: "SS", is_pitcher: false },
  { mlb_player_id: 665742, mlb_player_name: "Juan Soto", mlb_team: "NYM", primary_position: "RF", is_pitcher: false },
  { mlb_player_id: 682998, mlb_player_name: "Corbin Carroll", mlb_team: "ARI", primary_position: "CF", is_pitcher: false },
  { mlb_player_id: 671739, mlb_player_name: "Michael Harris II", mlb_team: "ATL", primary_position: "CF", is_pitcher: false },
  { mlb_player_id: 661388, mlb_player_name: "William Contreras", mlb_team: "MIL", primary_position: "C", is_pitcher: false },
  { mlb_player_id: 665862, mlb_player_name: "Jazz Chisholm Jr.", mlb_team: "NYY", primary_position: "2B", is_pitcher: false },
  { mlb_player_id: 621566, mlb_player_name: "Matt Olson", mlb_team: "ATL", primary_position: "1B", is_pitcher: false },
  { mlb_player_id: 682829, mlb_player_name: "Elly De La Cruz", mlb_team: "CIN", primary_position: "SS", is_pitcher: false },
  { mlb_player_id: 669373, mlb_player_name: "Tarik Skubal", mlb_team: "DET", primary_position: "SP", is_pitcher: true },
  { mlb_player_id: 664285, mlb_player_name: "Framber Valdez", mlb_team: "DET", primary_position: "SP", is_pitcher: true },
  { mlb_player_id: 694973, mlb_player_name: "Paul Skenes", mlb_team: "PIT", primary_position: "SP", is_pitcher: true },
  { mlb_player_id: 519242, mlb_player_name: "Chris Sale", mlb_team: "ATL", primary_position: "SP", is_pitcher: true },
  { mlb_player_id: 623352, mlb_player_name: "Josh Hader", mlb_team: "HOU", primary_position: "RP", is_pitcher: true },
  { mlb_player_id: 642585, mlb_player_name: "Felix Bautista", mlb_team: "BAL", primary_position: "RP", is_pitcher: true },
  { mlb_player_id: 664747, mlb_player_name: "Alexis Diaz", mlb_team: "CIN", primary_position: "RP", is_pitcher: true },
  { mlb_player_id: 695243, mlb_player_name: "Mason Miller", mlb_team: "SD", primary_position: "RP", is_pitcher: true },
];

export async function GET() {
  const supabase = createServiceClient();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", LEAGUE_ID)
    .eq("name", "Rippers")
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "Rippers team not found" }, { status: 404 });
  }

  await supabase.from("roster_players").delete().eq("team_id", team.id);

  const { error: insertError } = await supabase
    .from("roster_players")
    .insert(RIPPERS_PLAYERS.map((p) => ({ team_id: team.id, ...p })));

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, team: team.name, players: RIPPERS_PLAYERS.length });
}

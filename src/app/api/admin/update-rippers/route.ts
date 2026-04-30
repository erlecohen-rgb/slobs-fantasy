import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const LEAGUE_ID = "01756471-3bd1-4e83-8533-093d9e97bb86";

const RIPPERS_PLAYERS = [
  // C
  { mlb_player_id: 669127, mlb_player_name: "Shea Langeliers",    mlb_team: "ATH", primary_position: "C",  is_pitcher: false },
  { mlb_player_id: 666310, mlb_player_name: "Bo Naylor",          mlb_team: "CLE", primary_position: "C",  is_pitcher: false },
  // 1B
  { mlb_player_id: 621566, mlb_player_name: "Matt Olson",         mlb_team: "ATL", primary_position: "1B", is_pitcher: false },
  { mlb_player_id: 701398, mlb_player_name: "Sal Stewart",        mlb_team: "CIN", primary_position: "1B", is_pitcher: false },
  // 2B
  { mlb_player_id: 680574, mlb_player_name: "Matt McLain",        mlb_team: "CIN", primary_position: "2B", is_pitcher: false },
  { mlb_player_id: 702284, mlb_player_name: "Cole Young",         mlb_team: "SEA", primary_position: "2B", is_pitcher: false },
  // 3B
  { mlb_player_id: 663586, mlb_player_name: "Austin Riley",       mlb_team: "ATL", primary_position: "3B", is_pitcher: false },
  { mlb_player_id: 571970, mlb_player_name: "Max Muncy",          mlb_team: "LAD", primary_position: "3B", is_pitcher: false },
  // SS
  { mlb_player_id: 682928, mlb_player_name: "CJ Abrams",          mlb_team: "WSH", primary_position: "SS", is_pitcher: false },
  { mlb_player_id: 695657, mlb_player_name: "Colson Montgomery",  mlb_team: "CWS", primary_position: "SS", is_pitcher: false },
  // OF
  { mlb_player_id: 665742, mlb_player_name: "Juan Soto",          mlb_team: "NYM", primary_position: "RF", is_pitcher: false },
  { mlb_player_id: 691016, mlb_player_name: "Tyler Soderstrom",   mlb_team: "ATH", primary_position: "LF", is_pitcher: false },
  { mlb_player_id: 666176, mlb_player_name: "Jo Adell",           mlb_team: "LAA", primary_position: "RF", is_pitcher: false },
  { mlb_player_id: 669065, mlb_player_name: "Kyle Stowers",       mlb_team: "MIA", primary_position: "LF", is_pitcher: false },
  { mlb_player_id: 691783, mlb_player_name: "Jordan Lawlar",      mlb_team: "ARI", primary_position: "SS", is_pitcher: false },
  // SP
  { mlb_player_id: 650911, mlb_player_name: "Cristopher Sanchez", mlb_team: "PHI", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 664285, mlb_player_name: "Framber Valdez",     mlb_team: "DET", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 666200, mlb_player_name: "Jesus Luzardo",      mlb_team: "PHI", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 645261, mlb_player_name: "Sandy Alcantara",    mlb_team: "MIA", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 669432, mlb_player_name: "Trevor Rogers",      mlb_team: "BAL", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 837227, mlb_player_name: "Tatsuya Imai",       mlb_team: "HOU", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 664074, mlb_player_name: "Cody Ponce",         mlb_team: "TOR", primary_position: "SP", is_pitcher: true  },
  { mlb_player_id: 813349, mlb_player_name: "Connelly Early",     mlb_team: "BOS", primary_position: "SP", is_pitcher: true  },
  // RP
  { mlb_player_id: 656546, mlb_player_name: "Jeff Hoffman",       mlb_team: "TOR", primary_position: "RP", is_pitcher: true  },
  { mlb_player_id: 664126, mlb_player_name: "Pete Fairbanks",     mlb_team: "MIA", primary_position: "RP", is_pitcher: true  },
  { mlb_player_id: 445276, mlb_player_name: "Kenley Jansen",      mlb_team: "DET", primary_position: "RP", is_pitcher: true  },
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

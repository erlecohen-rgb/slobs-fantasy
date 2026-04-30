import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Known corrections for players imported with abbreviated/misspelled names.
// Add entries here whenever a player name can't be resolved via MLB search.
const KNOWN_FIXES: {
  namePattern: string;
  mlb_player_name: string;
  mlb_player_id: number;
  mlb_team: string;
  primary_position: string;
  is_pitcher: boolean;
}[] = [
  {
    namePattern: "P C A",
    mlb_player_name: "Pete Crow-Armstrong",
    mlb_player_id: 691718,
    mlb_team: "CHC",
    primary_position: "CF",
    is_pitcher: false,
  },
  {
    namePattern: "L. Gilbert",
    mlb_player_name: "Logan Gilbert",
    mlb_player_id: 669302,
    mlb_team: "SEA",
    primary_position: "SP",
    is_pitcher: true,
  },
  {
    namePattern: "E Diaz",
    mlb_player_name: "Edwin Diaz",
    mlb_player_id: 621242,
    mlb_team: "LAD",
    primary_position: "RP",
    is_pitcher: true,
  },
];

export async function POST() {
  const supabase = createServiceClient();
  const applied: { from: string; to: string; count: number }[] = [];
  const errors: string[] = [];

  for (const fix of KNOWN_FIXES) {
    const { data, error } = await supabase
      .from("roster_players")
      .update({
        mlb_player_name: fix.mlb_player_name,
        mlb_player_id: fix.mlb_player_id,
        mlb_team: fix.mlb_team,
        primary_position: fix.primary_position,
        is_pitcher: fix.is_pitcher,
      })
      .eq("mlb_player_name", fix.namePattern)
      .select();

    if (error) {
      errors.push(`${fix.namePattern}: ${error.message}`);
    } else {
      applied.push({ from: fix.namePattern, to: fix.mlb_player_name, count: data?.length ?? 0 });
    }
  }

  return NextResponse.json({ applied, errors });
}

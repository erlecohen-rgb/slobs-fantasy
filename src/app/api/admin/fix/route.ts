import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const FIXES = [
  { match: "PCA",       mlb_player_id: 691718, mlb_player_name: "Pete Crow-Armstrong", mlb_team: "CHC", primary_position: "OF",  is_pitcher: false },
  { match: "L. Gilbert",mlb_player_id: 669302, mlb_player_name: "Logan Gilbert",       mlb_team: "SEA", primary_position: "SP",  is_pitcher: true  },
  { match: "E Diaz",    mlb_player_id: 621242, mlb_player_name: "Edwin Diaz",           mlb_team: "LAD", primary_position: "RP",  is_pitcher: true  },
];

export async function GET() {
  const supabase = createServiceClient();
  const results = [];

  for (const fix of FIXES) {
    const { data, error } = await supabase
      .from("roster_players")
      .update({
        mlb_player_id: fix.mlb_player_id,
        mlb_player_name: fix.mlb_player_name,
        mlb_team: fix.mlb_team,
        primary_position: fix.primary_position,
        is_pitcher: fix.is_pitcher,
      })
      .ilike("mlb_player_name", fix.match)
      .select("id, mlb_player_name");

    results.push({ match: fix.match, updated: data?.length ?? 0, error: error?.message });
  }

  return NextResponse.json({ ok: true, results });
}

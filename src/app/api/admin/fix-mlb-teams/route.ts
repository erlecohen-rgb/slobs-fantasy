import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getPlayer } from "@/lib/mlb-api";

// POST /api/admin/fix-mlb-teams
// For every roster player with mlb_team='TBD' and a valid mlb_player_id,
// look up their current team from the MLB API and update the record.
export async function POST() {
  const supabase = createServiceClient();

  const { data: players, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_id, mlb_player_name, mlb_team")
    .eq("mlb_team", "TBD")
    .neq("mlb_player_id", 0)
    .is("dropped_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players?.length) return NextResponse.json({ updated: [], failed: [] });

  const updated: { name: string; team: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const player of players) {
    try {
      const mlbPlayer = await getPlayer(player.mlb_player_id);
      const team = mlbPlayer?.currentTeam?.abbreviation;

      if (!team) {
        failed.push({ name: player.mlb_player_name, reason: "No current team found (may be FA or inactive)" });
        continue;
      }

      const { error: updateErr } = await supabase
        .from("roster_players")
        .update({ mlb_team: team })
        .eq("id", player.id);

      if (updateErr) {
        failed.push({ name: player.mlb_player_name, reason: updateErr.message });
      } else {
        updated.push({ name: player.mlb_player_name, team });
      }
    } catch (err) {
      failed.push({ name: player.mlb_player_name, reason: String(err) });
    }
  }

  return NextResponse.json({ updated, failed });
}

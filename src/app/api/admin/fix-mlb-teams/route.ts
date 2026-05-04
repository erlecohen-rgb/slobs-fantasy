import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getActiveRosterPlayers } from "@/lib/mlb-api";

// POST /api/admin/fix-mlb-teams
// Looks up current team for every roster_player where mlb_team='TBD'.
export async function POST() {
  const supabase = createServiceClient();

  const { data: players, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_id, mlb_player_name")
    .eq("mlb_team", "TBD")
    .neq("mlb_player_id", 0)
    .is("dropped_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players?.length) return NextResponse.json({ updated: [], failed: [], message: "No TBD teams found" });

  // Fetch active roster with currentTeam hydrated (includes abbreviation)
  const activeRoster = await getActiveRosterPlayers();

  // Build playerId → team abbreviation from hydrated currentTeam
  const playerTeam = new Map<number, string>();
  for (const p of activeRoster) {
    const team = p.currentTeam;
    if (team?.abbreviation) {
      playerTeam.set(p.id, team.abbreviation);
    } else if (team?.id) {
      // fallback: use numeric team id as string if abbreviation missing
      playerTeam.set(p.id, String(team.id));
    }
  }

  const updated: { name: string; team: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const player of players) {
    const team = playerTeam.get(player.mlb_player_id);
    if (!team) {
      failed.push({ name: player.mlb_player_name, reason: "Not on active MLB roster (IL, minors, or FA)" });
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
  }

  return NextResponse.json({ updated, failed });
}

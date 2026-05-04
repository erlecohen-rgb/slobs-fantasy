import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

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

  // Batch-lookup all player IDs directly with currentTeam hydrated
  const personIds = players.map((p) => p.mlb_player_id).join(",");
  const res = await fetch(`${MLB_API_BASE}/people?personIds=${personIds}&hydrate=currentTeam`);
  const mlbData = await res.json();
  const mlbPeople: { id: number; currentTeam?: { abbreviation?: string } }[] = mlbData.people || [];

  // Build playerId → team abbreviation
  const playerTeam = new Map<number, string>();
  for (const p of mlbPeople) {
    const abbr = p.currentTeam?.abbreviation;
    if (abbr) playerTeam.set(p.id, abbr);
  }

  const updated: { name: string; team: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const player of players) {
    const team = playerTeam.get(player.mlb_player_id);
    if (!team) {
      failed.push({ name: player.mlb_player_name, reason: "No current team found (may be IL, minors, or invalid ID)" });
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

  return NextResponse.json({
    updated,
    failed,
    debug: { lookedUpIds: players.map((p) => ({ name: p.mlb_player_name, id: p.mlb_player_id })), foundInMlb: mlbPeople.length },
  });
}

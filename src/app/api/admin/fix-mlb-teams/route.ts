import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { searchPlayers } from "@/lib/mlb-api";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

// Parse "LastName, F" → { lastName, initial }
function parseName(stored: string): { lastName: string; initial: string } {
  const comma = stored.indexOf(",");
  if (comma === -1) return { lastName: stored.trim(), initial: "" };
  const lastName = stored.slice(0, comma).trim();
  const initial = stored.slice(comma + 1).trim()[0]?.toUpperCase() ?? "";
  return { lastName, initial };
}

// POST /api/admin/fix-mlb-teams
// Looks up current team for every roster_player where mlb_team='TBD'.
export async function POST() {
  const supabase = createServiceClient();

  const { data: players, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_id, mlb_player_name")
    .eq("mlb_team", "TBD")
    .is("dropped_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players?.length) return NextResponse.json({ updated: [], failed: [], message: "No TBD teams found" });

  // Search by last name for each player and collect resolved MLB player IDs
  const resolvedIds = new Map<string, number>(); // roster player id → mlb player id
  const searchFailed: string[] = [];

  for (const player of players) {
    const { lastName, initial } = parseName(player.mlb_player_name);
    const results = await searchPlayers(lastName);

    // Filter to active players whose first name starts with the initial
    const matches = results.filter((p) =>
      !initial || p.firstName?.toUpperCase().startsWith(initial)
    );

    if (matches.length === 0) {
      searchFailed.push(player.mlb_player_name);
    } else {
      // Prefer exact last name match; fall back to first result
      const best =
        matches.find((p) => p.lastName?.toLowerCase() === lastName.toLowerCase()) ?? matches[0];
      resolvedIds.set(player.id, best.id);
    }
  }

  // Batch-lookup resolved MLB IDs with currentTeam hydrated
  const mlbIds = [...new Set(resolvedIds.values())].join(",");
  const teamByMlbId = new Map<number, string>();

  if (mlbIds) {
    const res = await fetch(`${MLB_API_BASE}/people?personIds=${mlbIds}&hydrate=currentTeam`);
    const mlbData = await res.json();
    for (const p of mlbData.people ?? []) {
      const abbr = p.currentTeam?.abbreviation;
      if (abbr) teamByMlbId.set(p.id, abbr);
    }
  }

  const updated: { name: string; team: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const player of players) {
    if (searchFailed.includes(player.mlb_player_name)) {
      failed.push({ name: player.mlb_player_name, reason: "No MLB player found by name" });
      continue;
    }

    const mlbId = resolvedIds.get(player.id);
    const team = mlbId ? teamByMlbId.get(mlbId) : undefined;

    if (!team) {
      failed.push({ name: player.mlb_player_name, reason: "Player found but no current team (IL or minors)" });
      continue;
    }

    const { error: updateErr } = await supabase
      .from("roster_players")
      .update({ mlb_team: team, mlb_player_id: mlbId! })
      .eq("id", player.id);

    if (updateErr) {
      failed.push({ name: player.mlb_player_name, reason: updateErr.message });
    } else {
      updated.push({ name: player.mlb_player_name, team });
    }
  }

  return NextResponse.json({ updated, failed });
}

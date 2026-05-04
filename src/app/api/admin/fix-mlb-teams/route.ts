import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

interface MlbPerson {
  id: number;
  lastName: string;
  firstName: string;
  currentTeam?: { abbreviation?: string };
}

async function getAllPlayersWithTeams(season: number): Promise<MlbPerson[]> {
  const res = await fetch(
    `${MLB_API_BASE}/sports/1/players?season=${season}&hydrate=currentTeam`
  );
  const data = await res.json();
  return data.people || [];
}

function parseName(stored: string): { lastName: string; initial: string } {
  const comma = stored.indexOf(",");
  if (comma === -1) return { lastName: stored.trim(), initial: "" };
  const lastName = stored.slice(0, comma).trim();
  const initial = stored.slice(comma + 1).trim()[0]?.toUpperCase() ?? "";
  return { lastName, initial };
}

// POST /api/admin/fix-mlb-teams
export async function POST() {
  const supabase = createServiceClient();

  const { data: players, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_id, mlb_player_name")
    .eq("mlb_team", "TBD")
    .is("dropped_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players?.length) return NextResponse.json({ updated: [], failed: [], message: "No TBD teams found" });

  const season = new Date().getFullYear();
  const allMlbPlayers = await getAllPlayersWithTeams(season);

  const byLastName = new Map<string, MlbPerson[]>();
  for (const p of allMlbPlayers) {
    const key = p.lastName?.toLowerCase() ?? "";
    if (!byLastName.has(key)) byLastName.set(key, []);
    byLastName.get(key)!.push(p);
  }

  const updated: { name: string; team: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const player of players) {
    const { lastName, initial } = parseName(player.mlb_player_name);
    const candidates = byLastName.get(lastName.toLowerCase()) ?? [];

    const matches = initial
      ? candidates.filter((p) => p.firstName?.toUpperCase().startsWith(initial))
      : candidates;

    if (matches.length === 0) {
      failed.push({ name: player.mlb_player_name, reason: `No MLB player found for "${lastName}"` });
      continue;
    }

    const best =
      matches.find((p) => p.lastName?.toLowerCase() === lastName.toLowerCase()) ?? matches[0];

    const team = best.currentTeam?.abbreviation;
    if (!team) {
      failed.push({ name: player.mlb_player_name, reason: "Player found but no current team" });
      continue;
    }

    const { error: updateErr } = await supabase
      .from("roster_players")
      .update({ mlb_team: team, mlb_player_id: best.id })
      .eq("id", player.id);

    if (updateErr) {
      failed.push({ name: player.mlb_player_name, reason: updateErr.message });
    } else {
      updated.push({ name: player.mlb_player_name, team });
    }
  }

  return NextResponse.json({ updated, failed });
}

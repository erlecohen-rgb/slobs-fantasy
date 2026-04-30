import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const MLB_API = "https://statsapi.mlb.com/api/v1";

async function lookupPlayer(name: string) {
  try {
    const res = await fetch(
      `${MLB_API}/people/search?names=${encodeURIComponent(name)}&sportId=1&active=true`
    );
    const data = await res.json();
    const people = data.people || [];
    if (people.length === 0) return null;
    // Return best match (first result)
    const p = people[0];
    return {
      id: p.id,
      team: p.currentTeam?.abbreviation || "TBD",
      position: p.primaryPosition?.abbreviation || "UTIL",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = createServiceClient();

  // Fetch all players with no MLB ID, skipping Grumpy Grizzlies and Rippers
  const { data: players, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_name, mlb_player_id, teams!inner(name)")
    .eq("mlb_player_id", 0);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!players || players.length === 0) {
    return NextResponse.json({ ok: true, message: "No players need resolving" });
  }

  const results: { name: string; id: number | null; team: string; status: string }[] = [];

  for (const player of players) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamName = (player.teams as any)?.name;
    if (teamName === "Grumpy Grizzlies" || teamName === "Rippers") continue;

    const found = await lookupPlayer(player.mlb_player_name);
    if (found && found.id) {
      await supabase
        .from("roster_players")
        .update({
          mlb_player_id: found.id,
          mlb_team: found.team,
          primary_position: found.position,
        })
        .eq("id", player.id);
      results.push({ name: player.mlb_player_name, id: found.id, team: found.team, status: "updated" });
    } else {
      results.push({ name: player.mlb_player_name, id: null, team: "", status: "not found" });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

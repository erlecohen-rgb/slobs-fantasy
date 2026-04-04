import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// POST /api/roster/import — bulk import rosters from spreadsheet data
// Body: { league_id, teams: { [team_name]: [{ position, name, is_pitcher }] } }
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { league_id, teams } = body;

  if (!league_id || !teams) {
    return NextResponse.json({ error: "league_id and teams required" }, { status: 400 });
  }

  const results: Record<string, unknown>[] = [];

  for (const [teamName, players] of Object.entries(teams)) {
    const playerList = players as { position: string; name: string; is_pitcher: boolean }[];

    // Find or create team
    let { data: team } = await supabase
      .from("teams")
      .select("id, name")
      .eq("league_id", league_id)
      .eq("name", teamName)
      .single();

    if (!team) {
      // Create the team
      const { data: newTeam, error } = await supabase
        .from("teams")
        .insert({
          league_id,
          name: teamName,
          owner_user_id: teamName.toLowerCase().replace(/[^a-z]/g, "_"),
          total_points: 0,
        })
        .select()
        .single();

      if (error) {
        results.push({ team: teamName, error: error.message });
        continue;
      }
      team = newTeam;
    }

    // Delete existing roster players for this team
    await supabase
      .from("roster_players")
      .delete()
      .eq("team_id", team!.id);

    // Insert new roster players
    const rosterInserts = playerList.map((p) => ({
      team_id: team!.id,
      mlb_player_id: 0, // Will be resolved later via MLB API search
      mlb_player_name: p.name,
      mlb_team: "TBD",
      primary_position: p.position,
      is_pitcher: p.is_pitcher,
    }));

    const { error: insertError } = await supabase
      .from("roster_players")
      .insert(rosterInserts);

    if (insertError) {
      results.push({ team: teamName, error: insertError.message });
    } else {
      results.push({ team: teamName, players: playerList.length, teamId: team!.id });
    }
  }

  return NextResponse.json({ results });
}

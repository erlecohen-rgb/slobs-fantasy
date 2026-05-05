import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const JOE_RYAN = {
  mlb_player_name: "Joe Ryan",
  mlb_player_id: 657746,
  mlb_team: "MIN",
  primary_position: "SP",
  is_pitcher: true,
};

// POST /api/admin/fix-gladhanders-ryan
// Drops any wrongly-resolved "Ryan, J" entry on Gladhanders (e.g. NYY 3B)
// and ensures Joe Ryan (MIN SP, id 657746) is on the roster.
export async function POST() {
  const supabase = createServiceClient();

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id")
    .ilike("name", "Gladhanders")
    .limit(1)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: "Gladhanders team not found" }, { status: 404 });
  }

  const teamId = team.id;
  const actions: string[] = [];

  // Drop any "Ryan, J" entry that is NOT Joe Ryan (wrong mlb_player_id or wrong team/position)
  const { data: wrongRyans } = await supabase
    .from("roster_players")
    .select("id, mlb_player_name, mlb_team, primary_position, mlb_player_id")
    .eq("team_id", teamId)
    .ilike("mlb_player_name", "Ryan, J")
    .is("dropped_at", null)
    .neq("mlb_player_id", JOE_RYAN.mlb_player_id);

  for (const p of wrongRyans ?? []) {
    const { error } = await supabase
      .from("roster_players")
      .delete()
      .eq("id", p.id);
    if (!error) {
      actions.push(`Dropped wrong Ryan, J (${p.mlb_team} ${p.primary_position}, id ${p.mlb_player_id})`);
    }
  }

  // Fix any "Ryan, J" or "Joe Ryan" entry that has the right ID but wrong data
  const { data: partialRyans } = await supabase
    .from("roster_players")
    .select("id, mlb_player_name, mlb_team, primary_position")
    .eq("team_id", teamId)
    .eq("mlb_player_id", JOE_RYAN.mlb_player_id)
    .is("dropped_at", null);

  for (const p of partialRyans ?? []) {
    const { error } = await supabase
      .from("roster_players")
      .update(JOE_RYAN)
      .eq("id", p.id);
    if (!error) {
      actions.push(`Corrected ${p.mlb_player_name} (${p.mlb_team} ${p.primary_position}) → Joe Ryan (MIN SP)`);
    }
  }

  // If Joe Ryan is not on the roster at all, check by name and fix, or insert
  const { data: existing } = await supabase
    .from("roster_players")
    .select("id, mlb_player_name, mlb_team, primary_position, mlb_player_id")
    .eq("team_id", teamId)
    .is("dropped_at", null)
    .or(`mlb_player_name.ilike.Joe Ryan,mlb_player_name.ilike.Ryan%`);

  const hasJoeRyan = existing?.some((p) => p.mlb_player_id === JOE_RYAN.mlb_player_id);

  if (!hasJoeRyan && existing && existing.length > 0) {
    // There's a Ryan entry that wasn't caught above — update the first one
    const { error } = await supabase
      .from("roster_players")
      .update(JOE_RYAN)
      .eq("id", existing[0].id);
    if (!error) {
      actions.push(
        `Updated ${existing[0].mlb_player_name} (${existing[0].mlb_team}) → Joe Ryan (MIN SP, id 657746)`
      );
    }
  }

  if (actions.length === 0) {
    // Verify Joe Ryan is present
    const { data: check } = await supabase
      .from("roster_players")
      .select("id")
      .eq("team_id", teamId)
      .eq("mlb_player_id", JOE_RYAN.mlb_player_id)
      .is("dropped_at", null);
    if (check?.length) {
      actions.push("Joe Ryan (MIN SP) already correct on Gladhanders — no changes needed");
    } else {
      actions.push("No Ryan entry found on Gladhanders to fix");
    }
  }

  return NextResponse.json({ actions });
}

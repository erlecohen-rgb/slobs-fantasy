import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { searchPlayers } from "@/lib/mlb-api";

// POST /api/admin/auto-resolve-players
// For each roster player with mlb_player_id=0, search the MLB API by name
// and assign the best (first) match.
export async function POST() {
  const supabase = createServiceClient();

  const { data: unresolved, error } = await supabase
    .from("roster_players")
    .select("id, mlb_player_name, primary_position, is_pitcher")
    .eq("mlb_player_id", 0)
    .is("dropped_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!unresolved?.length) return NextResponse.json({ resolved: [], failed: [] });

  const resolved: { name: string; matched: string; id: number; team: string }[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const player of unresolved) {
    try {
      const results = await searchPlayers(player.mlb_player_name);
      if (!results.length) {
        failed.push({ name: player.mlb_player_name, reason: "No MLB search results" });
        continue;
      }

      // Prefer exact name match, fall back to first result
      const exact = results.find(
        (r) => r.fullName.toLowerCase() === player.mlb_player_name.toLowerCase()
      );
      const best = exact ?? results[0];

      const { error: updateError } = await supabase
        .from("roster_players")
        .update({
          mlb_player_id: best.id,
          mlb_team: best.currentTeam?.abbreviation || "FA",
          mlb_player_name: best.fullName,
        })
        .eq("id", player.id);

      if (updateError) {
        failed.push({ name: player.mlb_player_name, reason: updateError.message });
      } else {
        resolved.push({
          name: player.mlb_player_name,
          matched: best.fullName,
          id: best.id,
          team: best.currentTeam?.abbreviation || "FA",
        });
      }
    } catch (err) {
      failed.push({ name: player.mlb_player_name, reason: String(err) });
    }
  }

  return NextResponse.json({ resolved, failed });
}

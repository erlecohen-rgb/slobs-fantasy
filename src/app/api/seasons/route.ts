import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/seasons — list all seasons (optionally filter archived)
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const { data, error } = await supabase
    .from("leagues")
    .select("*, teams(id, name, owner_user_id, total_points)")
    .order("season_year", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter archived based on settings.archived flag
  const filtered = showArchived
    ? data
    : (data || []).filter((s) => !(s.settings as Record<string, unknown>)?.archived);

  return NextResponse.json({ seasons: filtered });
}

// POST /api/seasons — create a new season
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { season_year, season_start_date, display_name, copy_teams_from_season } = body;

  if (!season_year || !season_start_date) {
    return NextResponse.json(
      { error: "season_year and season_start_date are required" },
      { status: 400 }
    );
  }

  // Create the new league/season
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: "SLOBS",
      season_year,
      season_start_date,
      commissioner_user_id: "commissioner",
      settings: {
        display_name: display_name || `${season_year} Season`,
        archived: false,
        max_roster_size: 26,
        active_batters: 13,
        active_pitchers_sp: 4,
        active_pitchers_rp: 4,
        roster_lock_day: "monday",
        roster_lock_hour: 12,
        roster_lock_timezone: "America/Los_Angeles",
        redraft_dates: [],
      },
    })
    .select()
    .single();

  if (leagueError) {
    return NextResponse.json({ error: leagueError.message }, { status: 500 });
  }

  // Optionally copy teams from a previous season
  if (copy_teams_from_season) {
    const { data: prevLeague } = await supabase
      .from("leagues")
      .select("id")
      .eq("name", "SLOBS")
      .eq("season_year", copy_teams_from_season)
      .single();

    if (prevLeague) {
      const { data: prevTeams } = await supabase
        .from("teams")
        .select("name, owner_user_id")
        .eq("league_id", prevLeague.id);

      if (prevTeams && prevTeams.length > 0) {
        await supabase.from("teams").insert(
          prevTeams.map((t) => ({
            league_id: league.id,
            name: t.name,
            owner_user_id: t.owner_user_id,
            total_points: 0,
          }))
        );
      }
    }
  }

  const { data: result } = await supabase
    .from("leagues")
    .select("*, teams(id, name, owner_user_id, total_points)")
    .eq("id", league.id)
    .single();

  return NextResponse.json({ season: result });
}

// PATCH /api/seasons — update season (rename, archive)
export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { id, display_name, archived } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Get current settings
  const { data: current, error: fetchError } = await supabase
    .from("leagues")
    .select("settings")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const settings = (current.settings || {}) as Record<string, unknown>;
  if (display_name !== undefined) settings.display_name = display_name;
  if (archived !== undefined) settings.archived = archived;

  const { error: updateError } = await supabase
    .from("leagues")
    .update({ settings })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

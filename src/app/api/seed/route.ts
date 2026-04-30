import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// POST /api/seed — create the SLOBS league with all 12 teams
export async function POST() {
  const supabase = createServiceClient();

  // Check if league already exists
  const { data: existing } = await supabase
    .from("leagues")
    .select("id")
    .eq("name", "SLOBS")
    .eq("season_year", 2026)
    .single();

  if (existing) {
    return NextResponse.json({ message: "League already seeded", leagueId: existing.id });
  }

  // Create league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: "SLOBS",
      season_year: 2026,
      season_start_date: "2026-03-23",
      commissioner_user_id: "commissioner", // placeholder until John signs up
      settings: {
        display_name: "2026 Demo Season",
        archived: false,
        max_roster_size: 26,
        active_batters: 13,
        active_pitchers_sp: 4,
        active_pitchers_rp: 4,
        roster_lock_day: "monday",
        roster_lock_hour: 12,
        roster_lock_timezone: "America/Los_Angeles",
        redraft_dates: ["2026-05-18", "2026-07-20"],
      },
    })
    .select()
    .single();

  if (leagueError) {
    return NextResponse.json({ error: leagueError.message }, { status: 500 });
  }

  // Create all 12 teams
  const teams = [
    { name: "No Names", owner_user_id: "john_bauer", owner_display: "John Bauer" },
    { name: "Grumpy Grizzlies", owner_user_id: "erle_cohen", owner_display: "Erle Cohen" },
    { name: "Summit Sluggers", owner_user_id: "otto_klein", owner_display: "Otto Klein" },
    { name: "Rainiers", owner_user_id: "ron_housh", owner_display: "Ron Housh" },
    { name: "Rippers", owner_user_id: "doug_lorentz", owner_display: "Doug Lorentz" },
    { name: "Clams", owner_user_id: "don_lorentz", owner_display: "Don Lorentz" },
    { name: "The 44s", owner_user_id: "eric_johnson", owner_display: "Eric Johnson" },
    { name: "Gas Caps", owner_user_id: "gordon_capretto", owner_display: "Gordon Capretto" },
    { name: "Sub Rosa Bombers", owner_user_id: "bill_king", owner_display: "Bill King" },
    { name: "Cherry Creek Crushers", owner_user_id: "jim_paul", owner_display: "Jim Paul" },
    { name: "Lucky Dogs", owner_user_id: "mike_lucke", owner_display: "Mike Lucke" },
    { name: "Summit Law II", owner_user_id: "colin_boyle", owner_display: "Colin Boyle" },
  ];

  const { data: insertedTeams, error: teamsError } = await supabase
    .from("teams")
    .insert(
      teams.map((t) => ({
        league_id: league.id,
        name: t.name,
        owner_user_id: t.owner_user_id,
        total_points: 0,
      }))
    )
    .select();

  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  // Seed demo roster players for Rippers
  const rippers = insertedTeams?.find((t) => t.name === "Rippers");
  if (rippers) {
    const ripperPlayers = [
      { mlb_player_id: 660670, mlb_player_name: "Ronald Acuna Jr.", mlb_team: "ATL", primary_position: "RF", is_pitcher: false },
      { mlb_player_id: 670541, mlb_player_name: "Yordan Alvarez", mlb_team: "HOU", primary_position: "LF", is_pitcher: false },
      { mlb_player_id: 624413, mlb_player_name: "Pete Alonso", mlb_team: "BAL", primary_position: "1B", is_pitcher: false },
      { mlb_player_id: 646240, mlb_player_name: "Rafael Devers", mlb_team: "SF", primary_position: "3B", is_pitcher: false },
      { mlb_player_id: 683002, mlb_player_name: "Gunnar Henderson", mlb_team: "BAL", primary_position: "SS", is_pitcher: false },
      { mlb_player_id: 665487, mlb_player_name: "Fernando Tatis Jr.", mlb_team: "SD", primary_position: "SS", is_pitcher: false },
      { mlb_player_id: 665742, mlb_player_name: "Juan Soto", mlb_team: "NYM", primary_position: "RF", is_pitcher: false },
      { mlb_player_id: 682998, mlb_player_name: "Corbin Carroll", mlb_team: "ARI", primary_position: "CF", is_pitcher: false },
      { mlb_player_id: 671739, mlb_player_name: "Michael Harris II", mlb_team: "ATL", primary_position: "CF", is_pitcher: false },
      { mlb_player_id: 661388, mlb_player_name: "William Contreras", mlb_team: "MIL", primary_position: "C", is_pitcher: false },
      { mlb_player_id: 665862, mlb_player_name: "Jazz Chisholm Jr.", mlb_team: "NYY", primary_position: "2B", is_pitcher: false },
      { mlb_player_id: 621566, mlb_player_name: "Matt Olson", mlb_team: "ATL", primary_position: "1B", is_pitcher: false },
      { mlb_player_id: 682829, mlb_player_name: "Elly De La Cruz", mlb_team: "CIN", primary_position: "SS", is_pitcher: false },
      { mlb_player_id: 669373, mlb_player_name: "Tarik Skubal", mlb_team: "DET", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 664285, mlb_player_name: "Framber Valdez", mlb_team: "DET", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 694973, mlb_player_name: "Paul Skenes", mlb_team: "PIT", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 519242, mlb_player_name: "Chris Sale", mlb_team: "ATL", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 623352, mlb_player_name: "Josh Hader", mlb_team: "HOU", primary_position: "RP", is_pitcher: true },
      { mlb_player_id: 642585, mlb_player_name: "Felix Bautista", mlb_team: "BAL", primary_position: "RP", is_pitcher: true },
      { mlb_player_id: 664747, mlb_player_name: "Alexis Diaz", mlb_team: "CIN", primary_position: "RP", is_pitcher: true },
      { mlb_player_id: 695243, mlb_player_name: "Mason Miller", mlb_team: "SD", primary_position: "RP", is_pitcher: true },
    ];

    await supabase.from("roster_players").insert(
      ripperPlayers.map((p) => ({ team_id: rippers.id, ...p }))
    );
  }

  // Seed some demo roster players for Grumpy Grizzlies
  const grizzlies = insertedTeams?.find((t) => t.name === "Grumpy Grizzlies");
  if (grizzlies) {
    const demoPlayers = [
      { mlb_player_id: 518692, mlb_player_name: "Freddie Freeman", mlb_team: "LAD", primary_position: "1B", is_pitcher: false },
      { mlb_player_id: 596019, mlb_player_name: "Mookie Betts", mlb_team: "LAD", primary_position: "SS", is_pitcher: false },
      { mlb_player_id: 592450, mlb_player_name: "Aaron Judge", mlb_team: "NYY", primary_position: "RF", is_pitcher: false },
      { mlb_player_id: 660271, mlb_player_name: "Shohei Ohtani", mlb_team: "LAD", primary_position: "DH", is_pitcher: false },
      { mlb_player_id: 665489, mlb_player_name: "Bobby Witt Jr.", mlb_team: "KC", primary_position: "SS", is_pitcher: false },
      { mlb_player_id: 677594, mlb_player_name: "Julio Rodriguez", mlb_team: "SEA", primary_position: "CF", is_pitcher: false },
      { mlb_player_id: 621043, mlb_player_name: "Trea Turner", mlb_team: "PHI", primary_position: "SS", is_pitcher: false },
      { mlb_player_id: 608369, mlb_player_name: "Jose Ramirez", mlb_team: "CLE", primary_position: "3B", is_pitcher: false },
      { mlb_player_id: 668939, mlb_player_name: "Kyle Tucker", mlb_team: "CHC", primary_position: "RF", is_pitcher: false },
      { mlb_player_id: 608070, mlb_player_name: "Jose Altuve", mlb_team: "HOU", primary_position: "2B", is_pitcher: false },
      { mlb_player_id: 663728, mlb_player_name: "Adley Rutschman", mlb_team: "BAL", primary_position: "C", is_pitcher: false },
      { mlb_player_id: 605141, mlb_player_name: "Manny Machado", mlb_team: "SD", primary_position: "3B", is_pitcher: false },
      { mlb_player_id: 545361, mlb_player_name: "Mike Trout", mlb_team: "LAA", primary_position: "CF", is_pitcher: false },
      { mlb_player_id: 543037, mlb_player_name: "Gerrit Cole", mlb_team: "NYY", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 675911, mlb_player_name: "Spencer Strider", mlb_team: "ATL", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 669203, mlb_player_name: "Zack Wheeler", mlb_team: "PHI", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 657277, mlb_player_name: "Logan Webb", mlb_team: "SF", primary_position: "SP", is_pitcher: true },
      { mlb_player_id: 681867, mlb_player_name: "Emmanuel Clase", mlb_team: "CLE", primary_position: "RP", is_pitcher: true },
      { mlb_player_id: 656302, mlb_player_name: "Ryan Helsley", mlb_team: "STL", primary_position: "RP", is_pitcher: true },
      { mlb_player_id: 608566, mlb_player_name: "Edwin Diaz", mlb_team: "NYM", primary_position: "RP", is_pitcher: true },
      { mlb_player_id: 622663, mlb_player_name: "Devin Williams", mlb_team: "NYY", primary_position: "RP", is_pitcher: true },
    ];

    await supabase.from("roster_players").insert(
      demoPlayers.map((p) => ({
        team_id: grizzlies.id,
        ...p,
      }))
    );
  }

  return NextResponse.json({
    message: "League seeded successfully",
    leagueId: league.id,
    teams: insertedTeams?.map((t) => ({ id: t.id, name: t.name })),
  });
}

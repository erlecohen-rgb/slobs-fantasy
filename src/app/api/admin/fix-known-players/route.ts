import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Known corrections for players imported with abbreviated/misspelled names.
// Add entries here whenever a player name can't be resolved via MLB search.
const KNOWN_FIXES: {
  namePattern: string;
  mlb_player_name: string;
  mlb_player_id: number;
  mlb_team: string;
  primary_position: string;
  is_pitcher: boolean;
}[] = [
  {
    namePattern: "P C A",
    mlb_player_name: "Pete Crow-Armstrong",
    mlb_player_id: 691718,
    mlb_team: "CHC",
    primary_position: "CF",
    is_pitcher: false,
  },
  {
    namePattern: "L. Gilbert",
    mlb_player_name: "Logan Gilbert",
    mlb_player_id: 669302,
    mlb_team: "SEA",
    primary_position: "SP",
    is_pitcher: true,
  },
  {
    namePattern: "E Diaz",
    mlb_player_name: "Edwin Diaz",
    mlb_player_id: 621242,
    mlb_team: "LAD",
    primary_position: "RP",
    is_pitcher: true,
  },
  // "LastName, F" format players imported from external source
  { namePattern: "Pepiot, R",    mlb_player_name: "Ryan Pepiot",        mlb_player_id: 691648, mlb_team: "TB",  primary_position: "SP", is_pitcher: true  },
  { namePattern: "Holliday, J",  mlb_player_name: "Jackson Holliday",   mlb_player_id: 682998, mlb_team: "BAL", primary_position: "SS", is_pitcher: false },
  { namePattern: "Turner, T",    mlb_player_name: "Trea Turner",         mlb_player_id: 607208, mlb_team: "PHI", primary_position: "SS", is_pitcher: false },
  { namePattern: "Miller, M",    mlb_player_name: "Mason Miller",        mlb_player_id: 694973, mlb_team: "OAK", primary_position: "RP", is_pitcher: true  },
  { namePattern: "De La Cruz, E",mlb_player_name: "Elly De La Cruz",     mlb_player_id: 682829, mlb_team: "CIN", primary_position: "SS", is_pitcher: false },
  { namePattern: "Brown, H",     mlb_player_name: "Hunter Brown",        mlb_player_id: 686613, mlb_team: "HOU", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Rodon, C",     mlb_player_name: "Carlos Rodon",        mlb_player_id: 638476, mlb_team: "NYY", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Donovan, B",   mlb_player_name: "Brendan Donovan",     mlb_player_id: 680977, mlb_team: "STL", primary_position: "2B", is_pitcher: false },
  { namePattern: "Hernandez, T", mlb_player_name: "Teoscar Hernandez",   mlb_player_id: 606192, mlb_team: "LAD", primary_position: "LF", is_pitcher: false },
  { namePattern: "Iglesias, R",  mlb_player_name: "Raisel Iglesias",     mlb_player_id: 609350, mlb_team: "LAA", primary_position: "RP", is_pitcher: true  },
  { namePattern: "Cabrera, E",   mlb_player_name: "Edward Cabrera",      mlb_player_id: 677506, mlb_team: "MIA", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Chourio, J",   mlb_player_name: "Jackson Chourio",     mlb_player_id: 694192, mlb_team: "MIL", primary_position: "CF", is_pitcher: false },
  { namePattern: "Castillo, L",  mlb_player_name: "Luis Castillo",       mlb_player_id: 650523, mlb_team: "SEA", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Cole, G",      mlb_player_name: "Gerrit Cole",          mlb_player_id: 543037, mlb_team: "NYY", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Hader, J",     mlb_player_name: "Josh Hader",           mlb_player_id: 595978, mlb_team: "HOU", primary_position: "RP", is_pitcher: true  },
  { namePattern: "Kirby, G",     mlb_player_name: "George Kirby",         mlb_player_id: 669923, mlb_team: "SEA", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Lodolo, N",    mlb_player_name: "Nick Lodolo",          mlb_player_id: 672382, mlb_team: "CIN", primary_position: "SP", is_pitcher: true  },
  { namePattern: "Caminero, J",  mlb_player_name: "Junior Caminero",      mlb_player_id: 686469, mlb_team: "TB",  primary_position: "3B", is_pitcher: false },
  { namePattern: "j caminero",   mlb_player_name: "Junior Caminero",      mlb_player_id: 686469, mlb_team: "TB",  primary_position: "3B", is_pitcher: false },
  { namePattern: "t hernandez",  mlb_player_name: "Teoscar Hernandez",    mlb_player_id: 606192, mlb_team: "LAD", primary_position: "LF", is_pitcher: false },
];

async function applyFixes() {
  const supabase = createServiceClient();
  const applied: { from: string; to: string; count: number }[] = [];
  const errors: string[] = [];

  for (const fix of KNOWN_FIXES) {
    const { data, error } = await supabase
      .from("roster_players")
      .update({
        mlb_player_name: fix.mlb_player_name,
        mlb_player_id: fix.mlb_player_id,
        mlb_team: fix.mlb_team,
        primary_position: fix.primary_position,
        is_pitcher: fix.is_pitcher,
      })
      .ilike("mlb_player_name", fix.namePattern)
      .select();

    if (error) {
      errors.push(`${fix.namePattern}: ${error.message}`);
    } else {
      applied.push({ from: fix.namePattern, to: fix.mlb_player_name, count: data?.length ?? 0 });
    }
  }

  // Fix is_pitcher flag for all pitcher-position players on the Cool Papas
  const { data: coolPapasTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("name", "Cool Papas")
    .limit(1)
    .single();

  if (coolPapasTeam) {
    const { data, error } = await supabase
      .from("roster_players")
      .update({ is_pitcher: true })
      .eq("team_id", coolPapasTeam.id)
      .in("primary_position", ["SP", "RP"])
      .eq("is_pitcher", false)
      .select("mlb_player_name");

    if (error) {
      errors.push(`Cool Papas pitcher flag: ${error.message}`);
    } else if (data && data.length > 0) {
      applied.push({
        from: "is_pitcher=false",
        to: "is_pitcher=true",
        count: data.length,
      });
    }
  }

  return { applied, errors };
}

export async function GET() {
  const result = await applyFixes();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await applyFixes();
  return NextResponse.json(result);
}

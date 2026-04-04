import { NextRequest, NextResponse } from "next/server";
import { searchPlayers, getActiveRosterPlayers } from "@/lib/mlb-api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  try {
    if (query) {
      const players = await searchPlayers(query);
      return NextResponse.json({ players: players.slice(0, 25) });
    }

    // Return all active players (expensive, should be cached)
    const players = await getActiveRosterPlayers();
    return NextResponse.json({ players: players.slice(0, 100) });
  } catch (error) {
    console.error("MLB API error:", error);
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
}

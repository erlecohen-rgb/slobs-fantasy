import { NextRequest, NextResponse } from "next/server";
import { getActiveRosterPlayers } from "@/lib/mlb-api";

// GET /api/scores/debug-player?q=caminero
// Searches active MLB rosters and returns matching players with their IDs
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  try {
    const all = await getActiveRosterPlayers();
    const matches = q
      ? all.filter(
          (p) =>
            p.fullName?.toLowerCase().includes(q.toLowerCase()) ||
            p.lastName?.toLowerCase().includes(q.toLowerCase())
        )
      : [];
    return NextResponse.json({
      query: q,
      count: matches.length,
      players: matches.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        position: p.primaryPosition?.abbreviation,
        team: p.currentTeam?.abbreviation || p.currentTeam?.name,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

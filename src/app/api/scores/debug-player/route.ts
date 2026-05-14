import { NextRequest, NextResponse } from "next/server";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

// GET /api/scores/debug-player?q=caminero&teamId=139
// Searches MLB rosters (including IL) and returns matching players with their IDs
// Tampa Bay Rays teamId = 139
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").toLowerCase();
  const teamId = request.nextUrl.searchParams.get("teamId") || "139";
  const season = request.nextUrl.searchParams.get("season") || "2026";

  try {
    const url = `${MLB_API_BASE}/teams/${teamId}/roster?rosterType=40Man&season=${season}`;
    const res = await fetch(url);
    const data = await res.json();
    const roster: Record<string, unknown>[] = data.roster || [];

    const matches = q
      ? roster.filter((entry) => {
          const person = entry.person as Record<string, unknown>;
          const name = ((person?.fullName as string) || "").toLowerCase();
          return name.includes(q);
        })
      : roster;

    return NextResponse.json({
      url,
      httpStatus: res.status,
      query: q,
      teamId,
      season,
      totalOnRoster: roster.length,
      count: matches.length,
      players: matches.map((entry) => {
        const person = entry.person as Record<string, unknown>;
        const pos = entry.position as Record<string, unknown>;
        return {
          id: person?.id,
          fullName: person?.fullName,
          position: pos?.abbreviation,
          status: entry.status,
        };
      }),
      rawFirstEntry: roster[0] ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

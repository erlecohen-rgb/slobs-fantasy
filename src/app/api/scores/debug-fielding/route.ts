import { NextRequest, NextResponse } from "next/server";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

// GET /api/scores/debug-fielding?playerId=686469&startDate=2026-04-13&endDate=2026-04-19
// Returns raw MLB API fielding response + player identity for debugging DQ issues
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const playerId = searchParams.get("playerId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    // Fetch player identity
    const personRes = await fetch(`${MLB_API_BASE}/people/${playerId}?hydrate=currentTeam`);
    const personData = await personRes.json();
    const person = personData.people?.[0];
    const playerInfo = person
      ? {
          id: person.id,
          fullName: person.fullName,
          position: person.primaryPosition?.abbreviation,
          team: person.currentTeam?.abbreviation || person.currentTeam?.name,
        }
      : null;

    if (!startDate || !endDate) {
      return NextResponse.json({ playerId, playerInfo });
    }

    const url = `${MLB_API_BASE}/people/${playerId}/stats?stats=gameLog&group=fielding&startDate=${startDate}&endDate=${endDate}&sportId=1`;
    const res = await fetch(url);
    const raw = await res.json();

    const splits = raw.stats?.[0]?.splits || [];
    const processed = splits.map((s: Record<string, unknown>) => {
      const topPos = s.position as Record<string, unknown> | undefined;
      const statPos = (s.stat as Record<string, unknown>)?.position as Record<string, unknown> | undefined;
      const pos = (topPos?.abbreviation ?? statPos?.abbreviation ?? "") as string;
      return {
        date: s.date,
        resolved_position: pos,
        position_from_top: topPos,
        position_from_stat: statPos,
      };
    });

    return NextResponse.json({
      playerInfo,
      url,
      statsCount: raw.stats?.length ?? 0,
      splitsCount: splits.length,
      processed,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

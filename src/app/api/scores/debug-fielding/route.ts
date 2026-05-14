import { NextRequest, NextResponse } from "next/server";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

// GET /api/scores/debug-fielding?playerId=686469&startDate=2026-04-13&endDate=2026-04-19
// Returns raw MLB API fielding response for debugging DQ issues
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const playerId = searchParams.get("playerId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!playerId || !startDate || !endDate) {
    return NextResponse.json({ error: "playerId, startDate, endDate required" }, { status: 400 });
  }

  const url = `${MLB_API_BASE}/people/${playerId}/stats?stats=gameLog&group=fielding&startDate=${startDate}&endDate=${endDate}&sportId=1`;

  try {
    const res = await fetch(url);
    const raw = await res.json();

    // Also process the way getFieldingGameLog does
    const splits = raw.stats?.[0]?.splits || [];
    const processed = splits.map((s: Record<string, unknown>) => {
      const topPos = s.position as Record<string, unknown> | undefined;
      const statPos = (s.stat as Record<string, unknown>)?.position as Record<string, unknown> | undefined;
      const pos = (topPos?.abbreviation ?? statPos?.abbreviation ?? "") as string;
      return {
        date: s.date,
        position_from_top: topPos,
        position_from_stat: statPos,
        resolved_position: pos,
        stat: s.stat,
      };
    });

    return NextResponse.json({
      url,
      statsCount: raw.stats?.length ?? 0,
      statsGroups: raw.stats?.map((sg: Record<string, unknown>) => ({
        group: sg.group,
        type: sg.type,
        splitsCount: (sg.splits as unknown[])?.length ?? 0,
      })),
      splitsCount: splits.length,
      processed,
      rawFirstSplit: splits[0] ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), url }, { status: 500 });
  }
}

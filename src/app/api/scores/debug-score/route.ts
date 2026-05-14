import { NextRequest, NextResponse } from "next/server";
import { getHittingGameLog, getFieldingGameLog } from "@/lib/mlb-api";

// GET /api/scores/debug-score?playerId=691406&position=3B&startDate=2026-04-20&endDate=2026-04-26
// Runs the full batter score pipeline and returns all intermediate values
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const playerId = Number(searchParams.get("playerId"));
  const position = searchParams.get("position") || "3B";
  const startDate = searchParams.get("startDate") || "2026-04-20";
  const endDate = searchParams.get("endDate") || "2026-04-26";

  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  try {
    const [hitting, fielding] = await Promise.all([
      getHittingGameLog(playerId, startDate, endDate),
      getFieldingGameLog(playerId, startDate, endDate),
    ]);

    const OF_POSITIONS = ["LF", "CF", "RF", "OF"];
    function positionMatches(activatedPos: string, fieldedPos: string): boolean {
      if (activatedPos === "UTIL") return true;
      if (activatedPos === fieldedPos) return true;
      if (activatedPos === "OF" && OF_POSITIONS.includes(fieldedPos)) return true;
      return false;
    }

    const isPositionFlex = position === "DH" || position === "UTIL";
    const fieldingAtPosition = fielding.filter(
      (g: Record<string, unknown>) => positionMatches(position, g.position as string)
    );
    const gamesAtPosition = isPositionFlex ? hitting.length : fieldingAtPosition.length;
    const isDisqualified = !isPositionFlex && gamesAtPosition < 2;

    return NextResponse.json({
      playerId,
      position,
      startDate,
      endDate,
      hittingGames: hitting.length,
      fieldingGames: fielding.length,
      fieldingPositions: fielding.map((g: Record<string, unknown>) => ({ date: g.date, position: g.position })),
      fieldingAtPositionCount: fieldingAtPosition.length,
      gamesAtPosition,
      isPositionFlex,
      isDisqualified,
      requiredGames: 2,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  getHittingGameLog,
  getPitchingGameLog,
  getFieldingGameLog,
  getWeekRange,
} from "@/lib/mlb-api";
import {
  scoreBatter,
  scorePitcher,
  isShortWeek,
  type BatterWeeklyStats,
  type BatterGameLog,
  type PitcherWeeklyStats,
  type PitcherGameLog,
} from "@/lib/scoring";

// POST /api/scores/calculate
// Body: { players, shortWeek?, startDate?, endDate?, weekNumber?, seasonYear? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { players, shortWeek = false } = body;

    if (!players?.length) {
      return NextResponse.json({ error: "No players provided" }, { status: 400 });
    }

    // Support custom date range or week number
    let start: string, end: string;
    if (body.startDate && body.endDate) {
      start = body.startDate;
      end = body.endDate;
    } else if (body.weekNumber && body.seasonYear) {
      const range = getWeekRange(body.weekNumber, body.seasonYear);
      start = range.start;
      end = range.end;
    } else {
      return NextResponse.json({ error: "Provide startDate+endDate or weekNumber+seasonYear" }, { status: 400 });
    }
    const results = [];

    for (const player of players) {
      const { mlbPlayerId, position, isPitcher, role, rosterId } = player;

      if (isPitcher) {
        const result = await calculatePitcherScore(mlbPlayerId, start, end, role || "SP");
        results.push({
          mlbPlayerId,
          rosterId: rosterId ?? null,
          position,
          role,
          ...result,
        });
      } else {
        const result = await calculateBatterScore(
          mlbPlayerId,
          position,
          start,
          end,
          shortWeek
        );
        results.push({
          mlbPlayerId,
          rosterId: rosterId ?? null,
          position,
          ...result,
        });
      }
    }

    return NextResponse.json({
      weekNumber: body.weekNumber || 0,
      seasonYear: body.seasonYear || 0,
      dateRange: { start, end },
      shortWeek,
      results,
    });
  } catch (error) {
    console.error("Score calculation error:", error);
    return NextResponse.json({ error: "Failed to calculate scores" }, { status: 500 });
  }
}

async function calculateBatterScore(
  mlbPlayerId: number,
  position: string,
  startDate: string,
  endDate: string,
  shortWeek: boolean
) {
  const [hitting, fielding] = await Promise.all([
    getHittingGameLog(mlbPlayerId, startDate, endDate),
    getFieldingGameLog(mlbPlayerId, startDate, endDate),
  ]);

  // Position matching: "OF" matches LF/CF/RF; "UTIL" matches anything
  const OF_POSITIONS = ["LF", "CF", "RF", "OF"];
  function positionMatches(activatedPos: string, fieldedPos: string): boolean {
    if (activatedPos === "UTIL") return true;
    if (activatedPos === fieldedPos) return true;
    if (activatedPos === "OF" && OF_POSITIONS.includes(fieldedPos)) return true;
    return false;
  }

  // DH/UTIL: count all hitting games (no fielding entry expected)
  // All others: count fielding games at the activated position
  const isPositionFlex = position === "DH" || position === "UTIL";
  const gamesAtPosition = isPositionFlex
    ? hitting.length
    : fielding.filter(
        (g: Record<string, unknown>) => positionMatches(position, g.position as string)
      ).length;

  // Build game log for special award detection
  const gameLog: BatterGameLog[] = hitting.map((g: Record<string, unknown>) => {
    const gameDate = g.date as string;
    // Find all fielding entries for this game
    const fieldingForGame = fielding.filter(
      (f: Record<string, unknown>) => f.date === gameDate
    );
    const positionsPlayed = fieldingForGame.map(
      (f: Record<string, unknown>) => f.position as string
    );

    // Errors and passed balls come from fielding data, not hitting
    const errors = fieldingForGame.reduce(
      (sum: number, f: Record<string, unknown>) => sum + Number(f.errors || 0),
      0
    );
    const passedBalls = fieldingForGame.reduce(
      (sum: number, f: Record<string, unknown>) => sum + Number(f.passedBall || f.passedBalls || 0),
      0
    );

    return {
      date: gameDate,
      opponent: (g.opponent as string) || "Unknown",
      atBats: Number(g.atBats || 0),
      hits: Number(g.hits || 0),
      doubles: Number(g.doubles || 0),
      triples: Number(g.triples || 0),
      homeRuns: Number(g.homeRuns || 0),
      runs: Number(g.runs || 0),
      rbi: Number(g.rbi || 0),
      stolenBases: Number(g.stolenBases || 0),
      hitByPitch: Number(g.hitByPitch || 0),
      errors,
      passedBalls,
      playedPosition: positionsPlayed.some((p: string) => positionMatches(position, p)),
      positionsPlayed,
    };
  });

  // Aggregate weekly stats
  const stats: BatterWeeklyStats = {
    games: hitting.length,
    gamesAtPosition,
    atBats: gameLog.reduce((s, g) => s + g.atBats, 0),
    hits: gameLog.reduce((s, g) => s + g.hits, 0),
    doubles: gameLog.reduce((s, g) => s + g.doubles, 0),
    triples: gameLog.reduce((s, g) => s + g.triples, 0),
    homeRuns: gameLog.reduce((s, g) => s + g.homeRuns, 0),
    runs: gameLog.reduce((s, g) => s + g.runs, 0),
    rbi: gameLog.reduce((s, g) => s + g.rbi, 0),
    stolenBases: gameLog.reduce((s, g) => s + g.stolenBases, 0),
    hitByPitch: gameLog.reduce((s, g) => s + g.hitByPitch, 0),
    errors: gameLog.reduce((s, g) => s + g.errors, 0),
    passedBalls: gameLog.reduce((s, g) => s + g.passedBalls, 0),
    gameLog,
  };

  const result = scoreBatter(stats, position, shortWeek);

  return {
    stats,
    scoring: result,
  };
}

async function calculatePitcherScore(
  mlbPlayerId: number,
  startDate: string,
  endDate: string,
  role: "SP" | "RP"
) {
  const [pitching, fielding] = await Promise.all([
    getPitchingGameLog(mlbPlayerId, startDate, endDate),
    getFieldingGameLog(mlbPlayerId, startDate, endDate),
  ]);

  const gameLog: PitcherGameLog[] = pitching.map((g: Record<string, unknown>) => {
    const gameDate = g.date as string;
    // Errors come from fielding data, not pitching
    const fieldingForGame = fielding.filter(
      (f: Record<string, unknown>) => f.date === gameDate
    );
    const errors = fieldingForGame.reduce(
      (sum: number, f: Record<string, unknown>) => sum + Number(f.errors || 0),
      0
    );

    return {
      date: gameDate,
      opponent: (g.opponent as string) || "Unknown",
      started: g.gamesStarted === 1 || Number(g.gamesStarted || 0) > 0,
      inningsPitched: Number(g.inningsPitched || 0),
      runsAllowed: Number(g.runs || 0),
      hitsAllowed: Number(g.hits || 0),
      strikeouts: Number(g.strikeOuts || 0),
      wildPitches: Number(g.wildPitches || 0),
      balks: Number(g.balks || 0),
      hitBatters: Number(g.hitBatsmen || g.hitByPitch || 0),
      errors,
      win: g.wins === 1 || Number(g.wins || 0) > 0,
      save: g.saves === 1 || Number(g.saves || 0) > 0,
      hold: g.holds === 1 || Number(g.holds || 0) > 0,
      completeGame: g.completeGames === 1 || Number(g.completeGames || 0) > 0,
      shutout: g.shutouts === 1 || Number(g.shutouts || 0) > 0,
      onlyPitcher: false, // Would need full game data to determine this
    };
  });

  const stats: PitcherWeeklyStats = {
    games: pitching.length,
    gamesStarted: gameLog.filter((g) => g.started).length,
    gamesRelieved: gameLog.filter((g) => !g.started).length,
    wins: gameLog.filter((g) => g.win).length,
    saves: gameLog.filter((g) => g.save).length,
    holds: gameLog.filter((g) => g.hold).length,
    inningsPitched: gameLog.reduce((s, g) => s + g.inningsPitched, 0),
    earnedRuns: pitching.reduce((s: number, g: Record<string, unknown>) => s + Number(g.earnedRuns || 0), 0),
    runsAllowed: gameLog.reduce((s, g) => s + g.runsAllowed, 0),
    hitsAllowed: gameLog.reduce((s, g) => s + g.hitsAllowed, 0),
    strikeouts: gameLog.reduce((s, g) => s + g.strikeouts, 0),
    wildPitches: gameLog.reduce((s, g) => s + g.wildPitches, 0),
    balks: gameLog.reduce((s, g) => s + g.balks, 0),
    hitBatters: gameLog.reduce((s, g) => s + g.hitBatters, 0),
    errors: gameLog.reduce((s, g) => s + g.errors, 0),
    gameLog,
  };

  const result = scorePitcher(stats, role);

  return {
    stats,
    scoring: result,
  };
}

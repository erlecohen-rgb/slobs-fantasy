import { scoreBatter, scorePitcher, type BatterWeeklyStats, type PitcherWeeklyStats } from "../scoring";

// Helper to make a minimal batter game log
function makeGameLog(overrides = {}) {
  return {
    date: "2026-04-07",
    atBats: 4,
    hits: 1,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    runs: 0,
    rbi: 0,
    stolenBases: 0,
    hitByPitch: 0,
    errors: 0,
    passedBalls: 0,
    playedPosition: true,
    ...overrides,
  };
}

function makePitcherGameLog(overrides = {}) {
  return {
    date: "2026-04-07",
    started: true,
    inningsPitched: 6,
    runsAllowed: 2,
    hitsAllowed: 5,
    strikeouts: 6,
    wildPitches: 0,
    balks: 0,
    hitBatters: 0,
    errors: 0,
    win: false,
    save: false,
    hold: false,
    completeGame: false,
    shutout: false,
    onlyPitcher: false,
    ...overrides,
  };
}

describe("Batter Scoring", () => {
  test("hits threshold: no points under 4 hits", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 3, atBats: 24,
      hits: 3, doubles: 0, triples: 0, homeRuns: 0,
      runs: 1, rbi: 1, stolenBases: 0, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog({ hits: 1 }), makeGameLog({ hits: 1 }), makeGameLog({ hits: 1 })],
    };
    const result = scoreBatter(stats, "1B");
    // 3 hits = under threshold, 0 hit points
    // 2 runs produced = under threshold, 0 RP points
    expect(result.points).toBe(0);
    expect(result.qualified).toBe(true);
  });

  test("hits threshold: 5th+ hit counts at 5 pts each", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 3, atBats: 24,
      hits: 7, doubles: 0, triples: 0, homeRuns: 0,
      runs: 2, rbi: 3, stolenBases: 0, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog({ hits: 3 }), makeGameLog({ hits: 2 }), makeGameLog({ hits: 2 })],
    };
    const result = scoreBatter(stats, "1B");
    // 7 hits - 4 threshold = 3 * 5 = 15 pts from hits
    // 5 runs produced - 4 threshold = 1 * 10 = 10 pts
    expect(result.points).toBe(25);
  });

  test("runs produced threshold: runs + RBI - 4, then 10 pts each", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 2, atBats: 24,
      hits: 2, doubles: 0, triples: 0, homeRuns: 0,
      runs: 5, rbi: 3, stolenBases: 0, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog()],
    };
    const result = scoreBatter(stats, "2B");
    // 8 RP - 4 = 4 * 10 = 40 pts
    expect(result.points).toBe(40);
  });

  test("extra base hits and bonuses", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 3, atBats: 24,
      hits: 8, doubles: 2, triples: 1, homeRuns: 1,
      runs: 4, rbi: 5, stolenBases: 2, hitByPitch: 1,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog()],
    };
    const result = scoreBatter(stats, "SS");
    // Hits: (8-4) * 5 = 20
    // RP: (9-4) * 10 = 50
    // 2B: 2 * 10 = 20
    // 3B: 1 * 25 = 25
    // HR: 1 * 15 = 15
    // SB: 2 * 5 = 10
    // HBP: 1 * 5 = 5
    expect(result.points).toBe(145);
  });

  test("errors subtract 10 each", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 2, atBats: 24,
      hits: 0, doubles: 0, triples: 0, homeRuns: 0,
      runs: 0, rbi: 0, stolenBases: 0, hitByPitch: 0,
      errors: 2, passedBalls: 0,
      gameLog: [makeGameLog({ errors: 2 })],
    };
    const result = scoreBatter(stats, "3B");
    expect(result.points).toBe(-20);
  });

  test("disqualified if not enough games at position", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 1, atBats: 24,
      hits: 10, doubles: 3, triples: 1, homeRuns: 2,
      runs: 6, rbi: 8, stolenBases: 3, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog()],
    };
    const result = scoreBatter(stats, "1B");
    expect(result.qualified).toBe(false);
    expect(result.points).toBe(0);
  });

  test("DH has no positional requirement", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 0, atBats: 24,
      hits: 5, doubles: 0, triples: 0, homeRuns: 0,
      runs: 0, rbi: 0, stolenBases: 0, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog()],
    };
    const result = scoreBatter(stats, "DH");
    expect(result.qualified).toBe(true);
    expect(result.points).toBe(5); // (5-4)*5 = 5
  });

  test("short week: no thresholds", () => {
    const stats: BatterWeeklyStats = {
      games: 3, gamesAtPosition: 1, atBats: 12,
      hits: 3, doubles: 0, triples: 0, homeRuns: 0,
      runs: 2, rbi: 1, stolenBases: 0, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [makeGameLog()],
    };
    const result = scoreBatter(stats, "1B", true);
    // Short week: all 3 hits count = 15
    // All 3 RP count = 30
    expect(result.points).toBe(45);
  });

  test("Bump Wills Award at -15 or worse", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 4, atBats: 20,
      hits: 0, doubles: 0, triples: 0, homeRuns: 0,
      runs: 0, rbi: 0, stolenBases: 0, hitByPitch: 0,
      errors: 2, passedBalls: 0,
      gameLog: [makeGameLog({ errors: 2 })],
    };
    const result = scoreBatter(stats, "C");
    expect(result.points).toBe(-20);
    expect(result.specialAwards).toHaveLength(1);
    expect(result.specialAwards[0].name).toBe("Bump Wills Award");
    expect(result.specialAwards[0].payout).toBe(-1);
  });

  test("5 for 5 special award", () => {
    const stats: BatterWeeklyStats = {
      games: 6, gamesAtPosition: 3, atBats: 24,
      hits: 8, doubles: 1, triples: 0, homeRuns: 0,
      runs: 3, rbi: 2, stolenBases: 0, hitByPitch: 0,
      errors: 0, passedBalls: 0,
      gameLog: [
        makeGameLog({ atBats: 5, hits: 5, doubles: 1 }),
        makeGameLog({ atBats: 4, hits: 2 }),
        makeGameLog({ atBats: 4, hits: 1 }),
      ],
    };
    const result = scoreBatter(stats, "LF");
    expect(result.specialAwards.some((a) => a.name === "5 for 5")).toBe(true);
  });
});

describe("Pitcher Scoring", () => {
  test("SP win = 50 points", () => {
    const stats: PitcherWeeklyStats = {
      games: 1, gamesStarted: 1, gamesRelieved: 0,
      wins: 1, saves: 0, holds: 0,
      inningsPitched: 6, earnedRuns: 3, runsAllowed: 3,
      hitsAllowed: 6, strikeouts: 5, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [makePitcherGameLog({ win: true, runsAllowed: 3 })],
    };
    const result = scorePitcher(stats, "SP");
    // Win: 50 + QS 6IP: 50 = 100
    expect(result.points).toBe(100);
  });

  test("RP win = 40, save = 40", () => {
    const stats: PitcherWeeklyStats = {
      games: 3, gamesStarted: 0, gamesRelieved: 3,
      wins: 1, saves: 1, holds: 0,
      inningsPitched: 3, earnedRuns: 0, runsAllowed: 0,
      hitsAllowed: 2, strikeouts: 4, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [
        makePitcherGameLog({ started: false, inningsPitched: 1, win: true, runsAllowed: 0, hitsAllowed: 1, strikeouts: 2 }),
        makePitcherGameLog({ started: false, inningsPitched: 1, save: true, runsAllowed: 0, hitsAllowed: 1, strikeouts: 1 }),
        makePitcherGameLog({ started: false, inningsPitched: 1, runsAllowed: 0, hitsAllowed: 0, strikeouts: 1 }),
      ],
    };
    const result = scorePitcher(stats, "RP");
    // RP Win: 40 + Save: 40 + K above IP: game1(2-1=1*10=10), game2(1-1=0), game3(1-1=0)
    expect(result.points).toBe(90);
  });

  test("quality start tiers are NOT cumulative", () => {
    const stats: PitcherWeeklyStats = {
      games: 1, gamesStarted: 1, gamesRelieved: 0,
      wins: 0, saves: 0, holds: 0,
      inningsPitched: 8, earnedRuns: 2, runsAllowed: 2,
      hitsAllowed: 5, strikeouts: 10, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [makePitcherGameLog({ inningsPitched: 8, runsAllowed: 2, strikeouts: 10 })],
    };
    const result = scorePitcher(stats, "SP");
    // QS 8+ IP: 100 (not 50+75+100)
    // K above IP: 10 - 8 = 2 * 10 = 20
    expect(result.points).toBe(120);
  });

  test("5 2/3 IP and 3 runs does NOT qualify for QS", () => {
    const stats: PitcherWeeklyStats = {
      games: 1, gamesStarted: 1, gamesRelieved: 0,
      wins: 0, saves: 0, holds: 0,
      inningsPitched: 5.2, earnedRuns: 3, runsAllowed: 3,
      hitsAllowed: 7, strikeouts: 4, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [makePitcherGameLog({ inningsPitched: 5.2, runsAllowed: 3, strikeouts: 4 })],
    };
    const result = scorePitcher(stats, "SP");
    // 5.2 IP = 5 2/3 innings, < 6. No QS.
    // K: 4 - 6 (rounded) = negative, no K bonus
    expect(result.points).toBe(0);
  });

  test("strikeout bonus rounds IP to nearest inning", () => {
    const stats: PitcherWeeklyStats = {
      games: 1, gamesStarted: 0, gamesRelieved: 1,
      wins: 0, saves: 0, holds: 0,
      inningsPitched: 0.2, earnedRuns: 0, runsAllowed: 0,
      hitsAllowed: 0, strikeouts: 2, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [makePitcherGameLog({ started: false, inningsPitched: 0.2, strikeouts: 2, runsAllowed: 0 })],
    };
    const result = scorePitcher(stats, "RP");
    // 0.2 IP = 2/3 inning, rounds to 1
    // 2 K - 1 IP = 1 * 10 = 10
    expect(result.points).toBe(10);
  });

  test("complete game shutout with low hits", () => {
    const stats: PitcherWeeklyStats = {
      games: 1, gamesStarted: 1, gamesRelieved: 0,
      wins: 1, saves: 0, holds: 0,
      inningsPitched: 9, earnedRuns: 0, runsAllowed: 0,
      hitsAllowed: 2, strikeouts: 12, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [makePitcherGameLog({
        inningsPitched: 9, win: true, runsAllowed: 0, hitsAllowed: 2,
        strikeouts: 12, completeGame: true, shutout: true,
      })],
    };
    const result = scorePitcher(stats, "SP");
    // Win: 50
    // QS 8+ IP: 100
    // CG: 25
    // Shutout: 50
    // 2-hitter: 40
    // K above IP: 12 - 9 = 3 * 10 = 30
    expect(result.points).toBe(295);
  });

  test("SP must start at least one game", () => {
    const stats: PitcherWeeklyStats = {
      games: 2, gamesStarted: 0, gamesRelieved: 2,
      wins: 1, saves: 0, holds: 0,
      inningsPitched: 4, earnedRuns: 1, runsAllowed: 1,
      hitsAllowed: 3, strikeouts: 5, wildPitches: 0,
      balks: 0, hitBatters: 0, errors: 0,
      gameLog: [],
    };
    const result = scorePitcher(stats, "SP");
    expect(result.qualified).toBe(false);
  });

  test("Steve Trout Pitcher Cycle", () => {
    const stats: PitcherWeeklyStats = {
      games: 1, gamesStarted: 1, gamesRelieved: 0,
      wins: 0, saves: 0, holds: 0,
      inningsPitched: 4, earnedRuns: 5, runsAllowed: 6,
      hitsAllowed: 8, strikeouts: 3, wildPitches: 1,
      balks: 1, hitBatters: 1, errors: 1,
      gameLog: [makePitcherGameLog({
        inningsPitched: 4, runsAllowed: 6, hitsAllowed: 8, strikeouts: 3,
        wildPitches: 1, balks: 1, hitBatters: 1, errors: 1,
      })],
    };
    const result = scorePitcher(stats, "SP");
    expect(result.specialAwards.some((a) => a.name === "Steve Trout Pitcher Cycle")).toBe(true);
  });
});

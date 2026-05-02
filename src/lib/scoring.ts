// SLOBS Fantasy Baseball Scoring Engine
// Based on Commissioner John Bauer's rules

export interface BatterWeeklyStats {
  games: number;
  gamesAtPosition: number; // games played at activated position
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  runs: number;
  rbi: number;
  stolenBases: number;
  hitByPitch: number;
  errors: number;
  passedBalls: number;
  wildPitches: number;
  // For special awards - per-game breakdowns
  gameLog: BatterGameLog[];
}

export interface BatterGameLog {
  date: string;
  opponent: string;
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  runs: number;
  rbi: number;
  stolenBases: number;
  hitByPitch: number;
  errors: number;
  passedBalls: number;
  wildPitches: number;
  playedPosition: boolean; // played at activated position
  positionsPlayed?: string[]; // actual positions played that game
}

export interface PitcherWeeklyStats {
  games: number;
  gamesStarted: number;
  gamesRelieved: number;
  wins: number;
  saves: number;
  holds: number;
  inningsPitched: number; // stored as decimal: 6.1 = 6 1/3, 6.2 = 6 2/3
  earnedRuns: number;
  runsAllowed: number;
  hitsAllowed: number;
  strikeouts: number;
  wildPitches: number;
  balks: number;
  hitBatters: number;
  errors: number;
  // Per-game breakdowns for QS, CG, etc.
  gameLog: PitcherGameLog[];
}

export interface PitcherGameLog {
  date: string;
  opponent: string;
  started: boolean;
  inningsPitched: number;
  runsAllowed: number;
  hitsAllowed: number;
  strikeouts: number;
  wildPitches: number;
  balks: number;
  hitBatters: number;
  errors: number;
  win: boolean;
  save: boolean;
  hold: boolean;
  completeGame: boolean;
  shutout: boolean;
  onlyPitcher: boolean; // was this pitcher the only one used (for shortened CG)
}

export interface ScoringResult {
  points: number;
  breakdown: ScoringBreakdownItem[];
  specialAwards: SpecialAward[];
  qualified: boolean;
  disqualificationReason?: string;
}

export interface ScoringBreakdownItem {
  category: string;
  stat: number;
  points: number;
  note?: string;
}

export interface SpecialAward {
  name: string;
  description: string;
  payout: number; // dollars collected from each other team (negative = team pays)
  triggerGame?: string; // date of game that triggered it
}

// Convert MLB innings pitched notation to actual thirds
// MLB uses 6.1 = 6 1/3, 6.2 = 6 2/3
function parseInningsPitched(ip: number): number {
  const full = Math.floor(ip);
  const fraction = Math.round((ip - full) * 10);
  return full + fraction / 3;
}

// Round IP to nearest whole inning (for strikeout calculation)
function roundInnings(ip: number): number {
  const actual = parseInningsPitched(ip);
  return Math.round(actual);
}

// Check if IP meets threshold (do NOT round up for QS)
function ipMeetsThreshold(ip: number, threshold: number): boolean {
  return parseInningsPitched(ip) >= threshold;
}

export function scoreBatter(
  stats: BatterWeeklyStats,
  position: string,
  isShortWeek: boolean = false
): ScoringResult {
  const breakdown: ScoringBreakdownItem[] = [];
  const specialAwards: SpecialAward[] = [];
  let totalPoints = 0;

  // Qualification check: must play 2 games at position (1 in short week)
  // DH has no positional requirement
  const requiredGames = isShortWeek ? 1 : 2;
  const isDH = position === "DH";

  const isDisqualified = !isDH && stats.gamesAtPosition < requiredGames;
  const dqReason = isDisqualified
    ? `Must play ${requiredGames} game(s) at ${position} (played ${stats.gamesAtPosition})`
    : undefined;

  // Per-game summary lines
  for (const g of stats.gameLog) {
    const posInfo = g.positionsPlayed?.length
      ? g.positionsPlayed.join("/")
      : "?";
    const mismatch = !g.playedPosition && g.positionsPlayed?.length
      ? ` [activated ${position}, played ${posInfo}]`
      : "";
    breakdown.push({
      category: `${g.date} vs ${g.opponent}`,
      stat: g.atBats,
      points: 0,
      note: `${g.hits}-${g.atBats}, ${g.runs}R ${g.rbi}RBI, ${g.hitByPitch}HBP${mismatch}`,
    });
  }

  // Hits: threshold of 4, then 5 points per hit after
  const hitsOverThreshold = isShortWeek ? stats.hits : Math.max(0, stats.hits - 4);
  const hitPoints = hitsOverThreshold * 5;
  if (hitPoints > 0) {
    breakdown.push({
      category: "Hits",
      stat: stats.hits,
      points: hitPoints,
      note: isShortWeek
        ? `${stats.hits} hits × 5 pts (short week, no threshold)`
        : `${stats.hits} hits - 4 threshold = ${hitsOverThreshold} × 5 pts`,
    });
    totalPoints += hitPoints;
  } else {
    breakdown.push({
      category: "Hits",
      stat: stats.hits,
      points: 0,
      note: isShortWeek
        ? `${stats.hits} hits`
        : `${stats.hits} hits (need 4 to reach threshold)`,
    });
  }

  // Runs Produced: runs + RBI, threshold of 4, then 10 points each after
  const runsProduced = stats.runs + stats.rbi;
  const rpOverThreshold = isShortWeek ? runsProduced : Math.max(0, runsProduced - 4);
  const rpPoints = rpOverThreshold * 10;
  if (rpPoints > 0) {
    breakdown.push({
      category: "Runs Produced",
      stat: runsProduced,
      points: rpPoints,
      note: isShortWeek
        ? `${runsProduced} RP × 10 pts (short week, no threshold)`
        : `${stats.runs}R + ${stats.rbi}RBI = ${runsProduced} RP - 4 threshold = ${rpOverThreshold} × 10 pts`,
    });
    totalPoints += rpPoints;
  } else {
    breakdown.push({
      category: "Runs Produced",
      stat: runsProduced,
      points: 0,
      note: `${stats.runs}R + ${stats.rbi}RBI = ${runsProduced} RP (need 4 to reach threshold)`,
    });
  }

  // Extra base hits and other bonuses
  if (stats.doubles > 0) {
    const pts = stats.doubles * 10;
    breakdown.push({ category: "Doubles", stat: stats.doubles, points: pts });
    totalPoints += pts;
  }
  if (stats.triples > 0) {
    const pts = stats.triples * 25;
    breakdown.push({ category: "Triples", stat: stats.triples, points: pts });
    totalPoints += pts;
  }
  if (stats.homeRuns > 0) {
    const pts = stats.homeRuns * 15;
    breakdown.push({ category: "Home Runs", stat: stats.homeRuns, points: pts });
    totalPoints += pts;
  }
  if (stats.hitByPitch > 0) {
    const pts = stats.hitByPitch * 5;
    breakdown.push({ category: "Hit By Pitch", stat: stats.hitByPitch, points: pts });
    totalPoints += pts;
  } else {
    breakdown.push({ category: "Hit By Pitch", stat: 0, points: 0 });
  }
  if (stats.stolenBases > 0) {
    const pts = stats.stolenBases * 5;
    breakdown.push({ category: "Stolen Bases", stat: stats.stolenBases, points: pts });
    totalPoints += pts;
  }

  // Penalties
  if (stats.errors > 0) {
    const pts = stats.errors * -10;
    breakdown.push({ category: "Errors", stat: stats.errors, points: pts });
    totalPoints += pts;
  }
  if (stats.passedBalls > 0) {
    const pts = stats.passedBalls * -5;
    breakdown.push({ category: "Passed Balls", stat: stats.passedBalls, points: pts });
    totalPoints += pts;
  }
  if (stats.wildPitches > 0) {
    const pts = stats.wildPitches * -5;
    breakdown.push({ category: "Wild Pitches", stat: stats.wildPitches, points: pts });
    totalPoints += pts;
  }

  // Special Awards - check game logs
  for (const game of stats.gameLog) {
    // 5 hits in 5 AB (or 6 for 6, etc.)
    if (game.hits >= 5 && game.hits === game.atBats && game.atBats >= 5) {
      specialAwards.push({
        name: "5 for 5",
        description: `${game.hits} hits in ${game.atBats} at-bats`,
        payout: 3,
        triggerGame: game.date,
      });
    }

    // Cycle: single, double, triple, HR in same game
    const hasSingle = game.hits > game.doubles + game.triples + game.homeRuns;
    if (hasSingle && game.doubles > 0 && game.triples > 0 && game.homeRuns > 0) {
      specialAwards.push({
        name: "Hitter Cycle",
        description: "Hit for the cycle",
        payout: 5,
        triggerGame: game.date,
      });
    }

    // Bob Horner Worthless Pig Award: 4+ HRs in one game
    if (game.homeRuns >= 4) {
      specialAwards.push({
        name: "Bob Horner Worthless Pig Award",
        description: `${game.homeRuns} home runs in one game`,
        payout: 10,
        triggerGame: game.date,
      });
    }
  }

  // Bump Wills Award: fewer than -10 points (i.e., -15 or worse)
  if (totalPoints <= -15) {
    specialAwards.push({
      name: "Bump Wills Award",
      description: `Accumulated ${totalPoints} points this week`,
      payout: -1, // team PAYS each other team $1
    });
  }

  return {
    points: isDisqualified ? 0 : totalPoints,
    breakdown,
    specialAwards: isDisqualified ? [] : specialAwards,
    qualified: !isDisqualified,
    disqualificationReason: dqReason,
  };
}

export function scorePitcher(
  stats: PitcherWeeklyStats,
  role: "SP" | "RP"
): ScoringResult {
  const breakdown: ScoringBreakdownItem[] = [];
  const specialAwards: SpecialAward[] = [];
  let totalPoints = 0;

  // Qualification check
  if (role === "SP" && stats.gamesStarted === 0) {
    return {
      points: 0,
      breakdown: [],
      specialAwards: [],
      qualified: false,
      disqualificationReason: "SP must start at least one game to qualify",
    };
  }

  if (role === "RP") {
    const totalGames = stats.gamesStarted + stats.gamesRelieved;
    if (totalGames > 0 && stats.gamesRelieved < totalGames / 2) {
      return {
        points: 0,
        breakdown: [],
        specialAwards: [],
        qualified: false,
        disqualificationReason: "RP must appear in relief at least half of appearances",
      };
    }
  }

  // Process each game for game-specific awards (QS, CG, etc.)
  for (const game of stats.gameLog) {
    const gLabel = `${game.date} vs ${game.opponent}`;
    const roundedIP = roundInnings(game.inningsPitched);

    // Game summary line showing K/IP
    breakdown.push({
      category: `Game: ${gLabel}`,
      stat: game.inningsPitched,
      points: 0,
      note: `${game.inningsPitched} IP, ${game.strikeouts} K, ${game.runsAllowed} R, ${game.hitsAllowed} H (K/IP: ${game.strikeouts}/${roundedIP})`,
    });

    const actualIP = parseInningsPitched(game.inningsPitched);

    // Win/Loss
    if (game.win) {
      if (game.started) {
        breakdown.push({ category: "Win", stat: 1, points: 50, note: "SP win → 50 pts" });
        totalPoints += 50;
      } else {
        breakdown.push({ category: "Win", stat: 1, points: 40, note: "RP win → 40 pts" });
        totalPoints += 40;
      }
    } else {
      breakdown.push({ category: "Win", stat: 0, points: 0, note: "No win" });
    }

    // Save
    if (game.save) {
      breakdown.push({ category: "Save", stat: 1, points: 40, note: "Save → 40 pts" });
      totalPoints += 40;
    } else if (!game.started) {
      breakdown.push({ category: "Save", stat: 0, points: 0, note: "No save" });
    }

    // Hold
    if (game.hold) {
      breakdown.push({ category: "Hold", stat: 1, points: 20, note: "Hold → 20 pts" });
      totalPoints += 20;
    } else if (!game.started) {
      breakdown.push({ category: "Hold", stat: 0, points: 0, note: "No hold" });
    }

    // Quality Start
    if (game.started && game.runsAllowed <= 3 && ipMeetsThreshold(game.inningsPitched, 6)) {
      let qsPoints = 0;
      let qsTier = "";
      if (ipMeetsThreshold(game.inningsPitched, 8)) { qsPoints = 100; qsTier = "8+"; }
      else if (ipMeetsThreshold(game.inningsPitched, 7)) { qsPoints = 75; qsTier = "7+"; }
      else { qsPoints = 50; qsTier = "6+"; }
      breakdown.push({
        category: "Quality Start", stat: game.inningsPitched, points: qsPoints,
        note: `${game.inningsPitched} IP, ${game.runsAllowed} R (≤3 allowed, ≥6 IP) → ${qsTier} IP tier = ${qsPoints} pts`,
      });
      totalPoints += qsPoints;
    } else if (game.started) {
      const reason = game.runsAllowed > 3
        ? `${game.runsAllowed} R > 3 allowed`
        : `${game.inningsPitched} IP < 6.0 required`;
      breakdown.push({ category: "Quality Start", stat: 0, points: 0, note: `No QS: ${reason}` });
    }

    // Complete Game
    const isCG = game.completeGame || (game.onlyPitcher && ipMeetsThreshold(game.inningsPitched, 6));
    if (isCG) {
      breakdown.push({ category: "Complete Game", stat: 1, points: 25, note: "CG bonus → 25 pts" });
      totalPoints += 25;
      if (game.shutout || game.runsAllowed === 0) {
        breakdown.push({ category: "Shutout", stat: 1, points: 50, note: "0 runs in CG → 50 pts" });
        totalPoints += 50;
      } else {
        breakdown.push({ category: "Shutout", stat: 0, points: 0, note: `${game.runsAllowed} runs allowed, no shutout` });
      }
      if (game.hitsAllowed <= 5) {
        let lhPts = 0, lhLbl = "";
        if (game.hitsAllowed === 0) { lhPts = 75; lhLbl = "No-Hitter"; }
        else if (game.hitsAllowed === 1) { lhPts = 50; lhLbl = "1-Hitter"; }
        else if (game.hitsAllowed === 2) { lhPts = 40; lhLbl = "2-Hitter"; }
        else if (game.hitsAllowed === 3) { lhPts = 30; lhLbl = "3-Hitter"; }
        else if (game.hitsAllowed === 4) { lhPts = 20; lhLbl = "4-Hitter"; }
        else { lhPts = 10; lhLbl = "5-Hitter"; }
        breakdown.push({ category: "Low-Hit CG", stat: game.hitsAllowed, points: lhPts, note: `${game.hitsAllowed} H → ${lhLbl} = ${lhPts} pts` });
        totalPoints += lhPts;
      }
    } else if (game.started) {
      breakdown.push({ category: "Complete Game", stat: 0, points: 0, note: "Not a complete game" });
    }

    // 9+ IP (if not CG)
    if (!isCG && ipMeetsThreshold(game.inningsPitched, 9)) {
      breakdown.push({ category: "9+ Innings", stat: 1, points: 25, note: `${game.inningsPitched} IP ≥ 9 → 25 pts` });
      totalPoints += 25;
    }

    // K above IP
    const kAboveIP = Math.max(0, game.strikeouts - roundedIP);
    if (kAboveIP > 0) {
      const kPts = kAboveIP * 10;
      breakdown.push({
        category: "K above IP", stat: game.strikeouts, points: kPts,
        note: `${game.strikeouts}K − ${roundedIP}IP (rounded from ${actualIP.toFixed(1)}) = ${kAboveIP} × 10 = ${kPts} pts`,
      });
      totalPoints += kPts;
    } else {
      breakdown.push({
        category: "K above IP", stat: 0, points: 0,
        note: `${game.strikeouts}K − ${roundedIP}IP (rounded) = 0, no bonus`,
      });
    }

    // Wild Pitch
    if (game.wildPitches > 0) {
      const pts = game.wildPitches * -5;
      breakdown.push({ category: "Wild Pitch", stat: game.wildPitches, points: pts, note: `${game.wildPitches} WP × −5 = ${pts} pts` });
      totalPoints += pts;
    } else {
      breakdown.push({ category: "Wild Pitch", stat: 0, points: 0, note: "0 WP" });
    }

    // Balk
    if (game.balks > 0) {
      const pts = game.balks * -5;
      breakdown.push({ category: "Balk", stat: game.balks, points: pts, note: `${game.balks} balk × −5 = ${pts} pts` });
      totalPoints += pts;
    } else {
      breakdown.push({ category: "Balk", stat: 0, points: 0, note: "0 balks" });
    }

    // Hit Batter
    if (game.hitBatters > 0) {
      const pts = game.hitBatters * 5;
      breakdown.push({ category: "Hit Batter", stat: game.hitBatters, points: pts, note: `${game.hitBatters} HBP × 5 = ${pts} pts` });
      totalPoints += pts;
    } else {
      breakdown.push({ category: "Hit Batter", stat: 0, points: 0, note: "0 HBP" });
    }

    // Error
    if (game.errors > 0) {
      const pts = game.errors * -10;
      breakdown.push({ category: "Error", stat: game.errors, points: pts, note: `${game.errors} error × −10 = ${pts} pts` });
      totalPoints += pts;
    } else {
      breakdown.push({ category: "Error", stat: 0, points: 0, note: "0 errors" });
    }

    // Special Awards

    // Perfect Game (no hits, no walks, no errors, no HBP - we check no hits + CG)
    // A perfecto is a no-hitter where no one reaches base
    // We'll flag it if it's a CG with 0 hits - admin can verify
    if (game.completeGame && game.hitsAllowed === 0) {
      // Check if it's specifically a perfect game (would need walk data)
      // For now flag as potential perfecto - the no-hitter award is already given above
      specialAwards.push({
        name: "Perfect Game (verify)",
        description: "Complete game no-hitter - verify if perfect",
        payout: 10,
        triggerGame: game.date,
      });
    }

    // Ordinary no-hitter (CG, 0 hits, but not perfect)
    // We'll add the no-hitter award separately since perfecto detection needs walk data
    if (game.completeGame && game.hitsAllowed === 0) {
      specialAwards.push({
        name: "No-Hitter",
        description: "Complete game no-hitter",
        payout: 5,
        triggerGame: game.date,
      });
    }

    // Steve Trout Pitcher Cycle: error + WP + balk + HBP in same game
    if (game.errors > 0 && game.wildPitches > 0 && game.balks > 0 && game.hitBatters > 0) {
      specialAwards.push({
        name: "Steve Trout Pitcher Cycle",
        description: "Error, wild pitch, balk, and hit batter in one game",
        payout: -5, // team PAYS
        triggerGame: game.date,
      });
    }
  }

  return {
    points: totalPoints,
    breakdown,
    specialAwards,
    qualified: true,
  };
}

// Determine if a week is "short" (3-4 games for a team)
export function isShortWeek(gamesInWeek: number): boolean {
  return gamesInWeek <= 4;
}

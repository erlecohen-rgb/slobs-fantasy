// Compare two players' weekly fantasy scores using the SLOBS scoring system
// Usage: node scripts/compare-players.mjs

const MLB_API = "https://statsapi.mlb.com/api/v1";

// Weeks 1-9 of 2026 season (season starts 2026-03-23, first Monday = 2026-03-23)
const WEEKS = [
  { week: 1, start: "2026-03-23", end: "2026-03-29" },
  { week: 2, start: "2026-03-30", end: "2026-04-05" },
  { week: 3, start: "2026-04-06", end: "2026-04-12" },
  { week: 4, start: "2026-04-13", end: "2026-04-19" },
  { week: 5, start: "2026-04-20", end: "2026-04-26" },
  { week: 6, start: "2026-04-27", end: "2026-05-03" },
  { week: 7, start: "2026-05-04", end: "2026-05-10" },
  { week: 8, start: "2026-05-11", end: "2026-05-17" },
  { week: 9, start: "2026-05-18", end: "2026-05-24" },
];

async function searchPlayer(name) {
  const res = await fetch(`${MLB_API}/sports/1/players?season=2026&activeStatus=ACTIVE&hydrate=currentTeam`);
  const data = await res.json();
  const q = name.toLowerCase();
  const matches = (data.people || []).filter(
    (p) => p.fullName?.toLowerCase().includes(q) || p.lastName?.toLowerCase().includes(q)
  );
  return matches;
}

async function getHittingLog(playerId, startDate, endDate) {
  const res = await fetch(
    `${MLB_API}/people/${playerId}/stats?stats=gameLog&group=hitting&startDate=${startDate}&endDate=${endDate}&sportId=1`
  );
  const data = await res.json();
  return (data.stats?.[0]?.splits || []).map((s) => ({
    date: s.date,
    opponent: s.opponent?.name || "",
    ...s.stat,
  }));
}

async function getFieldingLog(playerId, startDate, endDate) {
  const res = await fetch(
    `${MLB_API}/people/${playerId}/stats?stats=gameLog&group=fielding&startDate=${startDate}&endDate=${endDate}&sportId=1`
  );
  const data = await res.json();
  return (data.stats?.[0]?.splits || []).map((s) => {
    const topPos = s.position;
    const statPos = s.stat?.position;
    const pos = topPos?.abbreviation ?? statPos?.abbreviation ?? "";
    return { ...s.stat, date: s.date, position: pos };
  });
}

const OF_POSITIONS = ["LF", "CF", "RF", "OF"];
function positionMatches(activated, fielded) {
  if (activated === "UTIL") return true;
  if (activated === fielded) return true;
  if (activated === "OF" && OF_POSITIONS.includes(fielded)) return true;
  return false;
}

function parseIP(ip) {
  const full = Math.floor(ip);
  const frac = Math.round((ip - full) * 10);
  return full + frac / 3;
}

function roundIP(ip) { return Math.round(parseIP(ip)); }
function ipMeets(ip, threshold) { return parseIP(ip) >= threshold; }

function scoreBatter(stats, position, isShortWeek = false) {
  const requiredGames = isShortWeek ? 1 : 2;
  const isPositionFlex = position === "DH" || position === "UTIL";
  const isDisqualified = !isPositionFlex && stats.gamesAtPosition < requiredGames;

  let totalPoints = 0;

  // Hits
  const hitsOver = isShortWeek ? stats.hits : Math.max(0, stats.hits - 4);
  totalPoints += hitsOver * 5;

  // Runs Produced
  const rp = stats.runs + stats.rbi;
  const rpOver = isShortWeek ? rp : Math.max(0, rp - 4);
  totalPoints += rpOver * 10;

  // Extra base hits
  totalPoints += stats.doubles * 10;
  totalPoints += stats.triples * 25;
  totalPoints += stats.homeRuns * 15;
  totalPoints += stats.hitByPitch * 5;
  totalPoints += stats.stolenBases * 5;
  totalPoints += stats.errors * -10;
  totalPoints += stats.passedBalls * -5;

  return {
    points: isDisqualified ? 0 : totalPoints,
    qualified: !isDisqualified,
    dqReason: isDisqualified ? `Only ${stats.gamesAtPosition} game(s) at ${position}` : null,
    stats,
  };
}

async function getWeeklyScore(playerId, position, weekDates) {
  const [hitting, fielding] = await Promise.all([
    getHittingLog(playerId, weekDates.start, weekDates.end),
    getFieldingLog(playerId, weekDates.start, weekDates.end),
  ]);

  const isPositionFlex = position === "DH" || position === "UTIL";
  const gamesAtPosition = isPositionFlex
    ? hitting.length
    : fielding.filter((g) => positionMatches(position, g.position)).length;

  const gameLog = hitting.map((g) => {
    const fieldingForGame = fielding.filter((f) => f.date === g.date);
    const errors = fieldingForGame.reduce((s, f) => s + Number(f.errors || 0), 0);
    const passedBalls = fieldingForGame.reduce((s, f) => s + Number(f.passedBall || f.passedBalls || 0), 0);
    return {
      date: g.date,
      opponent: g.opponent,
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
      positionsPlayed: fielding.filter((f) => f.date === g.date).map((f) => f.position),
    };
  });

  const stats = {
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

  // Short week: team plays ≤4 games that week
  // We use the player's game count as a proxy (they'd play in most games)
  const isShortWeek = stats.games <= 4;

  const result = scoreBatter(stats, position, isShortWeek);
  return { ...result, isShortWeek };
}

async function main() {
  console.log("Searching for players...\n");

  const [clementMatches, keashallMatches] = await Promise.all([
    searchPlayer("Clement"),
    searchPlayer("Keashall"),
  ]);

  console.log("Clement matches:", clementMatches.map((p) => `${p.fullName} (ID:${p.id}, ${p.primaryPosition?.abbreviation}, ${p.currentTeam?.name})`));
  console.log("Keashall matches:", keashallMatches.map((p) => `${p.fullName} (ID:${p.id}, ${p.primaryPosition?.abbreviation}, ${p.currentTeam?.name})`));
  console.log();

  if (!clementMatches.length || !keashallMatches.length) {
    console.error("Could not find one or both players. Exiting.");
    process.exit(1);
  }

  // Use first match for each
  const clement = clementMatches[0];
  const keashall = keashallMatches[0];

  console.log(`Using: ${clement.fullName} (ID:${clement.id}, ${clement.primaryPosition?.abbreviation})`);
  console.log(`Using: ${keashall.fullName} (ID:${keashall.id}, ${keashall.primaryPosition?.abbreviation})`);
  console.log();

  // Use UTIL position to be inclusive (as if they're always activated and eligible)
  const clementPos = clement.primaryPosition?.abbreviation || "UTIL";
  const keashallPos = keashall.primaryPosition?.abbreviation || "UTIL";

  console.log(`Activated position for scoring: Clement=${clementPos}, Keashall=${keashallPos}`);
  console.log("(Using UTIL means they qualify in any week they play)\n");

  const clementScores = [];
  const keashallScores = [];

  for (const week of WEEKS) {
    const [cs, ks] = await Promise.all([
      getWeeklyScore(clement.id, "UTIL", week),
      getWeeklyScore(keashall.id, "UTIL", week),
    ]);
    clementScores.push(cs);
    keashallScores.push(ks);
    console.log(`Week ${week.week} (${week.start} to ${week.end}):`);
    console.log(`  ${clement.fullName}: ${cs.points} pts (${cs.stats.games}G, ${cs.stats.hits}H, ${cs.stats.homeRuns}HR, ${cs.stats.runs}R, ${cs.stats.rbi}RBI)${cs.isShortWeek ? " [short week]" : ""}${!cs.qualified ? ` [DQ: ${cs.dqReason}]` : ""}`);
    console.log(`  ${keashall.fullName}: ${ks.points} pts (${ks.stats.games}G, ${ks.stats.hits}H, ${ks.stats.homeRuns}HR, ${ks.stats.runs}R, ${ks.stats.rbi}RBI)${ks.isShortWeek ? " [short week]" : ""}${!ks.qualified ? ` [DQ: ${ks.dqReason}]` : ""}`);
  }

  const clementTotal = clementScores.reduce((s, w) => s + w.points, 0);
  const keashallTotal = keashallScores.reduce((s, w) => s + w.points, 0);

  console.log("\n=== SEASON TOTALS (Weeks 1-9) ===");
  console.log(`${clement.fullName}: ${clementTotal} points`);
  console.log(`${keashall.fullName}: ${keashallTotal} points`);
  console.log();

  if (clementTotal > keashallTotal) {
    console.log(`VERDICT: ${clement.fullName} OUTPERFORMED ${keashall.fullName} by ${clementTotal - keashallTotal} points`);
  } else if (keashallTotal > clementTotal) {
    console.log(`VERDICT: ${keashall.fullName} OUTPERFORMED ${clement.fullName} by ${keashallTotal - clementTotal} points`);
  } else {
    console.log("VERDICT: TIE");
  }

  // Weekly wins
  let clementWeeklyWins = 0, keashallWeeklyWins = 0, ties = 0;
  for (let i = 0; i < WEEKS.length; i++) {
    if (clementScores[i].points > keashallScores[i].points) clementWeeklyWins++;
    else if (keashallScores[i].points > clementScores[i].points) keashallWeeklyWins++;
    else ties++;
  }
  console.log(`\nWeekly wins: ${clement.fullName} ${clementWeeklyWins} - ${keashallWeeklyWins} ${keashall.fullName} (${ties} ties)`);
}

main().catch(console.error);

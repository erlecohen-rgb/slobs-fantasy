import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const MLB_API = "https://statsapi.mlb.com/api/v1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface RosterPlayer {
  mlb_player_id: number;
  mlb_player_name: string;
  mlb_team: string;
  primary_position: string;
  is_pitcher: boolean;
}

// POST /api/forecast
// Body: { team_id, start_date, end_date }
export async function POST(request: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { team_id, start_date, end_date } = body;

  if (!team_id || !start_date || !end_date) {
    return NextResponse.json({ error: "team_id, start_date, end_date required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get roster
  const { data: players } = await supabase
    .from("roster_players")
    .select("mlb_player_id, mlb_player_name, mlb_team, primary_position, is_pitcher")
    .eq("team_id", team_id)
    .is("dropped_at", null);

  if (!players || players.length === 0) {
    return NextResponse.json({ error: "No players found" }, { status: 404 });
  }

  // Gather data in parallel
  const starters = players.filter((p) => p.is_pitcher && p.primary_position === "SP");
  const [schedule, probablePitchers, recentStats, injuries, rotationProjections] = await Promise.all([
    fetchSchedule(start_date, end_date),
    fetchProbablePitchers(start_date, end_date),
    fetchRecentStats(players, start_date),
    fetchInjuries(),
    projectRotationStarts(starters, start_date, end_date),
  ]);

  // Build the context for Claude
  const rosterContext = buildRosterContext(players, schedule, probablePitchers, recentStats, injuries, start_date, end_date, rotationProjections);

  // Call Claude to generate the forecast
  const forecast = await generateForecast(rosterContext);

  return NextResponse.json({ forecast, data: rosterContext });
}

async function fetchSchedule(startDate: string, endDate: string) {
  try {
    const res = await fetch(
      `${MLB_API}/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&gameType=R&hydrate=team`
    );
    const data = await res.json();

    // Count games per team
    const teamGames: Record<string, { count: number; opponents: string[] }> = {};
    for (const date of data.dates || []) {
      for (const game of date.games || []) {
        const away = game.teams?.away?.team;
        const home = game.teams?.home?.team;
        if (away && home) {
          const awayAbbr = away.abbreviation || away.name;
          const homeAbbr = home.abbreviation || home.name;
          if (!teamGames[awayAbbr]) teamGames[awayAbbr] = { count: 0, opponents: [] };
          if (!teamGames[homeAbbr]) teamGames[homeAbbr] = { count: 0, opponents: [] };
          teamGames[awayAbbr].count++;
          teamGames[awayAbbr].opponents.push(`@${homeAbbr}`);
          teamGames[homeAbbr].count++;
          teamGames[homeAbbr].opponents.push(`vs ${awayAbbr}`);
        }
      }
    }
    return teamGames;
  } catch {
    return {};
  }
}

async function fetchProbablePitchers(startDate: string, endDate: string) {
  try {
    const res = await fetch(
      `${MLB_API}/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&gameType=R&hydrate=probablePitcher`
    );
    const data = await res.json();

    const pitcherStarts: Record<number, { dates: string[]; opponents: string[] }> = {};
    for (const date of data.dates || []) {
      for (const game of date.games || []) {
        for (const side of ["away", "home"] as const) {
          const pp = game.teams?.[side]?.probablePitcher;
          if (pp?.id) {
            if (!pitcherStarts[pp.id]) pitcherStarts[pp.id] = { dates: [], opponents: [] };
            pitcherStarts[pp.id].dates.push(date.date);
            const oppSide = side === "away" ? "home" : "away";
            const opp = game.teams?.[oppSide]?.team;
            pitcherStarts[pp.id].opponents.push(
              `${side === "away" ? "@" : "vs "}${opp?.abbreviation || opp?.name || "?"}`
            );
          }
        }
      }
    }
    return pitcherStarts;
  } catch {
    return {};
  }
}

async function fetchRecentStats(players: RosterPlayer[], beforeDate: string) {
  // Get last 14 days of stats for hot/cold analysis
  const d = new Date(beforeDate + "T12:00:00");
  d.setDate(d.getDate() - 14);
  const twoWeeksAgo = d.toISOString().split("T")[0];

  const results: Record<number, Record<string, unknown>> = {};

  // Fetch in batches to avoid overwhelming the API
  const batches = [];
  for (let i = 0; i < players.length; i += 5) {
    batches.push(players.slice(i, i + 5));
  }

  for (const batch of batches) {
    const promises = batch.map(async (p) => {
      if (!p.mlb_player_id) return;
      try {
        const group = p.is_pitcher ? "pitching" : "hitting";
        const res = await fetch(
          `${MLB_API}/people/${p.mlb_player_id}/stats?stats=gameLog&group=${group}&startDate=${twoWeeksAgo}&endDate=${beforeDate}&sportId=1`
        );
        const data = await res.json();
        const splits = data.stats?.[0]?.splits || [];

        if (p.is_pitcher) {
          const totalIP = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.inningsPitched || 0), 0);
          const totalK = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.strikeOuts || 0), 0);
          const totalER = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.earnedRuns || 0), 0);
          const wins = splits.filter((g: Record<string, Record<string, number>>) => g.stat?.wins > 0).length;
          results[p.mlb_player_id] = {
            games: splits.length,
            ip: totalIP,
            k: totalK,
            er: totalER,
            wins,
            era: totalIP > 0 ? ((totalER / totalIP) * 9).toFixed(2) : "N/A",
          };
        } else {
          const totalAB = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.atBats || 0), 0);
          const totalH = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.hits || 0), 0);
          const totalHR = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.homeRuns || 0), 0);
          const totalRBI = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.rbi || 0), 0);
          const totalR = splits.reduce((s: number, g: Record<string, Record<string, number>>) => s + (g.stat?.runs || 0), 0);
          results[p.mlb_player_id] = {
            games: splits.length,
            ab: totalAB,
            h: totalH,
            hr: totalHR,
            rbi: totalRBI,
            runs: totalR,
            avg: totalAB > 0 ? (totalH / totalAB).toFixed(3) : "N/A",
          };
        }
      } catch {
        // skip
      }
    });
    await Promise.all(promises);
  }

  return results;
}

async function projectRotationStarts(
  starters: RosterPlayer[],
  forecastStart: string,
  forecastEnd: string,
): Promise<Record<number, { lastStart: string; avgGap: number; projectedDates: string[]; confidence: string; recentStarts: string[] }>> {
  const results: Record<number, { lastStart: string; avgGap: number; projectedDates: string[]; confidence: string; recentStarts: string[] }> = {};

  // Look back 30 days for start history
  const lookbackDate = new Date(forecastStart + "T12:00:00");
  lookbackDate.setDate(lookbackDate.getDate() - 30);
  const lookback = lookbackDate.toISOString().split("T")[0];

  const batches = [];
  for (let i = 0; i < starters.length; i += 5) {
    batches.push(starters.slice(i, i + 5));
  }

  for (const batch of batches) {
    const promises = batch.map(async (p) => {
      if (!p.mlb_player_id) return;
      try {
        const res = await fetch(
          `${MLB_API}/people/${p.mlb_player_id}/stats?stats=gameLog&group=pitching&startDate=${lookback}&endDate=${forecastStart}&sportId=1`
        );
        const data = await res.json();
        const splits = data.stats?.[0]?.splits || [];

        // Find starts (gamesStarted > 0)
        const startDates = splits
          .filter((s: Record<string, Record<string, number>>) => s.stat?.gamesStarted > 0)
          .map((s: Record<string, string>) => s.date)
          .sort();

        if (startDates.length === 0) {
          results[p.mlb_player_id] = {
            lastStart: "none",
            avgGap: 0,
            projectedDates: [],
            confidence: "no recent starts - may be injured, in bullpen, or minor leagues",
            recentStarts: [],
          };
          return;
        }

        // Calculate average gap between starts
        const gaps: number[] = [];
        for (let i = 1; i < startDates.length; i++) {
          const d1 = new Date(startDates[i - 1] + "T12:00:00");
          const d2 = new Date(startDates[i] + "T12:00:00");
          gaps.push(Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000)));
        }
        const avgGap = gaps.length > 0
          ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
          : 5; // default 5-day rotation

        const lastStart = startDates[startDates.length - 1];

        // Project forward from last start
        const projected: string[] = [];
        let nextDate = new Date(lastStart + "T12:00:00");
        const endDate = new Date(forecastEnd + "T12:00:00");
        const startDateObj = new Date(forecastStart + "T12:00:00");

        for (let attempt = 0; attempt < 5; attempt++) {
          nextDate = new Date(nextDate.getTime() + avgGap * 24 * 60 * 60 * 1000);
          if (nextDate > endDate) break;
          if (nextDate >= startDateObj) {
            projected.push(nextDate.toISOString().split("T")[0]);
          }
        }

        // Confidence based on data quality
        let confidence: string;
        if (startDates.length >= 4 && gaps.every((g) => Math.abs(g - avgGap) <= 1)) {
          confidence = "high - consistent rotation pattern";
        } else if (startDates.length >= 2) {
          confidence = "medium - some start history but gaps vary";
        } else {
          confidence = "low - only 1 recent start, gap is estimated";
        }

        // Days since last start
        const daysSinceLast = Math.round(
          (startDateObj.getTime() - new Date(lastStart + "T12:00:00").getTime()) / (24 * 60 * 60 * 1000)
        );
        if (daysSinceLast > avgGap + 3) {
          confidence += ` (${daysSinceLast} days since last start - may be skipped/injured)`;
        }

        results[p.mlb_player_id] = {
          lastStart,
          avgGap,
          projectedDates: projected,
          confidence,
          recentStarts: startDates.slice(-5), // last 5 starts
        };
      } catch {
        // skip
      }
    });
    await Promise.all(promises);
  }

  return results;
}

async function fetchInjuries() {
  // MLB doesn't have a public injury API, but we can check roster status
  // Use the injuries endpoint if available
  try {
    const res = await fetch(`${MLB_API}/injuries?sportId=1`);
    const data = await res.json();
    const injuries: Record<number, string> = {};
    for (const injury of data.injuries || []) {
      if (injury.player?.id) {
        injuries[injury.player.id] = `${injury.status || "IL"}: ${injury.description || "unknown"}`;
      }
    }
    return injuries;
  } catch {
    return {};
  }
}

function buildRosterContext(
  players: RosterPlayer[],
  schedule: Record<string, { count: number; opponents: string[] }>,
  probablePitchers: Record<number, { dates: string[]; opponents: string[] }>,
  recentStats: Record<number, Record<string, unknown>>,
  injuries: Record<number, string>,
  startDate: string,
  endDate: string,
  rotationProjections: Record<number, { lastStart: string; avgGap: number; projectedDates: string[]; confidence: string; recentStarts: string[] }>,
) {
  const batters = players.filter((p) => !p.is_pitcher);
  const pitchers = players.filter((p) => p.is_pitcher);

  const batterInfo = batters.map((p) => {
    const teamSchedule = schedule[p.mlb_team] || { count: 0, opponents: [] };
    const recent = recentStats[p.mlb_player_id] || {};
    const injury = injuries[p.mlb_player_id];
    return {
      name: p.mlb_player_name,
      position: p.primary_position,
      team: p.mlb_team,
      gamesThisWeek: teamSchedule.count,
      opponents: teamSchedule.opponents,
      recent14d: recent,
      injury: injury || null,
    };
  });

  const pitcherInfo = pitchers.map((p) => {
    const teamSchedule = schedule[p.mlb_team] || { count: 0, opponents: [] };
    const starts = probablePitchers[p.mlb_player_id];
    const recent = recentStats[p.mlb_player_id] || {};
    const injury = injuries[p.mlb_player_id];
    const rotation = rotationProjections[p.mlb_player_id];
    return {
      name: p.mlb_player_name,
      role: p.primary_position,
      team: p.mlb_team,
      confirmedStarts: starts ? starts.dates.length : 0,
      confirmedStartDates: starts?.dates || [],
      confirmedStartOpponents: starts?.opponents || [],
      rotationProjection: rotation ? {
        lastStart: rotation.lastStart,
        avgDaysBetweenStarts: rotation.avgGap,
        projectedStartDates: rotation.projectedDates,
        confidence: rotation.confidence,
        recentStartDates: rotation.recentStarts,
      } : null,
      teamGames: teamSchedule.count,
      teamOpponents: teamSchedule.opponents,
      recent14d: recent,
      injury: injury || null,
    };
  });

  return {
    period: `${startDate} to ${endDate}`,
    batters: batterInfo,
    pitchers: pitcherInfo,
  };
}

async function generateForecast(context: Record<string, unknown>): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a fantasy baseball analyst for the SLOBS league which uses a custom scoring system with thresholds (hits only count after 4th hit, runs produced after 4th RP, 5 pts per extra hit, 10 per extra RP). Pitchers score on wins, quality starts, K above IP, saves, holds. Extra base hits (2B=10, 3B=25, HR=15) and SBs/HBP (5 each) are valuable. Errors cost -10.

Based on the following roster data for the period ${(context as {period: string}).period}, write a concise forecast (3-4 paragraphs max) covering:

1. **Schedule:** Which teams have 6-7 games (great) vs 5 or fewer (thin)? Call out specific players affected.
2. **Pitchers:** Use the rotation projection data (lastStart, avgDaysBetweenStarts, projectedStartDates, confidence) to estimate likely starts. The "confirmedStarts" from MLB are only set 2-3 days out, so most will show 0 — that's normal. Use the rotation projection instead. Note confidence levels. If a pitcher hasn't started recently, flag it as a concern.
3. **Hot/Cold:** Based on last 14 days, who's hot (activate) and who's cold (consider benching)? Reference actual stats.
4. **Injuries & Alerts:** Anyone injured or at risk of sitting?
5. **Recommendations:** Specific lineup suggestions - who to activate, who to bench, any position concerns.

Be direct and specific. Use player names. This is for an experienced fantasy player.

Roster data:
${JSON.stringify(context, null, 2)}`,
        },
      ],
    }),
  });

  const data = await res.json();
  if (data.content?.[0]?.text) {
    return data.content[0].text;
  }
  if (data.error) {
    throw new Error(data.error.message || "Claude API error");
  }
  return "Unable to generate forecast.";
}

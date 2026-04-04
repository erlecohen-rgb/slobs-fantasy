// MLB Stats API integration
// Docs: https://statsapi.mlb.com

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

export interface MLBPlayer {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  primaryPosition: {
    code: string;
    name: string;
    abbreviation: string;
  };
  currentTeam?: {
    id: number;
    name: string;
    abbreviation?: string;
  };
  batSide?: { code: string };
  pitchHand?: { code: string };
}

export interface MLBTeam {
  id: number;
  name: string;
  abbreviation: string;
}

export interface MLBGameLog {
  date: string;
  opponent: string;
  stat: Record<string, number | string>;
}

// Search for players by name
export async function searchPlayers(query: string): Promise<MLBPlayer[]> {
  const res = await fetch(
    `${MLB_API_BASE}/people/search?names=${encodeURIComponent(query)}&sportId=1&active=true`
  );
  const data = await res.json();
  return data.people || [];
}

// Get all players on active MLB rosters for current season
export async function getActiveRosterPlayers(season?: number): Promise<MLBPlayer[]> {
  const yr = season || new Date().getFullYear();
  const res = await fetch(
    `${MLB_API_BASE}/sports/1/players?season=${yr}&activeStatus=ACTIVE`
  );
  const data = await res.json();
  return data.people || [];
}

// Get all MLB teams
export async function getMLBTeams(): Promise<MLBTeam[]> {
  const res = await fetch(`${MLB_API_BASE}/teams?sportId=1`);
  const data = await res.json();
  return (data.teams || []).map((t: Record<string, unknown>) => ({
    id: t.id,
    name: t.name,
    abbreviation: t.abbreviation,
  }));
}

// Get player's game log for a date range
export async function getPlayerGameLog(
  playerId: number,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<MLBGameLog[]> {
  const res = await fetch(
    `${MLB_API_BASE}/people/${playerId}/stats?stats=gameLog&group=hitting,pitching,fielding&startDate=${startDate}&endDate=${endDate}&sportId=1`
  );
  const data = await res.json();

  const gameLogs: MLBGameLog[] = [];
  for (const statGroup of data.stats || []) {
    for (const split of statGroup.splits || []) {
      gameLogs.push({
        date: split.date,
        opponent: split.opponent?.name || "Unknown",
        stat: split.stat || {},
      });
    }
  }
  return gameLogs;
}

// Get a player's hitting stats for a specific date range
export async function getHittingGameLog(
  playerId: number,
  startDate: string,
  endDate: string
) {
  const res = await fetch(
    `${MLB_API_BASE}/people/${playerId}/stats?stats=gameLog&group=hitting&startDate=${startDate}&endDate=${endDate}&sportId=1`
  );
  const data = await res.json();
  const splits = data.stats?.[0]?.splits || [];
  return splits.map((s: Record<string, Record<string, unknown>>) => ({
    date: s.date,
    opponent: (s.opponent as Record<string, unknown>)?.name || "",
    ...s.stat,
  }));
}

// Get a player's pitching stats for a specific date range
export async function getPitchingGameLog(
  playerId: number,
  startDate: string,
  endDate: string
) {
  const res = await fetch(
    `${MLB_API_BASE}/people/${playerId}/stats?stats=gameLog&group=pitching&startDate=${startDate}&endDate=${endDate}&sportId=1`
  );
  const data = await res.json();
  const splits = data.stats?.[0]?.splits || [];
  return splits.map((s: Record<string, Record<string, unknown>>) => ({
    date: s.date,
    opponent: (s.opponent as Record<string, unknown>)?.name || "",
    ...s.stat,
  }));
}

// Get a player's fielding stats for a specific date range
export async function getFieldingGameLog(
  playerId: number,
  startDate: string,
  endDate: string
) {
  const res = await fetch(
    `${MLB_API_BASE}/people/${playerId}/stats?stats=gameLog&group=fielding&startDate=${startDate}&endDate=${endDate}&sportId=1`
  );
  const data = await res.json();
  const splits = data.stats?.[0]?.splits || [];
  return splits.map((s: Record<string, Record<string, unknown>>) => {
    const pos = (s.position as Record<string, unknown>)?.abbreviation || "";
    return {
      ...s.stat,
      date: s.date,
      position: pos, // must come after ...s.stat since stat also has a 'position' key
    };
  });
}

// Get the MLB schedule for a date range (to count games per team)
export async function getSchedule(startDate: string, endDate: string) {
  const res = await fetch(
    `${MLB_API_BASE}/schedule?startDate=${startDate}&endDate=${endDate}&sportId=1&gameType=R`
  );
  const data = await res.json();
  return data.dates || [];
}

// Get player info by ID
export async function getPlayer(playerId: number): Promise<MLBPlayer | null> {
  const res = await fetch(`${MLB_API_BASE}/people/${playerId}`);
  const data = await res.json();
  return data.people?.[0] || null;
}

// Week calculation helpers
export function getCurrentWeekRange(): { start: string; end: string; weekNumber: number } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
    weekNumber: getWeekNumber(monday),
  };
}

export function getWeekRange(weekNumber: number, seasonYear: number): { start: string; end: string } {
  // MLB season typically starts late March / early April
  // Week 1 starts the Monday of or before Opening Day
  // For simplicity, we'll calculate based on a configurable season start
  const seasonStart = new Date(`${seasonYear}-03-23`); // approximate, should be configurable
  const startDay = seasonStart.getDay();
  const firstMonday = new Date(seasonStart);
  firstMonday.setDate(seasonStart.getDate() - ((startDay + 6) % 7));

  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: formatDate(weekStart),
    end: formatDate(weekEnd),
  };
}

function getWeekNumber(date: Date): number {
  // Simplified - should be based on season start
  const seasonStart = new Date(`${date.getFullYear()}-03-23`);
  const startDay = seasonStart.getDay();
  const firstMonday = new Date(seasonStart);
  firstMonday.setDate(seasonStart.getDate() - ((startDay + 6) % 7));

  const diff = date.getTime() - firstMonday.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

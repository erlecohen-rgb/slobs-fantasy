"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface RosterPlayer {
  id: string;
  mlb_player_id: number;
  mlb_player_name: string;
  primary_position: string;
  is_pitcher: boolean;
}

interface Team {
  id: string;
  name: string;
  owner_user_id: string;
  roster_players: RosterPlayer[];
}

interface PlayerResult {
  mlbPlayerId: number;
  position: string;
  role?: string;
  stats: Record<string, unknown>;
  scoring: {
    points: number;
    qualified: boolean;
    disqualificationReason?: string;
    breakdown: { category: string; stat: number; points: number; note?: string }[];
    specialAwards: { name: string; description: string; payout: number }[];
  };
}

interface WeekResult {
  weekNumber: number;
  dateRange: { start: string; end: string };
  results: PlayerResult[];
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  return sun;
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function ScoresPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shortWeek, setShortWeek] = useState(false);
  const [activePlayers, setActivePlayers] = useState<Set<string>>(new Set());
  const [lineupLoaded, setLineupLoaded] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [weekResult, setWeekResult] = useState<WeekResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useEffect(() => {
    const monday = getMonday(new Date());
    const sunday = getSunday(monday);
    setStartDate(fmt(monday));
    setEndDate(fmt(sunday));

    fetch("/api/roster?league_id=01756471-3bd1-4e83-8533-093d9e97bb86")
      .then((r) => r.json())
      .then((data) => {
        const t = data.teams || [];
        setTeams(t);
      });
  }, []);

  // Auto-select user's team when teams load or user changes
  useEffect(() => {
    if (teams.length === 0 || selectedTeamId) return;
    const grizzlies = teams.find((t) => t.name === "Grumpy Grizzlies");
    const defaultTeam = grizzlies || teams[0];
    if (defaultTeam) {
      setSelectedTeamId(defaultTeam.id);
    }
  }, [teams, selectedTeamId]);

  // When team or date changes, load lineup from DB
  useEffect(() => {
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team || !startDate || !endDate) return;
    setLineupLoaded(false);
    setWeekResult(null);

    fetch(`/api/roster/lineup?team_id=${selectedTeamId}&start_date=${startDate}&end_date=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        const players: { roster_player_id: string }[] = data.players || [];
        if (players.length > 0) {
          setActivePlayers(new Set(players.map((p) => p.roster_player_id)));
        } else {
          // No saved lineup — default all active
          setActivePlayers(new Set(team.roster_players.map((p) => p.id)));
        }
        setLineupLoaded(true);
      })
      .catch(() => {
        // On error, default to all active
        setActivePlayers(new Set(team.roster_players.map((p) => p.id)));
        setLineupLoaded(true);
      });
  }, [selectedTeamId, startDate, endDate, teams]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const allPlayers = selectedTeam?.roster_players || [];

  // Two-way player safe: use activated position, not is_pitcher flag
  const isPitcherPosition = (p: RosterPlayer) =>
    p.primary_position === "SP" || p.primary_position === "RP";

  function setWeekFromOffset(offset: number) {
    const current = startDate ? new Date(startDate + "T12:00:00") : getMonday(new Date());
    current.setDate(current.getDate() + offset * 7);
    const monday = getMonday(current);
    setStartDate(fmt(monday));
    setEndDate(fmt(getSunday(monday)));
  }

  // Roster validation
  const REQUIRED_BATTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "DH"];
  const REQUIRED_SP = 4;
  const REQUIRED_RP = 2;

  function validateRoster(): { valid: boolean; warnings: string[]; errors: string[] } {
    const activeList = allPlayers.filter((p) => activePlayers.has(p.id));
    const activeBats = activeList.filter((p) => !isPitcherPosition(p));
    const activeSP = activeList.filter((p) => p.primary_position === "SP");
    const activeRP = activeList.filter((p) => p.primary_position === "RP");

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check batter positions
    const filledPositions = new Set(activeBats.map((p) => p.primary_position));
    const missingPositions = REQUIRED_BATTER_POSITIONS.filter((pos) => !filledPositions.has(pos));
    if (missingPositions.length > 0) {
      warnings.push(`Missing batter position(s): ${missingPositions.join(", ")}`);
    }

    // Check for duplicate positions (more than allowed at a position)
    // OF can have multiple, others should be 1
    for (const pos of ["C", "1B", "2B", "3B", "SS", "DH"]) {
      const count = activeBats.filter((p) => p.primary_position === pos).length;
      if (count > 1) {
        warnings.push(`${count} players at ${pos} (expected 1)`);
      }
    }

    // Check pitchers
    if (activeSP.length < REQUIRED_SP) {
      warnings.push(`${activeSP.length} SP active (expected ${REQUIRED_SP})`);
    }
    if (activeRP.length < REQUIRED_RP) {
      warnings.push(`${activeRP.length} RP active (expected ${REQUIRED_RP})`);
    }

    // No active players at all = hard error
    if (activeList.filter((p) => p.mlb_player_id > 0).length === 0) {
      errors.push("No active players with MLB IDs");
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  const rosterCheck = validateRoster();
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);

  async function calculateScores() {
    if (!selectedTeam) return;

    if (rosterCheck.warnings.length > 0 && !showWarningConfirm) {
      setShowWarningConfirm(true);
      return;
    }
    setShowWarningConfirm(false);

    setCalculating(true);
    setError(null);
    setWeekResult(null);

    // Score ALL roster entries independently. Two-way players (e.g. Ohtani)
    // have separate DH and SP entries — each gets its own score.
    // Only active entries count toward the weekly total.
    const players = allPlayers
      .filter((p) => p.mlb_player_id > 0)
      .map((p) => ({
        mlbPlayerId: p.mlb_player_id,
        position: p.primary_position,
        isPitcher: p.primary_position === "SP" || p.primary_position === "RP",
        role: (p.primary_position === "SP" || p.primary_position === "RP") ? p.primary_position : undefined,
      }));

    if (players.length === 0) {
      setError("No players with MLB IDs found. Players need MLB IDs to calculate scores.");
      setCalculating(false);
      return;
    }

    try {
      const res = await fetch("/api/scores/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: 1, // not used for date range
          seasonYear: 2026,
          players,
          shortWeek,
          startDate,
          endDate,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setWeekResult(data);
      }
    } catch (e) {
      setError("Failed to calculate: " + String(e));
    }
    setCalculating(false);
  }

  // Build lookup maps. Each roster entry is independent — two-way players
  // (e.g. Ohtani) have separate entries keyed by "mlbId-position".
  const playerNameMap = new Map<number, string>();
  const activeKeys = new Set<string>(); // "mlbId-position" keys for active entries
  // Map from "mlbId-position" back to roster UUID for toggling
  const keyToRosterId = new Map<string, string>();

  allPlayers.forEach((p) => {
    playerNameMap.set(p.mlb_player_id, p.mlb_player_name);
    const key = `${p.mlb_player_id}-${p.primary_position}`;
    keyToRosterId.set(key, p.id);
    if (activePlayers.has(p.id)) {
      activeKeys.add(key);
    }
  });

  function togglePlayerActive(mlbPlayerId: number, position: string) {
    const rosterId = keyToRosterId.get(`${mlbPlayerId}-${position}`);
    if (!rosterId) return;
    setActivePlayers((prev) => {
      const next = new Set(prev);
      if (next.has(rosterId)) next.delete(rosterId);
      else next.add(rosterId);
      return next;
    });
  }

  // Use result's own position to split into batter/pitcher sections
  const resultKey = (r: PlayerResult) => `${r.mlbPlayerId}-${r.position}`;
  const batterResults = weekResult?.results.filter((r) => r.position !== "SP" && r.position !== "RP") || [];
  const pitcherResults = weekResult?.results.filter((r) => r.position === "SP" || r.position === "RP") || [];

  // Only count active + qualified entries in totals
  const batterTotal = batterResults
    .filter((r) => activeKeys.has(resultKey(r)))
    .reduce((s, r) => s + (r.scoring.qualified ? r.scoring.points : 0), 0);
  const pitcherTotal = pitcherResults
    .filter((r) => activeKeys.has(resultKey(r)))
    .reduce((s, r) => s + (r.scoring.qualified ? r.scoring.points : 0), 0);
  const weekTotal = batterTotal + pitcherTotal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Weekly Scores</h1>
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Date Range + Calculate */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setWeekFromOffset(-1)} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Prev Week</button>
            <button onClick={() => setWeekFromOffset(1)} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Next Week</button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={shortWeek}
              onChange={(e) => setShortWeek(e.target.checked)}
              className="rounded border-gray-300"
            />
            Short week (no thresholds)
          </label>
          <button
            onClick={calculateScores}
            disabled={calculating || !rosterCheck.valid}
            className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 text-sm font-bold ml-auto"
          >
            {calculating ? "Calculating..." : showWarningConfirm ? "Calculate Anyway" : "Calculate"}
          </button>
        </div>
      </div>

      {/* Roster Validation */}
      {rosterCheck.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {rosterCheck.errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}
      {showWarningConfirm && rosterCheck.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
          <p className="font-medium mb-1">Roster warnings:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {rosterCheck.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <p className="mt-2 text-xs text-amber-600">Click &quot;Calculate Anyway&quot; to proceed, or fix your lineup in the <a href="/roster" className="underline">Roster tab</a>.</p>
        </div>
      )}
      {!showWarningConfirm && rosterCheck.warnings.length > 0 && !weekResult && (
        <div className="flex items-center gap-2 text-xs text-amber-600">
          <span>Roster: {rosterCheck.warnings.join(" | ")}</span>
        </div>
      )}

      {/* Weekly Forecast - for NEXT week */}
      <ForecastPanel teamId={selectedTeamId} currentStartDate={startDate} />

      {/* Lineup Slots Visual */}
      <SlotsBar allPlayers={allPlayers} activePlayers={activePlayers} />

      {/* Lineup info — set from Roster tab */}
      {lineupLoaded && (
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <span>Lineup loaded from Roster tab:</span>
          <span className="font-medium text-gray-700">{activePlayers.size} active</span>
          <span className="text-gray-300">/</span>
          <span>{allPlayers.length - activePlayers.size} bench</span>
          <a href="/roster" className="ml-2 text-green-700 underline hover:text-green-900">Edit lineup →</a>
          <button
            onClick={() => setActivePlayers(new Set(allPlayers.map((p) => p.id)))}
            className="ml-2 text-blue-600 underline hover:text-blue-800"
          >
            Set all active
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {weekResult && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Batting</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{batterTotal}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Pitching</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{pitcherTotal}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total</p>
              <p className="text-3xl font-bold mt-1">{weekTotal}</p>
            </div>
          </div>

          {/* Special Awards */}
          {weekResult.results.some((r) => r.scoring.specialAwards.length > 0) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Special Awards</h3>
              {weekResult.results
                .filter((r) => r.scoring.specialAwards.length > 0)
                .flatMap((r) =>
                  r.scoring.specialAwards.map((a, i) => (
                    <div key={`${r.mlbPlayerId}-${i}`} className="text-sm text-yellow-700">
                      <span className="font-medium">{a.name}</span> - {playerNameMap.get(r.mlbPlayerId)}: {a.description}
                    </div>
                  ))
                )}
            </div>
          )}

          {/* Batter Scores */}
          <ScoreSection
            title={`Batting (${batterTotal} pts)`}
            results={batterResults}
            playerNameMap={playerNameMap}
            isPitcher={false}
            activeKeys={activeKeys}
            expandedPlayer={expandedPlayer}
            setExpandedPlayer={setExpandedPlayer}
            togglePlayerActive={togglePlayerActive}
          />

          {/* Pitcher Scores */}
          <ScoreSection
            title={`Pitching (${pitcherTotal} pts)`}
            results={pitcherResults}
            playerNameMap={playerNameMap}
            isPitcher={true}
            activeKeys={activeKeys}
            expandedPlayer={expandedPlayer}
            setExpandedPlayer={setExpandedPlayer}
            togglePlayerActive={togglePlayerActive}
          />
        </>
      )}
    </div>
  );
}

function ForecastPanel({
  teamId,
  currentStartDate,
}: {
  teamId: string;
  currentStartDate: string;
}) {
  const [forecast, setForecast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Forecast is always for NEXT week (Mon-Sun after the current period)
  const baseDate = currentStartDate || fmt(getMonday(new Date()));
  const nextMonday = new Date(baseDate + "T12:00:00");
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  const forecastStart = fmt(nextMonday);
  const forecastEnd = fmt(nextSunday);

  async function generateForecast() {
    setLoading(true);
    setError(null);
    setForecast(null);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, start_date: forecastStart, end_date: forecastEnd }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setForecast(data.forecast);
      }
    } catch (e) {
      setError("Failed to generate forecast: " + String(e));
    }
    setLoading(false);
  }

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow border border-green-200">
      <div className="px-4 py-3 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-green-900">
          Next Week Forecast ({forecastStart} to {forecastEnd})
        </h2>
        <div className="flex items-center gap-2">
          {forecast && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
          <button
            onClick={generateForecast}
            disabled={loading}
            className="bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : forecast ? "Refresh" : "Generate Forecast"}
          </button>
        </div>
      </div>
      {error && (
        <div className="px-4 pb-3 text-sm text-red-600">{error}</div>
      )}
      {loading && (
        <div className="px-4 pb-4 text-sm text-gray-500">
          Pulling MLB schedule, probable pitchers, recent stats, and injury data...
        </div>
      )}
      {forecast && !collapsed && (
        <div className="px-4 pb-4 prose prose-sm max-w-none text-gray-800">
          <ReactMarkdown>{forecast}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function SlotsBar({
  allPlayers,
  activePlayers,
}: {
  allPlayers: RosterPlayer[];
  activePlayers: Set<string>;
}) {
  const activeList = allPlayers.filter((p) => activePlayers.has(p.id));

  const BATTER_SLOTS = [
    { pos: "C", label: "C", count: 1 },
    { pos: "1B", label: "1B", count: 1 },
    { pos: "2B", label: "2B", count: 1 },
    { pos: "3B", label: "3B", count: 1 },
    { pos: "SS", label: "SS", count: 1 },
    { pos: "OF", label: "OF", count: 3 },
    { pos: "DH", label: "DH", count: 1 },
  ];

  const PITCHER_SLOTS = [
    { pos: "SP", label: "SP", count: 4 },
    { pos: "RP", label: "RP", count: 2 },
  ];

  function getPlayersAtPos(pos: string, isPitcher: boolean) {
    return activeList
      .filter((p) => p.primary_position === pos && (p.primary_position === "SP" || p.primary_position === "RP") === isPitcher)
      .map((p) => p.mlb_player_name);
  }

  function renderSlots(
    slots: typeof BATTER_SLOTS,
    isPitcher: boolean,
    filledColor: string,
    filledBorder: string,
    filledText: string,
    filledLabel: string,
  ) {
    return slots.flatMap((slot) => {
      const names = getPlayersAtPos(slot.pos, isPitcher);
      const required = slot.count;
      // Show required slots + any overflow
      const totalToShow = Math.max(required, names.length);
      return Array.from({ length: totalToShow }, (_, i) => {
        const playerName = names[i] || "";
        const shortName = playerName ? playerName.split(" ").slice(-1)[0] : "";
        const isFilled = i < names.length;
        const isOverflow = i >= required; // extra player beyond required slots

        let className: string;
        if (isOverflow) {
          className = "bg-amber-50 border-amber-400 border-2";
        } else if (isFilled) {
          className = `${filledColor} ${filledBorder}`;
        } else {
          className = "bg-gray-50 border-dashed border-gray-300";
        }

        return (
          <div
            key={`${slot.pos}-${i}`}
            className={`flex flex-col items-center min-w-[52px] rounded-lg px-2 py-1.5 border ${className}`}
            title={isOverflow ? `Extra ${slot.label}: ${playerName} (over limit of ${required})` : playerName || `${slot.label} (empty)`}
          >
            <span className={`text-[10px] font-mono font-bold ${isOverflow ? "text-amber-700" : isFilled ? filledLabel : "text-gray-400"}`}>
              {isOverflow ? `+${slot.label}` : slot.label}
            </span>
            <span className={`text-[10px] truncate max-w-[48px] ${isOverflow ? "text-amber-800" : isFilled ? filledText : "text-gray-300"}`}>
              {shortName || "---"}
            </span>
          </div>
        );
      });
    });
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 font-medium uppercase w-full mb-1">Batting</span>
          {renderSlots(BATTER_SLOTS, false, "bg-green-50", "border-green-300", "text-green-900", "text-green-700")}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 font-medium uppercase w-full mb-1">Pitching</span>
          {renderSlots(PITCHER_SLOTS, true, "bg-blue-50", "border-blue-300", "text-blue-900", "text-blue-700")}
        </div>
      </div>
    </div>
  );
}

function BreakdownTable({
  breakdown,
  isPitcher,
}: {
  breakdown: { category: string; stat: number; points: number; note?: string }[];
  isPitcher: boolean;
}) {
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());

  // For pitchers, group items by game (items starting with "Game:" are headers)
  if (isPitcher) {
    const groups: { header: typeof breakdown[0]; items: typeof breakdown }[] = [];
    for (const item of breakdown) {
      if (item.category.startsWith("Game:")) {
        groups.push({ header: item, items: [] });
      } else if (groups.length > 0) {
        groups[groups.length - 1].items.push(item);
      } else {
        // Item before any game header (shouldn't happen, but handle gracefully)
        groups.push({ header: { category: "Summary", stat: 0, points: 0, note: "" }, items: [item] });
      }
    }

    return (
      <div className="space-y-1">
        {groups.map((group, gi) => {
          const gameExpanded = expandedGames.has(gi);
          const gamePts = group.items.reduce((s, item) => s + item.points, 0);
          return (
            <div key={gi}>
              <button
                onClick={() => {
                  const next = new Set(expandedGames);
                  if (next.has(gi)) next.delete(gi); else next.add(gi);
                  setExpandedGames(next);
                }}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-blue-50 text-left text-xs"
              >
                <div className="flex-1">
                  <span className="font-medium text-blue-800">{group.header.category.replace("Game: ", "")}</span>
                  <span className="text-gray-400 ml-2">{group.header.note}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${gamePts > 0 ? "text-green-700" : gamePts < 0 ? "text-red-600" : "text-gray-400"}`}>
                    {gamePts > 0 ? "+" : ""}{gamePts}
                  </span>
                  <span className="text-gray-300">{gameExpanded ? "[-]" : "[+]"}</span>
                </div>
              </button>
              {gameExpanded && group.items.length > 0 && (
                <table className="w-full text-xs ml-4 mb-2">
                  <tbody>
                    {group.items.map((item, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="py-1 pl-2 text-gray-600">{item.category}</td>
                        <td className={`py-1 text-right font-mono w-14 ${item.points < 0 ? "text-red-600" : item.points > 0 ? "text-green-700" : "text-gray-400"}`}>
                          {item.points > 0 ? "+" : ""}{item.points}
                        </td>
                        <td className="py-1 pl-3 text-gray-400">{item.note || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {gameExpanded && group.items.length === 0 && (
                <p className="text-xs text-gray-400 ml-6 mb-2">No scoring events this game</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // For batters, flat table (same as before)
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-400">
          <th className="text-left py-1">Category</th>
          <th className="text-right py-1 w-14">Pts</th>
          <th className="text-left py-1 pl-3">Detail</th>
        </tr>
      </thead>
      <tbody>
        {breakdown.map((item, i) => (
          <tr key={i} className="border-t border-gray-50">
            <td className="py-1">{item.category}</td>
            <td className={`py-1 text-right font-mono ${item.points < 0 ? "text-red-600" : item.points > 0 ? "text-green-700" : "text-gray-400"}`}>
              {item.points > 0 ? "+" : ""}{item.points}
            </td>
            <td className="py-1 pl-3 text-gray-400">{item.note || ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScoreSection({
  title, results, playerNameMap, isPitcher, activeKeys, expandedPlayer, setExpandedPlayer, togglePlayerActive,
}: {
  title: string;
  results: PlayerResult[];
  playerNameMap: Map<number, string>;
  isPitcher: boolean;
  activeKeys: Set<string>;
  expandedPlayer: string | null;
  setExpandedPlayer: (id: string | null) => void;
  togglePlayerActive: (mlbPlayerId: number, position: string) => void;
}) {
  const rKey = (r: PlayerResult) => `${r.mlbPlayerId}-${r.position}`;

  const sorted = [...results].sort((a, b) => {
    const aActive = activeKeys.has(rKey(a)) ? 0 : 1;
    const bActive = activeKeys.has(rKey(b)) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return b.scoring.points - a.scoring.points;
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {sorted.map((r) => {
          const key = rKey(r);
          const expanded = expandedPlayer === key;
          const isActive = activeKeys.has(key);
          return (
            <div key={key} className={isActive ? "" : "opacity-50"}>
              <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => togglePlayerActive(r.mlbPlayerId, r.position)}
                  className={`rounded border-gray-300 flex-shrink-0 ${isPitcher ? "text-blue-600" : "text-green-600"}`}
                />
                <button
                  onClick={() => setExpandedPlayer(expanded ? null : key)}
                  className="flex items-center justify-between flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded w-8 text-center flex-shrink-0 ${isPitcher ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                      {r.position}
                    </span>
                    <span className="text-sm font-medium truncate">{playerNameMap.get(r.mlbPlayerId) || `#${r.mlbPlayerId}`}</span>
                    {!isActive && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">bench</span>}
                    {!r.scoring.qualified && <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">DQ</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className={`font-mono font-bold text-sm ${r.scoring.points > 0 ? "text-green-700" : r.scoring.points < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {r.scoring.points > 0 ? "+" : ""}{r.scoring.points}
                    </span>
                    <span className="text-gray-300 text-xs">{expanded ? "[-]" : "[+]"}</span>
                  </div>
                </button>
              </div>
              {expanded && (
                <div className="px-4 pb-3">
                  {!r.scoring.qualified && r.scoring.disqualificationReason && (
                    <p className="text-xs text-red-500 mb-2">{r.scoring.disqualificationReason}</p>
                  )}
                  {r.scoring.breakdown.length > 0 ? (
                    <BreakdownTable breakdown={r.scoring.breakdown} isPitcher={isPitcher} />
                  ) : (
                    <p className="text-xs text-gray-400">No scoring activity</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {results.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">No results</div>}
      </div>
    </div>
  );
}

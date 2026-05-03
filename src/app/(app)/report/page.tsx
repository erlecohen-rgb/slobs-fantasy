"use client";

import { useState, useEffect } from "react";

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
  roster_players: RosterPlayer[];
}

interface BreakdownItem {
  category: string;
  stat: number;
  points: number;
  note?: string;
}

interface SpecialAward {
  name: string;
  description: string;
  payout: number;
}

interface PlayerResult {
  mlbPlayerId: number;
  position: string;
  role?: string;
  scoring: {
    points: number;
    qualified: boolean;
    disqualificationReason?: string;
    breakdown: BreakdownItem[];
    specialAwards: SpecialAward[];
  };
}

interface WeekResult {
  dateRange: { start: string; end: string };
  results: PlayerResult[];
}

function isPitcherPos(pos: string) { return pos === "SP" || pos === "RP"; }

export default function ReportPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [shortWeek, setShortWeek] = useState(false);
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<WeekResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/roster?league_id=01756471-3bd1-4e83-8533-093d9e97bb86")
      .then((r) => r.json())
      .then((data) => {
        const t = data.teams || [];
        setTeams(t);
        if (t.length > 0) setSelectedTeamId(t[0].id);
      });
  }, []);

  // When team changes, load activated set from localStorage (same key as scores page)
  useEffect(() => {
    if (!selectedTeamId) return;
    setReport(null);
    setError(null);
    try {
      const cached = localStorage.getItem(`slobs-active-${selectedTeamId}`);
      if (cached) {
        setActivatedIds(new Set(JSON.parse(cached) as string[]));
        return;
      }
    } catch { /* ignore */ }
    // Default: all players active
    const team = teams.find((t) => t.id === selectedTeamId);
    setActivatedIds(new Set(team?.roster_players.map((p) => p.id) ?? []));
  }, [selectedTeamId, teams]);

  function togglePlayer(id: string) {
    setActivatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setReport(null);
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const allPlayers = selectedTeam?.roster_players ?? [];
  const batters = allPlayers.filter((p) => !isPitcherPos(p.primary_position));
  const pitchers = allPlayers.filter((p) => isPitcherPos(p.primary_position));

  async function generateReport() {
    if (!selectedTeam || !startDate || !endDate) return;
    setLoading(true);
    setError(null);
    setReport(null);

    const players = allPlayers
      .filter((p) => activatedIds.has(p.id) && p.mlb_player_id > 0)
      .map((p) => ({
        mlbPlayerId: p.mlb_player_id,
        position: p.primary_position,
        isPitcher: p.is_pitcher,
        role: p.is_pitcher ? p.primary_position : undefined,
      }));

    if (players.length === 0) {
      setError("No players selected with valid MLB IDs.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/scores/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, startDate, endDate, shortWeek }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setReport(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const playerNames = new Map<number, string>();
  for (const p of allPlayers) playerNames.set(p.mlb_player_id, p.mlb_player_name);

  const reportBatters = report?.results.filter((r) => !isPitcherPos(r.position)) ?? [];
  const reportPitchers = report?.results.filter((r) => isPitcherPos(r.position)) ?? [];
  const totalPoints = report?.results.reduce((s, r) => s + (r.scoring.qualified ? r.scoring.points : 0), 0) ?? 0;
  const allAwards = report?.results.flatMap((r) =>
    r.scoring.specialAwards.map((a) => ({ ...a, playerName: playerNames.get(r.mlbPlayerId) ?? `ID ${r.mlbPlayerId}` }))
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Controls — hidden when printing */}
      <div className="print:hidden">
        <h1 className="text-3xl font-bold mb-4">Points Report</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {/* Team + dates */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={shortWeek} onChange={(e) => setShortWeek(e.target.checked)}
                className="rounded border-gray-300" />
              Short week
            </label>
          </div>

          {/* Player selection */}
          {selectedTeam && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Activated players ({activatedIds.size} selected)
                </p>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => setActivatedIds(new Set(allPlayers.map((p) => p.id)))}
                    className="text-blue-600 hover:underline">All</button>
                  <button onClick={() => setActivatedIds(new Set())}
                    className="text-blue-600 hover:underline">None</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                {/* Batters */}
                <div className="col-span-2 md:col-span-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Batters</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {batters.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="checkbox" checked={activatedIds.has(p.id)}
                          onChange={() => togglePlayer(p.id)} className="rounded border-gray-300" />
                        <span className="font-mono text-xs text-gray-500 w-8">{p.primary_position}</span>
                        <span className={p.mlb_player_id === 0 ? "text-gray-400" : ""}>{p.mlb_player_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Pitchers */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pitchers</p>
                  <div className="flex flex-col gap-0.5">
                    {pitchers.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="checkbox" checked={activatedIds.has(p.id)}
                          onChange={() => togglePlayer(p.id)} className="rounded border-gray-300" />
                        <span className="font-mono text-xs text-gray-500 w-8">{p.primary_position}</span>
                        <span className={p.mlb_player_id === 0 ? "text-gray-400" : ""}>{p.mlb_player_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={generateReport}
              disabled={loading || !selectedTeamId || !startDate || !endDate || activatedIds.size === 0}
              className="bg-green-700 text-white px-5 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 text-sm font-medium">
              {loading ? "Calculating…" : "Generate Report"}
            </button>
            {report && (
              <button onClick={() => window.print()}
                className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium">
                Print / Save PDF
              </button>
            )}
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      </div>

      {/* Report output */}
      {report && (
        <div className="bg-white rounded-lg shadow p-6 print:shadow-none print:p-0">
          <div className="mb-6 border-b border-gray-300 pb-4">
            <h2 className="text-2xl font-bold">{selectedTeam?.name}</h2>
            <p className="text-gray-600 text-sm mt-1">
              {report.dateRange.start} – {report.dateRange.end}{shortWeek && " (Short Week)"}
            </p>
            <p className="text-lg font-semibold mt-2">Total Points: {totalPoints}</p>
          </div>

          {reportBatters.length > 0 && (
            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3 text-green-800 border-b border-green-200 pb-1">Batters</h3>
              <div className="space-y-6">
                {reportBatters.map((r) => (
                  <PlayerSection key={r.mlbPlayerId}
                    name={playerNames.get(r.mlbPlayerId) ?? `ID ${r.mlbPlayerId}`}
                    position={r.position} result={r} />
                ))}
              </div>
            </section>
          )}

          {reportPitchers.length > 0 && (
            <section className="mb-8">
              <h3 className="text-lg font-bold mb-3 text-blue-800 border-b border-blue-200 pb-1">Pitchers</h3>
              <div className="space-y-6">
                {reportPitchers.map((r) => (
                  <PlayerSection key={r.mlbPlayerId}
                    name={playerNames.get(r.mlbPlayerId) ?? `ID ${r.mlbPlayerId}`}
                    position={r.position} result={r} />
                ))}
              </div>
            </section>
          )}

          {allAwards.length > 0 && (
            <section className="mb-4">
              <h3 className="text-lg font-bold mb-3 text-yellow-800 border-b border-yellow-200 pb-1">Special Awards</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-yellow-50 text-left">
                    <th className="px-3 py-2 font-medium">Player</th>
                    <th className="px-3 py-2 font-medium">Award</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-100">
                  {allAwards.map((a, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{a.playerName}</td>
                      <td className="px-3 py-1.5 font-medium">{a.name}</td>
                      <td className="px-3 py-1.5 text-gray-600">{a.description}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-medium ${a.payout >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {a.payout >= 0 ? `+$${a.payout}` : `-$${Math.abs(a.payout)}`} / team
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerSection({ name, position, result }: {
  name: string;
  position: string;
  result: PlayerResult;
}) {
  const gamelines = result.scoring.breakdown.filter(
    (b) => b.category.match(/^\d{4}-\d{2}-\d{2}/) || b.category.startsWith("Game:")
  );
  const scoring = result.scoring.breakdown.filter(
    (b) => !b.category.match(/^\d{4}-\d{2}-\d{2}/) && !b.category.startsWith("Game:")
  );

  return (
    <div className="print:break-inside-avoid">
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{name}</span>
          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{position}</span>
          {!result.scoring.qualified && (
            <span className="text-xs text-red-600 font-medium">DQ: {result.scoring.disqualificationReason}</span>
          )}
        </div>
        <span className={`font-bold ${result.scoring.qualified ? "text-green-800" : "text-gray-400"}`}>
          {result.scoring.qualified ? result.scoring.points : 0} pts
        </span>
      </div>
      <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-500">
            <th className="px-3 py-1.5 font-medium w-1/3">Category / Game</th>
            <th className="px-3 py-1.5 font-medium w-16 text-right">Stat</th>
            <th className="px-3 py-1.5 font-medium w-16 text-right">Pts</th>
            <th className="px-3 py-1.5 font-medium">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {gamelines.map((b, i) => (
            <tr key={`g${i}`} className="bg-blue-50/40">
              <td className="px-3 py-1 font-mono text-gray-600">{b.category}</td>
              <td className="px-3 py-1 text-right text-gray-500">{b.stat}</td>
              <td className="px-3 py-1 text-right">—</td>
              <td className="px-3 py-1 text-gray-600">{b.note}</td>
            </tr>
          ))}
          {scoring.filter((b) => b.points !== 0 || b.note).map((b, i) => (
            <tr key={`s${i}`} className={b.points !== 0 ? "" : "text-gray-400"}>
              <td className="px-3 py-1 font-medium">{b.category}</td>
              <td className="px-3 py-1 text-right font-mono">{b.stat}</td>
              <td className={`px-3 py-1 text-right font-mono font-medium ${b.points > 0 ? "text-green-700" : b.points < 0 ? "text-red-600" : "text-gray-400"}`}>
                {b.points > 0 ? `+${b.points}` : b.points === 0 ? "—" : b.points}
              </td>
              <td className="px-3 py-1 text-gray-500">{b.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

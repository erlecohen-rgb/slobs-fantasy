"use client";

import { useState, useEffect, useRef } from "react";

interface RosterPlayer {
  id: string;
  mlb_player_name: string;
  mlb_team: string;
  primary_position: string;
  is_pitcher: boolean;
}

interface Team {
  id: string;
  name: string;
  roster_players: RosterPlayer[];
}

interface MLBSearchResult {
  id: number;
  fullName: string;
  primaryPosition: { abbreviation: string };
  currentTeam?: { abbreviation?: string; name?: string };
}

const BATTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "UTIL", "DH"];
const PITCHER_POSITIONS = ["SP", "RP"];
const ALL_POSITIONS = [...BATTER_POSITIONS, ...PITCHER_POSITIONS];

const LEAGUE_ID = "01756471-3bd1-4e83-8533-093d9e97bb86";

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function positionColor(pos: string): string {
  if (pos === "SP" || pos === "RP")
    return "bg-blue-100 text-blue-800 border-blue-200";
  if (pos === "DH")
    return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-200";
}

export default function RosterPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  // Lineup state
  const [lineupActive, setLineupActive] = useState<Set<string>>(new Set());
  const [lineupLoaded, setLineupLoaded] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);
  const [lineupSavedMsg, setLineupSavedMsg] = useState(false);

  // Add player state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MLBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addPositions, setAddPositions] = useState<Map<number, string>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  const weekStart = fmt(getMonday(new Date()));

  function refreshRoster() {
    return fetch(`/api/roster?league_id=${LEAGUE_ID}`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.teams || [];
        setTeams(t);
        return t;
      });
  }

  useEffect(() => {
    refreshRoster()
      .then((t) => {
        const grizzlies = t.find((team: Team) => team.name === "Grumpy Grizzlies");
        if (grizzlies) setSelectedTeamId(grizzlies.id);
        else if (t.length > 0) setSelectedTeamId(t[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load saved lineup when team or week changes
  useEffect(() => {
    if (!selectedTeamId) return;
    setLineupLoaded(false);
    const monday = new Date(weekStart + "T12:00:00");
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const end = fmt(sunday);

    fetch(`/api/roster/lineup?team_id=${selectedTeamId}&start_date=${weekStart}&end_date=${end}`)
      .then((r) => r.json())
      .then((data) => {
        const players: { roster_player_id: string }[] = data.players || [];
        if (players.length > 0) {
          setLineupActive(new Set(players.map((p) => p.roster_player_id)));
        } else {
          const team = teams.find((t) => t.id === selectedTeamId);
          if (team) setLineupActive(new Set(team.roster_players.map((p) => p.id)));
        }
        setLineupLoaded(true);
      })
      .catch(() => setLineupLoaded(true));
  }, [selectedTeamId, weekStart, teams]);

  async function updatePosition(playerId: string, newPosition: string) {
    setSavingId(playerId);
    setErrorId(null);
    const newIsPitcher = PITCHER_POSITIONS.includes(newPosition);

    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        roster_players: team.roster_players.map((p) =>
          p.id === playerId
            ? { ...p, primary_position: newPosition, is_pitcher: newIsPitcher }
            : p
        ),
      }))
    );

    try {
      const res = await fetch("/api/roster/player", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playerId, primary_position: newPosition }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setErrorId(playerId);
      refreshRoster();
    } finally {
      setSavingId(null);
    }
  }

  async function dropPlayer(playerId: string, name: string) {
    if (!confirm(`Drop ${name} from the roster?`)) return;
    try {
      const res = await fetch(`/api/roster/player?id=${playerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to drop");
      setTeams((prev) =>
        prev.map((team) => ({
          ...team,
          roster_players: team.roster_players.filter((p) => p.id !== playerId),
        }))
      );
    } catch {
      alert("Failed to drop player");
    }
  }

  function toggleActive(playerId: string) {
    setLineupActive((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function saveLineup() {
    if (!selectedTeamId) return;
    setSavingLineup(true);
    try {
      const res = await fetch("/api/roster/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: selectedTeamId,
          start_date: weekStart,
          active_roster_player_ids: [...lineupActive],
        }),
      });
      if (!res.ok) throw new Error("Failed to save lineup");
      setLineupSavedMsg(true);
      setTimeout(() => setLineupSavedMsg(false), 2500);
    } catch {
      alert("Failed to save lineup");
    } finally {
      setSavingLineup(false);
    }
  }

  async function searchPlayers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/players?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      const results: MLBSearchResult[] = (data.players || []).slice(0, 10);
      setSearchResults(results);
      // Default add position to player's primary position
      const defaults = new Map<number, string>();
      for (const p of results) {
        const pos = p.primaryPosition?.abbreviation || "UTIL";
        defaults.set(p.id, pos);
      }
      setAddPositions(defaults);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addPlayer(mlbPlayer: MLBSearchResult, position: string) {
    if (!selectedTeamId) return;
    setAddingId(mlbPlayer.id);
    const isPitcher = PITCHER_POSITIONS.includes(position);
    try {
      const res = await fetch("/api/roster/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: selectedTeamId,
          mlb_player_id: mlbPlayer.id,
          mlb_player_name: mlbPlayer.fullName,
          mlb_team: mlbPlayer.currentTeam?.abbreviation || mlbPlayer.currentTeam?.name || "TBD",
          primary_position: position,
          is_pitcher: isPitcher,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      await refreshRoster();
    } catch {
      alert("Failed to add player");
    } finally {
      setAddingId(null);
    }
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const players = selectedTeam?.roster_players || [];
  const batters = players.filter((p) => !p.is_pitcher);
  const pitchers = players.filter((p) => p.is_pitcher);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading rosters...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roster Management</h1>
          <p className="text-gray-600 mt-1">
            {players.length}/26 players rostered.{" "}
            <span className="text-green-600 font-medium">Set your active lineup below, then Save.</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={saveLineup}
            disabled={savingLineup || !lineupLoaded}
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {savingLineup ? "Saving..." : lineupSavedMsg ? "Saved!" : "Save Lineup"}
          </button>
        </div>
      </div>

      {lineupLoaded && (
        <p className="text-xs text-gray-500">
          Week of {weekStart} &mdash; {lineupActive.size} of {players.length} players active
        </p>
      )}

      {/* Add Player */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Add Player</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Search MLB players to add to your roster. Two-way players (e.g. Ohtani) can be added
            twice — once as a batter position (DH) and once as SP — to score both contributions.
          </p>
        </div>
        <div className="px-4 py-3">
          <div className="flex gap-2">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPlayers()}
              placeholder="Player name..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button
              onClick={searchPlayers}
              disabled={searching || !searchQuery.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {searchResults.map((p) => {
                const chosenPos = addPositions.get(p.id) || p.primaryPosition?.abbreviation || "UTIL";
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-white hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{p.fullName}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {p.currentTeam?.abbreviation || p.currentTeam?.name || "—"} · MLB pos: {p.primaryPosition?.abbreviation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="text-xs text-gray-500">Add as</label>
                      <select
                        value={chosenPos}
                        onChange={(e) =>
                          setAddPositions((prev) => {
                            const next = new Map(prev);
                            next.set(p.id, e.target.value);
                            return next;
                          })
                        }
                        className={`text-xs font-mono px-2 py-1 rounded border ${positionColor(chosenPos)}`}
                      >
                        {ALL_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => addPlayer(p, chosenPos)}
                        disabled={addingId === p.id}
                        className="text-xs bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800 disabled:opacity-50"
                      >
                        {addingId === p.id ? "Adding..." : "+ Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Batters */}
      <Section title={`Batters (${batters.length})`}>
        <PlayerTable
          players={batters}
          lineupActive={lineupActive}
          savingId={savingId}
          errorId={errorId}
          onToggle={toggleActive}
          onPositionChange={updatePosition}
          onDrop={dropPlayer}
        />
      </Section>

      {/* Pitchers */}
      <Section title={`Pitchers (${pitchers.length})`}>
        <PlayerTable
          players={pitchers}
          lineupActive={lineupActive}
          savingId={savingId}
          errorId={errorId}
          onToggle={toggleActive}
          onPositionChange={updatePosition}
          onDrop={dropPlayer}
        />
      </Section>
    </div>
  );
}

function PlayerTable({
  players,
  lineupActive,
  savingId,
  errorId,
  onToggle,
  onPositionChange,
  onDrop,
}: {
  players: RosterPlayer[];
  lineupActive: Set<string>;
  savingId: string | null;
  errorId: string | null;
  onToggle: (id: string) => void;
  onPositionChange: (id: string, pos: string) => void;
  onDrop: (id: string, name: string) => void;
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 text-left text-sm text-gray-500">
          <th className="px-4 py-2 font-medium">Active</th>
          <th className="px-4 py-2 font-medium">Pos</th>
          <th className="px-4 py-2 font-medium">Player</th>
          <th className="px-4 py-2 font-medium">Team</th>
          <th className="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {players.map((player) => {
          const isActive = lineupActive.has(player.id);
          return (
            <tr key={player.id} className={isActive ? "" : "opacity-50"}>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggle(player.id)}
                  className="rounded border-gray-300 text-green-600"
                />
              </td>
              <td className="px-4 py-2">
                <select
                  value={player.primary_position}
                  disabled={savingId === player.id}
                  onChange={(e) => onPositionChange(player.id, e.target.value)}
                  className={`text-xs font-mono px-2 py-1 rounded border ${positionColor(player.primary_position)} ${
                    savingId === player.id ? "opacity-50" : ""
                  } ${errorId === player.id ? "border-red-400" : ""}`}
                >
                  {ALL_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2 font-medium">{player.mlb_player_name}</td>
              <td className="px-4 py-2 text-gray-500 font-mono text-sm">{player.mlb_team}</td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => onDrop(player.id, player.mlb_player_name)}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors px-1"
                  title="Drop player"
                >
                  Drop
                </button>
              </td>
            </tr>
          );
        })}
        {players.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-4 text-sm text-gray-400 text-center">None</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

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

const BATTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "UTIL", "DH"];
const PITCHER_POSITIONS = ["SP", "RP"];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
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

  const weekStart = fmt(getMonday(new Date()));

  useEffect(() => {
    fetch("/api/roster?league_id=01756471-3bd1-4e83-8533-093d9e97bb86")
      .then((r) => r.json())
      .then((data) => {
        const t = data.teams || [];
        setTeams(t);
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
          // No saved lineup — default all active
          const team = teams.find((t) => t.id === selectedTeamId);
          if (team) {
            setLineupActive(new Set(team.roster_players.map((p) => p.id)));
          }
        }
        setLineupLoaded(true);
      })
      .catch(() => setLineupLoaded(true));
  }, [selectedTeamId, weekStart, teams]);

  async function updatePosition(playerId: string, newPosition: string) {
    setSavingId(playerId);
    setErrorId(null);

    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        roster_players: team.roster_players.map((p) =>
          p.id === playerId ? { ...p, primary_position: newPosition } : p
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
      fetch("/api/roster?league_id=01756471-3bd1-4e83-8533-093d9e97bb86")
        .then((r) => r.json())
        .then((data) => setTeams(data.teams || []));
    } finally {
      setSavingId(null);
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
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
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

      {/* Batters */}
      <Section title={`Batters (${batters.length})`}>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-500">
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Pos</th>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium">Team</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batters.map((player) => {
              const isActive = lineupActive.has(player.id);
              return (
                <tr key={player.id} className={isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleActive(player.id)}
                      className="rounded border-gray-300 text-green-600"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={player.primary_position}
                      disabled={savingId === player.id}
                      onChange={(e) => updatePosition(player.id, e.target.value)}
                      className={`text-xs font-mono px-2 py-1 rounded border ${
                        player.primary_position === "DH"
                          ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                          : "bg-green-100 text-green-800 border-green-200"
                      } ${savingId === player.id ? "opacity-50" : ""} ${
                        errorId === player.id ? "border-red-400" : ""
                      }`}
                    >
                      {BATTER_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 font-medium">{player.mlb_player_name}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-sm">{player.mlb_team}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Pitchers */}
      <Section title={`Pitchers (${pitchers.length})`}>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-500">
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium">Team</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pitchers.map((player) => {
              const isActive = lineupActive.has(player.id);
              return (
                <tr key={player.id} className={isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleActive(player.id)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={player.primary_position}
                      disabled={savingId === player.id}
                      onChange={(e) => updatePosition(player.id, e.target.value)}
                      className={`text-xs font-mono px-2 py-1 rounded border bg-blue-100 text-blue-800 border-blue-200 ${savingId === player.id ? "opacity-50" : ""} ${errorId === player.id ? "border-red-400" : ""}`}
                    >
                      {PITCHER_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 font-medium">{player.mlb_player_name}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-sm">{player.mlb_team}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
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

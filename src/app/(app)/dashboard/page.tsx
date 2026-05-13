"use client";

import { useState, useEffect, useCallback } from "react";

interface RosterPlayer {
  id: string;
  mlb_player_id: number;
  mlb_player_name: string;
  mlb_team: string;
  primary_position: string;
  is_pitcher: boolean;
}

interface Team {
  id: string;
  name: string;
  owner_user_id: string;
  roster_players: RosterPlayer[];
}

interface SearchResult {
  id: number;
  fullName: string;
  primaryPosition: { abbreviation: string };
  currentTeam?: { abbreviation?: string; name?: string };
}

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadTeams = useCallback(() => {
    fetch("/api/roster?league_id=01756471-3bd1-4e83-8533-093d9e97bb86")
      .then((r) => r.json())
      .then((data) => {
        const t = data.teams || [];
        setTeams(t);
        setSelectedTeamId((prev) => {
          if (prev) return prev;
          const grizzlies = t.find((team: Team) => team.name === "Grumpy Grizzlies");
          return grizzlies?.id || t[0]?.id || "";
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const players = selectedTeam?.roster_players || [];
  const batters = players.filter((p) => p.primary_position !== "SP" && p.primary_position !== "RP");
  const pitchers = players.filter((p) => p.primary_position === "SP" || p.primary_position === "RP");

  // Group batters by position
  const positionOrder = ["C", "1B", "2B", "3B", "SS", "OF", "DH"];
  const sortedBatters = [...batters].sort(
    (a, b) => positionOrder.indexOf(a.primary_position) - positionOrder.indexOf(b.primary_position)
  );
  const sortedPitchers = [...pitchers].sort(
    (a, b) => (a.primary_position === "SP" ? 0 : 1) - (b.primary_position === "SP" ? 0 : 1)
  );

  async function searchPlayers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/players?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.players || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  async function addPlayer(player: SearchResult) {
    if (!selectedTeamId) return;
    setAdding(true);
    const isPitcher = ["SP", "RP", "P"].includes(player.primaryPosition.abbreviation);
    const pos = player.primaryPosition.abbreviation === "P" ? "SP" : player.primaryPosition.abbreviation;

    try {
      const res = await fetch("/api/roster/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: selectedTeamId,
          mlb_player_id: player.id,
          mlb_player_name: player.fullName,
          mlb_team: player.currentTeam?.abbreviation || player.currentTeam?.name || "FA",
          primary_position: pos,
          is_pitcher: isPitcher,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to add player: ${data.error}`);
        setAdding(false);
        return;
      }
      setSearchResults([]);
      setSearchQuery("");
      loadTeams();
    } catch (e) {
      alert(`Failed to add player: ${String(e)}`);
    }
    setAdding(false);
  }

  async function removePlayer(playerId: string) {
    if (!confirm("Remove this player from roster?")) return;
    try {
      const res = await fetch(`/api/roster/player?id=${playerId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to drop player: ${data.error}`);
        return;
      }
      loadTeams();
    } catch (e) {
      alert(`Failed to drop player: ${String(e)}`);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{selectedTeam?.name || "My Team"}</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {players.length}/26
            </span>
          </div>
        </div>
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

      {/* Add Player */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Add Player</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchPlayers()}
            placeholder="Search MLB players by name..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            onClick={searchPlayers}
            disabled={searching}
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 text-sm font-medium"
          >
            {searching ? "..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {searchResults.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {p.primaryPosition.abbreviation}
                  </span>
                  <span className="text-sm font-medium">{p.fullName}</span>
                  <span className="text-xs text-gray-400">
                    {p.currentTeam?.abbreviation || p.currentTeam?.name || "FA"}
                  </span>
                </div>
                <button
                  onClick={() => addPlayer(p)}
                  disabled={adding || players.length >= 26}
                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batters */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold">Batters ({sortedBatters.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2">Pos</th>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2">MLB Team</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedBatters.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="inline-block bg-green-100 text-green-800 text-xs font-mono px-2 py-0.5 rounded w-8 text-center">
                    {p.primary_position}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm font-medium">{p.mlb_player_name}</td>
                <td className="px-4 py-2 text-sm text-gray-400 font-mono">{p.mlb_team}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Drop
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pitchers */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold">Pitchers ({sortedPitchers.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2">MLB Team</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedPitchers.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs font-mono px-2 py-0.5 rounded w-8 text-center">
                    {p.primary_position}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm font-medium">{p.mlb_player_name}</td>
                <td className="px-4 py-2 text-sm text-gray-400 font-mono">{p.mlb_team}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Drop
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

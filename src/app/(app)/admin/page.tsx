"use client";

import { useState, useEffect } from "react";

interface Season {
  id: string;
  name: string;
  season_year: number;
  season_start_date: string;
  settings: {
    display_name?: string;
    archived?: boolean;
    [key: string]: unknown;
  };
  teams: { id: string; name: string; owner_user_id: string; total_points: number }[];
}

export default function AdminPage() {
  const [scoringWeek, setScoringWeek] = useState(2);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [newStartDate, setNewStartDate] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [copyFrom, setCopyFrom] = useState<number | "">("");
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  useEffect(() => {
    loadSeasons();
  }, [showArchived]);

  async function loadSeasons() {
    try {
      const res = await fetch(`/api/seasons?archived=${showArchived}`);
      const data = await res.json();
      setSeasons(data.seasons || []);
    } catch {
      // API not connected yet
    }
  }

  async function seedLeague() {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      setSeedResult(data.message || data.error);
      loadSeasons();
    } catch (e) {
      setSeedResult("Failed to seed: " + String(e));
    }
    setIsSeeding(false);
  }

  async function createSeason() {
    if (!newStartDate) {
      alert("Please set a season start date");
      return;
    }
    setIsCreatingSeason(true);
    try {
      const res = await fetch("/api/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_year: newYear,
          season_start_date: newStartDate,
          display_name: newDisplayName || `${newYear} Season`,
          copy_teams_from_season: copyFrom || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Season ${newYear} created!`);
        setNewDisplayName("");
        loadSeasons();
      }
    } catch (e) {
      alert("Failed: " + String(e));
    }
    setIsCreatingSeason(false);
  }

  async function renameSeason(id: string, displayName: string) {
    await fetch("/api/seasons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, display_name: displayName }),
    });
    setEditingName(null);
    loadSeasons();
  }

  async function toggleArchive(id: string, archived: boolean) {
    const action = archived ? "archive" : "unarchive";
    if (!confirm(`Are you sure you want to ${action} this season?`)) return;
    await fetch("/api/seasons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archived }),
    });
    loadSeasons();
  }

  async function calculateScores() {
    setIsCalculating(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsCalculating(false);
    alert(`Scores calculated for week ${scoringWeek} (demo mode)`);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">League Administration</h1>

      {/* Seed / Init */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Initialize League</h2>
        <p className="text-sm text-gray-600 mb-4">
          Seed the 2026 SLOBS demo league with all 12 teams and sample rosters.
        </p>
        <button
          onClick={seedLeague}
          disabled={isSeeding}
          className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isSeeding ? "Seeding..." : "Seed Demo Season"}
        </button>
        {seedResult && (
          <p className="mt-3 text-sm text-gray-700 bg-gray-50 p-3 rounded">{seedResult}</p>
        )}
      </div>

      {/* Season Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Seasons</h2>
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show archived
          </label>
        </div>

        {/* Existing Seasons */}
        {seasons.length > 0 ? (
          <div className="space-y-3 mb-6">
            {seasons.map((s) => {
              const displayName = s.settings?.display_name || `${s.season_year} Season`;
              const isArchived = !!s.settings?.archived;
              const isEditing = editingName === s.id;

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-lg border ${
                    isArchived ? "bg-gray-100 border-gray-200 opacity-60" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-64"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameSeason(s.id, editNameValue);
                              if (e.key === "Escape") setEditingName(null);
                            }}
                          />
                          <button
                            onClick={() => renameSeason(s.id, editNameValue)}
                            className="text-sm text-green-700 hover:text-green-900 font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingName(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{displayName}</span>
                          {isArchived && (
                            <span className="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded">
                              Archived
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {s.teams?.length || 0} teams &middot; Starts {s.season_start_date} &middot;{" "}
                        <span className="font-mono text-xs">{s.season_year}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingName(s.id);
                            setEditNameValue(displayName);
                          }}
                          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Rename
                        </button>
                      )}
                      <button
                        onClick={() => toggleArchive(s.id, !isArchived)}
                        className={`text-sm px-3 py-1 rounded ${
                          isArchived
                            ? "text-green-700 hover:text-green-900 border border-green-300 hover:bg-green-50"
                            : "text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50"
                        }`}
                      >
                        {isArchived ? "Unarchive" : "Archive"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-6">No seasons found. Seed or create one below.</p>
        )}

        {/* Create New Season */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Create New Season</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season Name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. 2027 Season"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season Start (first Monday)</label>
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Copy Teams From</label>
              <select
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Start fresh</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.season_year}>
                    {s.settings?.display_name || s.season_year} ({s.teams?.length} teams)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={createSeason}
            disabled={isCreatingSeason}
            className="mt-4 bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {isCreatingSeason ? "Creating..." : "Create Season"}
          </button>
        </div>
      </div>

      {/* League Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">League Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">League Name</p>
            <p className="font-medium">SLOBS</p>
          </div>
          <div>
            <p className="text-gray-500">Commissioner</p>
            <p className="font-medium">John Bauer</p>
          </div>
          <div>
            <p className="text-gray-500">Max Roster Size</p>
            <p className="font-medium">26 players</p>
          </div>
          <div>
            <p className="text-gray-500">Roster Lock</p>
            <p className="font-medium">Monday, 12:00 PM PT</p>
          </div>
          <div>
            <p className="text-gray-500">Redraft #1</p>
            <p className="font-medium">May (TBD)</p>
          </div>
          <div>
            <p className="text-gray-500">Redraft #2</p>
            <p className="font-medium">Post All-Star Break (TBD)</p>
          </div>
        </div>
      </div>

      {/* Score Calculation */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Score Calculation</h2>
        <p className="text-sm text-gray-600 mb-4">
          Calculate scores for a specific week by pulling stats from MLB API and applying SLOBS scoring rules.
        </p>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
            <input
              type="number"
              min={1}
              max={26}
              value={scoringWeek}
              onChange={(e) => setScoringWeek(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-sm"
            />
          </div>
          <div className="pt-6">
            <button
              onClick={calculateScores}
              disabled={isCalculating}
              className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {isCalculating ? "Calculating..." : "Calculate Scores"}
            </button>
          </div>
        </div>
      </div>

      {/* Draft Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Draft Management</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Initial Draft</p>
              <p className="text-sm text-gray-500">Pre-season player selection</p>
            </div>
            <button className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors text-sm font-medium">
              Start Draft
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Redraft #1</p>
              <p className="text-sm text-gray-500">Mid-May roster refresh</p>
            </div>
            <button className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed text-sm font-medium">
              Not Yet
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Redraft #2</p>
              <p className="text-sm text-gray-500">Post All-Star Break</p>
            </div>
            <button className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed text-sm font-medium">
              Not Yet
            </button>
          </div>
        </div>
      </div>

      {/* Lineup Lock Override */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Lineup Management</h2>
        <div className="flex items-center gap-4">
          <button className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium">
            Lock All Lineups (Week {scoringWeek})
          </button>
          <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            Unlock All Lineups
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Lineups automatically lock Monday at noon PT. Use these buttons for manual overrides.
        </p>
      </div>

      {/* Short Week Toggle */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Week Settings</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
          <div>
            <span className="font-medium text-sm">Short Week</span>
            <p className="text-xs text-gray-500">
              Mark as short week (3-4 games). Removes hit/runs produced thresholds.
              Position requirement reduced to 1 game.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

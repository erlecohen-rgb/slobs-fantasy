"use client";

import { useState } from "react";

interface AvailablePlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  isPitcher: boolean;
}

const DEMO_AVAILABLE: AvailablePlayer[] = [
  { id: 660271, name: "Shohei Ohtani", team: "LAD", position: "DH", isPitcher: false },
  { id: 592450, name: "Aaron Judge", team: "NYY", position: "RF", isPitcher: false },
  { id: 518692, name: "Freddie Freeman", team: "LAD", position: "1B", isPitcher: false },
  { id: 665489, name: "Bobby Witt Jr.", team: "KC", position: "SS", isPitcher: false },
  { id: 543037, name: "Gerrit Cole", team: "NYY", position: "SP", isPitcher: true },
  { id: 675911, name: "Spencer Strider", team: "ATL", position: "SP", isPitcher: true },
  { id: 681867, name: "Emmanuel Clase", team: "CLE", position: "RP", isPitcher: true },
];

export default function DraftPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [draftActive, setDraftActive] = useState(false);
  const [draftNumber, setDraftNumber] = useState(1);

  const filteredPlayers = DEMO_AVAILABLE.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Draft Room</h1>
          <p className="text-gray-600 mt-1">
            {draftActive
              ? `Draft #${draftNumber} in progress`
              : "No active draft. Commissioner can start one from the Admin page."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={draftNumber}
            onChange={(e) => setDraftNumber(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={1}>Initial Draft</option>
            <option value={2}>Redraft #1 (May)</option>
            <option value={3}>Redraft #2 (Post All-Star)</option>
          </select>
        </div>
      </div>

      {/* Draft Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Draft Status</p>
            <p className="text-lg font-semibold mt-1">
              {draftActive ? "Active - Your Pick!" : "Not Started"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Round</p>
            <p className="text-lg font-semibold mt-1">1 of 26</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Time Remaining</p>
            <p className="text-lg font-semibold mt-1">--:--</p>
          </div>
        </div>
      </div>

      {/* Player Search */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Available Players</h2>
          <div className="mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, team, or position..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500">
                <th className="px-6 py-2 font-medium">Player</th>
                <th className="px-6 py-2 font-medium">Team</th>
                <th className="px-6 py-2 font-medium">Pos</th>
                <th className="px-6 py-2 font-medium">Type</th>
                <th className="px-6 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPlayers.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{player.name}</td>
                  <td className="px-6 py-3 font-mono text-sm text-gray-500">{player.team}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block text-xs font-mono px-2 py-1 rounded ${
                        player.isPitcher
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {player.position}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {player.isPitcher ? "Pitcher" : "Batter"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      disabled={!draftActive}
                      className="bg-green-700 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Draft
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draft History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Draft History</h2>
        </div>
        <div className="px-6 py-4 text-gray-500 text-sm">
          Draft picks will appear here once a draft is started.
        </div>
      </div>
    </div>
  );
}

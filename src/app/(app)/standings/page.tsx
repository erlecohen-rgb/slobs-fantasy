"use client";

import { useState, useEffect } from "react";

interface Team {
  id: string;
  name: string;
  total_points: number;
}

export default function StandingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/roster?league_id=01756471-3bd1-4e83-8533-093d9e97bb86")
      .then((r) => r.json())
      .then((data) => {
        const t = (data.teams || []).sort((a: Team, b: Team) => b.total_points - a.total_points);
        setTeams(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Standings</h1>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">2026 Season</h2>
        </div>
        {loading ? (
          <div className="px-6 py-4 text-gray-500 text-sm">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">#</th>
                <th className="px-6 py-3 font-medium">Team</th>
                <th className="px-6 py-3 font-medium text-right">Total Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teams.map((team, i) => (
                <tr key={team.id}>
                  <td className="px-6 py-3 font-mono text-sm text-gray-400">{i + 1}</td>
                  <td className="px-6 py-3 font-medium">{team.name}</td>
                  <td className="px-6 py-3 text-right font-mono text-gray-400">
                    {team.total_points === 0 ? "-" : team.total_points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && teams.length > 0 && teams.every((t) => t.total_points === 0) && (
          <div className="px-6 py-4 text-sm text-gray-400 border-t border-gray-100">
            No scores recorded yet. Standings will update as weekly scores are calculated.
          </div>
        )}
      </div>
    </div>
  );
}

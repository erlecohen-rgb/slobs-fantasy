// Run with: node scripts/resolve-gladhanders.mjs
// Looks up each Glad Handers player in the MLB Stats API and prints UPDATE SQL

const TEAM_ID = '150fe443-7575-4415-95cb-4a974bc0d1e1';

const players = [
  { name: 'Rutschman, A',  search: 'Rutschman' },
  { name: 'Alvarez, F',    search: 'Francisco Alvarez' },
  { name: 'Freeman, F',    search: 'Freddie Freeman' },
  { name: 'Busch, M',      search: 'Michael Busch' },
  { name: 'Marte, K',      search: 'Ketel Marte' },
  { name: 'Lowe, B',       search: 'Brandon Lowe' },
  { name: 'Caminero, J',   search: 'Junior Caminero' },
  { name: 'Paredes, I',    search: 'Isaac Paredes' },
  { name: 'Betts, M',      search: 'Mookie Betts' },
  { name: 'Swanson, D',    search: 'Dansby Swanson' },
  { name: 'Chourio, J',    search: 'Jackson Chourio' },
  { name: 'Wood, J',       search: 'James Wood' },
  { name: 'Hernandez, T',  search: 'Teoscar Hernandez' },
  { name: 'Barger, A',     search: 'Addison Barger' },
  { name: 'Yelich, C',     search: 'Yelich' },
  { name: 'Crochet, G',    search: 'Garrett Crochet' },
  { name: 'deGrom, J',     search: 'deGrom' },
  { name: 'Kirby, G',      search: 'George Kirby' },
  { name: 'Ryan, J',       search: 'Joe Ryan' },
  { name: 'Glasnow, T',    search: 'Glasnow' },
  { name: 'Burns, C',      search: 'Corbin Burns' },
  { name: 'Imanaga, S',    search: 'Imanaga' },
  { name: 'Woodruff, B',   search: 'Brandon Woodruff' },
  { name: 'Munoz, A',      search: 'Andres Munoz' },
  { name: 'Megill, T',     search: 'Trevor Megill' },
  { name: 'Uribe, A',      search: 'Abner Uribe' },
];

async function searchPlayer(query) {
  const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(query)}&sportId=1&active=true&hydrate=currentTeam`;
  const res = await fetch(url);
  const data = await res.json();
  return data.people || [];
}

const sql = [];
const warnings = [];

for (const player of players) {
  const results = await searchPlayer(player.search);

  if (results.length === 0) {
    warnings.push(`-- ⚠️  No results for "${player.name}" (searched: "${player.search}")`);
    sql.push(`-- UPDATE roster_players SET mlb_player_id = ???, mlb_team = '???' WHERE team_id = '${TEAM_ID}' AND mlb_player_name = '${player.name}';`);
    continue;
  }

  const match = results[0];
  const team = match.currentTeam?.abbreviation || 'UNK';
  const id = match.id;
  const fullName = match.fullName;

  if (results.length > 1) {
    warnings.push(`-- ℹ️  Multiple matches for "${player.name}" — using first: ${fullName} (${id}, ${team}). Others: ${results.slice(1).map(p => p.fullName).join(', ')}`);
  }

  sql.push(`UPDATE roster_players SET mlb_player_id = ${id}, mlb_team = '${team}' WHERE team_id = '${TEAM_ID}' AND mlb_player_name = '${player.name}'; -- ${fullName}`);
}

console.log('-- Glad Handers MLB ID Resolution');
console.log('-- Generated', new Date().toISOString());
console.log('');
if (warnings.length) {
  warnings.forEach(w => console.log(w));
  console.log('');
}
sql.forEach(s => console.log(s));

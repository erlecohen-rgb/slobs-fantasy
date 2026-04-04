-- SLOBS Fantasy Baseball - Supabase Schema
-- Run this in the Supabase SQL editor to set up the database

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Leagues
create table leagues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  season_year integer not null,
  season_start_date date not null,
  commissioner_user_id text not null, -- Clerk user ID
  settings jsonb not null default '{
    "max_roster_size": 26,
    "active_batters": 13,
    "active_pitchers_sp": 4,
    "active_pitchers_rp": 4,
    "roster_lock_day": "monday",
    "roster_lock_hour": 12,
    "roster_lock_timezone": "America/Los_Angeles",
    "redraft_dates": []
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- Teams
create table teams (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  owner_user_id text not null, -- Clerk user ID
  name text not null,
  total_points integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_teams_league on teams(league_id);
create index idx_teams_owner on teams(owner_user_id);

-- Roster Players (all players on a team's full roster)
create table roster_players (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  mlb_player_id integer not null,
  mlb_player_name text not null,
  mlb_team text not null,
  primary_position text not null,
  is_pitcher boolean not null default false,
  drafted_at timestamptz not null default now(),
  dropped_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_roster_team on roster_players(team_id);
create index idx_roster_mlb_player on roster_players(mlb_player_id);

-- Weekly Lineups (which players are activated each week and at what position)
create table weekly_lineups (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  week_number integer not null,
  season_year integer not null,
  roster_player_id uuid not null references roster_players(id),
  mlb_player_id integer not null,
  activated_position text not null,
  is_active boolean not null default true,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(team_id, week_number, season_year, roster_player_id)
);

create index idx_lineup_team_week on weekly_lineups(team_id, week_number, season_year);

-- Weekly Scores (calculated scores per player per week)
create table weekly_scores (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  week_number integer not null,
  season_year integer not null,
  roster_player_id uuid not null references roster_players(id),
  mlb_player_id integer not null,
  mlb_player_name text not null,
  points integer not null default 0,
  qualified boolean not null default true,
  breakdown jsonb not null default '[]'::jsonb,
  stats_raw jsonb not null default '{}'::jsonb,
  is_pitcher boolean not null default false,
  created_at timestamptz not null default now(),
  unique(team_id, week_number, season_year, roster_player_id)
);

create index idx_scores_team_week on weekly_scores(team_id, week_number, season_year);

-- Special Awards
create table special_awards (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  week_number integer not null,
  season_year integer not null,
  mlb_player_id integer not null,
  mlb_player_name text not null,
  award_name text not null,
  description text not null,
  payout_per_team numeric not null, -- positive = collect, negative = pay
  game_date date,
  created_at timestamptz not null default now()
);

create index idx_awards_team on special_awards(team_id);

-- Draft Picks
create table draft_picks (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  mlb_player_id integer not null,
  mlb_player_name text not null,
  round_number integer not null,
  pick_number integer not null,
  draft_number integer not null default 1, -- 1=initial, 2=redraft 1, 3=redraft 2
  created_at timestamptz not null default now()
);

create index idx_draft_league on draft_picks(league_id, draft_number);

-- Row Level Security (RLS)
alter table leagues enable row level security;
alter table teams enable row level security;
alter table roster_players enable row level security;
alter table weekly_lineups enable row level security;
alter table weekly_scores enable row level security;
alter table special_awards enable row level security;
alter table draft_picks enable row level security;

-- For now, allow all authenticated users to read everything in their league
-- and write to their own team. We'll tighten this up later.

-- Everyone can read leagues
create policy "Anyone can read leagues" on leagues for select using (true);

-- Everyone can read teams in their league
create policy "Anyone can read teams" on teams for select using (true);

-- Team owners can update their team
create policy "Owners can update teams" on teams for update using (true);

-- Everyone can read rosters
create policy "Anyone can read rosters" on roster_players for select using (true);

-- Everyone can read lineups
create policy "Anyone can read lineups" on weekly_lineups for select using (true);

-- Everyone can read scores
create policy "Anyone can read scores" on weekly_scores for select using (true);

-- Everyone can read awards
create policy "Anyone can read awards" on special_awards for select using (true);

-- Everyone can read draft picks
create policy "Anyone can read drafts" on draft_picks for select using (true);

-- Insert/update policies (service role will handle most writes via API)
create policy "Service can insert all" on leagues for insert with check (true);
create policy "Service can insert teams" on teams for insert with check (true);
create policy "Service can insert roster" on roster_players for insert with check (true);
create policy "Service can update roster" on roster_players for update using (true);
create policy "Service can insert lineups" on weekly_lineups for insert with check (true);
create policy "Service can update lineups" on weekly_lineups for update using (true);
create policy "Service can insert scores" on weekly_scores for insert with check (true);
create policy "Service can update scores" on weekly_scores for update using (true);
create policy "Service can insert awards" on special_awards for insert with check (true);
create policy "Service can insert drafts" on draft_picks for insert with check (true);

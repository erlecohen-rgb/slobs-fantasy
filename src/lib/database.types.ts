// Supabase Database Types for SLOBS Fantasy Baseball

export interface Database {
  public: {
    Tables: {
      leagues: {
        Row: League;
        Insert: Omit<League, "id" | "created_at">;
        Update: Partial<Omit<League, "id">>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, "id" | "created_at" | "total_points">;
        Update: Partial<Omit<Team, "id">>;
      };
      roster_players: {
        Row: RosterPlayer;
        Insert: Omit<RosterPlayer, "id" | "created_at">;
        Update: Partial<Omit<RosterPlayer, "id">>;
      };
      weekly_lineups: {
        Row: WeeklyLineup;
        Insert: Omit<WeeklyLineup, "id" | "created_at">;
        Update: Partial<Omit<WeeklyLineup, "id">>;
      };
      weekly_scores: {
        Row: WeeklyScore;
        Insert: Omit<WeeklyScore, "id" | "created_at">;
        Update: Partial<Omit<WeeklyScore, "id">>;
      };
      special_awards: {
        Row: SpecialAwardRecord;
        Insert: Omit<SpecialAwardRecord, "id" | "created_at">;
        Update: Partial<Omit<SpecialAwardRecord, "id">>;
      };
      draft_picks: {
        Row: DraftPick;
        Insert: Omit<DraftPick, "id" | "created_at">;
        Update: Partial<Omit<DraftPick, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export interface League {
  id: string;
  name: string;
  season_year: number;
  season_start_date: string; // first Monday of scoring
  commissioner_user_id: string;
  settings: LeagueSettings;
  created_at: string;
}

export interface LeagueSettings {
  max_roster_size: number; // 26
  active_batters: number;
  active_pitchers_sp: number;
  active_pitchers_rp: number;
  roster_lock_day: string; // "monday"
  roster_lock_hour: number; // 12 (noon)
  roster_lock_timezone: string; // "America/Los_Angeles"
  redraft_dates: string[]; // dates when redrafts happen
}

export interface Team {
  id: string;
  league_id: string;
  owner_user_id: string;
  name: string;
  total_points: number;
  created_at: string;
}

export interface RosterPlayer {
  id: string;
  team_id: string;
  mlb_player_id: number;
  mlb_player_name: string;
  mlb_team: string;
  primary_position: string;
  is_pitcher: boolean;
  drafted_at: string;
  dropped_at: string | null;
  created_at: string;
}

export interface WeeklyLineup {
  id: string;
  team_id: string;
  week_number: number;
  season_year: number;
  roster_player_id: string;
  mlb_player_id: number;
  activated_position: string; // position they're activated at for the week
  is_active: boolean; // on the active lineup vs bench
  locked: boolean; // true after deadline
  created_at: string;
}

export interface WeeklyScore {
  id: string;
  team_id: string;
  week_number: number;
  season_year: number;
  roster_player_id: string;
  mlb_player_id: number;
  mlb_player_name: string;
  points: number;
  qualified: boolean;
  breakdown: Record<string, unknown>; // JSON scoring breakdown
  stats_raw: Record<string, unknown>; // raw MLB stats
  is_pitcher: boolean;
  created_at: string;
}

export interface SpecialAwardRecord {
  id: string;
  team_id: string;
  week_number: number;
  season_year: number;
  mlb_player_id: number;
  mlb_player_name: string;
  award_name: string;
  description: string;
  payout_per_team: number;
  game_date: string | null;
  created_at: string;
}

export interface DraftPick {
  id: string;
  league_id: string;
  team_id: string;
  mlb_player_id: number;
  mlb_player_name: string;
  round_number: number;
  pick_number: number;
  draft_number: number; // 1 = initial, 2 = first redraft, 3 = second redraft
  created_at: string;
}

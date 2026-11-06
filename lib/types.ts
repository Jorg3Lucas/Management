export type Role = "ADMIN" | "USER";

/** Papel do usuário dentro de um servidor específico. */
export type ServerRole = "owner" | "editor" | "viewer";

export type ClanStance = "ally" | "neutral" | "enemy";

export type ClanRow = {
  id: number;
  name: string;
  name_key: string;
  created_at: string;
};

export type ServerRow = {
  id: number;
  code: string;
  label: string;
  group_name: string;
  worldgroup_id: number;
  world_id: number;
  is_focus: number;
  sync_enabled: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  created_at: string;
};

export type CharacterRow = {
  id: number;
  server_id: number;
  name: string;
  clan: string | null;
  clan_id: number | null;
  /** Time individual; quando nulo, o time vem do clã. */
  team_id: number | null;
  class_name: string | null;
  level: number | null;
  power_score: number;
  peak_power: number;
  peak_power_at: string | null;
  rank_position: number | null;
  notes: string | null;
  sync_locked: number;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CharacterWithServer = CharacterRow & {
  server_code: string;
  server_label: string;
  group_name: string;
};

export type WarSessionRow = {
  id: number;
  character_id: number;
  server_id: number;
  war_type: string;
  opponent: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  source: string;
  created_by: number | null;
  created_at: string;
};

export type WarSessionWithNames = WarSessionRow & {
  character_name: string;
  home_server_code: string;
  home_server_label: string;
  war_server_code: string;
  war_server_label: string;
};

export type PowerHistoryRow = {
  id: number;
  character_id: number;
  power_score: number;
  rank_position: number | null;
  source: string;
  captured_at: string;
};

export type SyncRunRow = {
  id: number;
  server_id: number | null;
  status: string;
  source: string;
  rows_fetched: number;
  rows_created: number;
  rows_updated: number;
  message: string | null;
  started_at: string;
  finished_at: string;
};

export type UserRow = {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  active: number;
  created_at: string;
};

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
};

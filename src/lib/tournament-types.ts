import type { AuctionType } from "./game-types";

// ─── Tournament Player ──────────────────────────────────────────────────────
export interface TournamentPlayer {
  id: string;
  name: string;
  /** active = لا يزال في البطولة | eliminated = خرج | bye = جولة راحة | spectating = يتفرج */
  status: "active" | "eliminated" | "bye" | "spectating";
  wins: number;
  losses: number;
  /** كود الغرفة الحالية التي يلعب فيها */
  current_room: string | null;
}

// ─── Bracket Match ──────────────────────────────────────────────────────────
export interface BracketMatch {
  id: string;             // uuid فريد
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  winner_id: string | null;
  winner_name: string | null;
  room_code: string | null;
  state: "pending" | "active" | "done";
}

// ─── Bracket Round ─────────────────────────────────────────────────────────
export interface BracketRound {
  round: number;
  matches: BracketMatch[];
  /** اللاعب الحاصل على bye في هذه الجولة (عند عدد فردي) */
  bye_player_id: string | null;
  bye_player_name: string | null;
}

// ─── Tournament Document ───────────────────────────────────────────────────
export interface TournamentRow {
  /** كود الدوري (6 أحرف) */
  id: string;
  /** اسم الدوري */
  name: string;
  /** منشئ الدوري */
  host_id: string;
  host_name: string;
  mode: "5" | "11";
  auction_type: AuctionType;
  /** lobby = ينتظر لاعبين | active = يلعب | finished = انتهى */
  state: "lobby" | "active" | "finished";
  players: TournamentPlayer[];
  bracket: BracketRound[];
  current_round: number;
  champion_id: string | null;
  champion_name: string | null;
  created_at: string;
  updated_at: string | null;
}

// ─── Spectator Target ──────────────────────────────────────────────────────
/** لاختيار المباراة التي يريد المشاهد متابعتها */
export interface SpectatorTarget {
  room_code: string;
  player1_name: string;
  player2_name: string;
}

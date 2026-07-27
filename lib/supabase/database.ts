// ============================================================
// Supabase 数据库类型定义
// 对应 supabase-schema.sql 中的表结构
// ============================================================

export interface GameRow {
  id: string;
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  mode: 'classic' | 'advanced';
  config: Record<string, unknown>;
  current_phase: string;
  current_player_index: number;
  stocks_bought_this_turn: number;
  pending_hotel_founding: Record<string, unknown> | null;
  pending_acquirer_choice: Record<string, unknown> | null;
  active_mergers: Record<string, unknown>[];
  created_at: string;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  user_id: string | null;
  display_name: string;
  cash: number;
  turn_order: number;
  is_connected: boolean;
  stocks: { hotelId: string; quantity: number }[];
  hand_tile_ids: string[];
  created_at: string;
}

export interface TileRow {
  id: string;
  game_id: string;
  row_num: number;
  col_num: number;
  label: string;
  placed: boolean;
  hotel_id: string | null;
  placed_by: string | null;
}

export interface HotelRow {
  id: string;
  game_id: string;
  name: string;
  tier: string;
  color: string;
  size: number;
  is_safe: boolean;
  is_active: boolean;
  remaining_stocks: number;
  stock_price: number;
}

export interface GameLogRow {
  id: string;
  game_id: string;
  player_id: string | null;
  action: string;
  description: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Database {
  tables: {
    games: GameRow;
    players: PlayerRow;
    tiles: TileRow;
    hotels: HotelRow;
    game_log: GameLogRow;
  };
}

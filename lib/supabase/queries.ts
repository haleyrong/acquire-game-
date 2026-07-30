import { supabase } from './client';
import type { GameRow, PlayerRow, TileRow, HotelRow, GameLogRow } from './database';
import { classicConfig } from '@/lib/config/classic';
import { getStockPrice } from '@/lib/config/classic';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createOnlineGame(
  playerName: string,
  mode: string = 'classic'
): Promise<{ code: string; gameId: string; playerId: string } | null> {
  const code = generateCode();

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .insert({
      code,
      status: 'waiting',
      mode,
      config: classicConfig,
      current_phase: 'place_tile',
      current_player_index: 0,
    })
    .select('id')
    .single();

  if (gameErr || !game) {
    console.error('创建游戏失败', gameErr);
    return null;
  }

  const gameId = game.id;

  const { data: player, error: playerErr } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      user_id: null,
      display_name: playerName,
      cash: classicConfig.startingCash,
      turn_order: 0,
      is_connected: true,
      stocks: [],
      hand_tile_ids: [],
    })
    .select('id')
    .single();

  if (playerErr || !player) {
    console.error('创建玩家失败', playerErr);
    return null;
  }

  return { code, gameId, playerId: player.id };
}

export async function joinOnlineGame(
  code: string,
  playerName: string
): Promise<{ gameId: string; playerId: string } | null> {

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (gameErr || !game) {
    console.error('游戏不存在', gameErr);
    return null;
  }

  const gameId = game.id;

  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .eq('display_name', playerName)
    .maybeSingle();

  if (existing) {
    return { gameId, playerId: existing.id };
  }

  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId);

  const turnOrder = (count ?? 0);

  const { data: player, error: playerErr } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      user_id: null,
      display_name: playerName,
      cash: classicConfig.startingCash,
      turn_order: turnOrder,
      is_connected: true,
      stocks: [],
      hand_tile_ids: [],
    })
    .select('id')
    .single();

  if (playerErr || !player) {
    console.error('加入失败', playerErr);
    return null;
  }

  return { gameId, playerId: player.id };
}

export async function startOnlineGame(gameId: string): Promise<{ success: boolean; error?: string }> {
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameErr || !game) return { success: false, error: `游戏不存在: ${gameErr?.message}` };

  const config = classicConfig;

  // 初始化108块板块
  const tiles: Omit<TileRow, 'id'>[] = [];
  for (let row = 1; row <= 9; row++) {
    for (let col = 1; col <= 12; col++) {
      tiles.push({
        game_id: gameId,
        row_num: row,
        col_num: col,
        label: `${col}${String.fromCharCode(64 + row)}`,
        placed: false,
        hotel_id: null,
        placed_by: null,
      });
    }
  }

  // 初始化7家酒店
  const hotels: Omit<HotelRow, 'id'>[] = config.hotels.map((hc) => ({
    game_id: gameId,
    name: hc.name,
    tier: hc.tier,
    color: hc.color,
    size: 0,
    is_safe: false,
    is_active: false,
    remaining_stocks: config.stocksPerHotel,
    stock_price: getStockPrice(hc.tier, 2),
  }));

  // 获取所有玩家
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('game_id', gameId)
    .order('turn_order');

  if (!players || players.length < 1) {
    return { success: false, error: '没有玩家' };
  }

  // 批量插入板块
  const { error: tilesErr } = await supabase.from('tiles').insert(tiles);
  if (tilesErr) {
    console.error('初始化板块失败', tilesErr);
    return { success: false, error: `板块初始化失败: ${tilesErr.message}` };
  }

  // 批量插入酒店
  const { error: hotelsErr } = await supabase.from('hotels').insert(hotels);
  if (hotelsErr) {
    console.error('初始化酒店失败', hotelsErr);
    return { success: false, error: `酒店初始化失败: ${hotelsErr.message}` };
  }

  // 发牌：获取所有板块ID，洗牌，每人发6张
  const { data: allTiles } = await supabase
    .from('tiles')
    .select('id')
    .eq('game_id', gameId);

  if (!allTiles || allTiles.length < 6 * players.length) {
    return { success: false, error: '板块数据异常' };
  }

  const shuffled = [...allTiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let p = 0; p < players.length; p++) {
    const handIds = shuffled.slice(p * 6, p * 6 + 6).map((t) => t.id);
    await supabase
      .from('players')
      .update({ hand_tile_ids: handIds })
      .eq('id', players[p].id);
  }

  // 更新游戏状态
  const { error: updateErr } = await supabase
    .from('games')
    .update({
      status: 'playing',
      current_phase: 'place_tile',
      current_player_index: 0,
    })
    .eq('id', gameId);

  if (updateErr) {
    console.error('更新游戏状态失败', updateErr);
    return { success: false, error: `状态更新失败: ${updateErr.message}` };
  }

  // 记录日志
  await supabase.from('game_log').insert({
    game_id: gameId,
    player_id: null,
    action: 'GAME_START',
    description: `游戏开始！${players.length} 位玩家加入`,
    payload: { player_count: players.length },
  });

  return { success: true };
}

export async function writeGameLog(
  gameId: string,
  playerId: string | null,
  action: string,
  description: string,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  const { error } = await supabase.from('game_log').insert({
    game_id: gameId,
    player_id: playerId,
    action,
    description,
    payload,
  });
  if (error) {
    console.error('写入日志失败', error);
    return false;
  }
  return true;
}

export async function updateGame(gameId: string, updates: Partial<GameRow>): Promise<boolean> {
  const { error } = await supabase.from('games').update(updates).eq('id', gameId);
  if (error) { console.error('更新游戏失败', error); return false; }
  return true;
}

export async function updatePlayer(
  playerId: string,
  updates: Partial<PlayerRow>
): Promise<boolean> {
  const { error } = await supabase.from('players').update(updates).eq('id', playerId);
  if (error) { console.error('更新玩家失败', error); return false; }
  return true;
}

export async function updateTile(tileId: string, updates: Partial<TileRow>): Promise<boolean> {
  const { error } = await supabase.from('tiles').update(updates).eq('id', tileId);
  if (error) { console.error('更新板块失败', error); return false; }
  return true;
}

export async function updateHotel(
  hotelId: string,
  updates: Partial<HotelRow>
): Promise<boolean> {
  const { error } = await supabase.from('hotels').update(updates).eq('id', hotelId);
  if (error) { console.error('更新酒店失败', error); return false; }
  return true;
}

export function subscribeToGameLog(
  gameId: string,
  onInsert: (log: GameLogRow) => void
): () => void {
  const channel = supabase
    .channel(`game_log:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'game_log',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        onInsert(payload.new as GameLogRow);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToGame(
  gameId: string,
  onUpdate: (game: GameRow) => void
): () => void {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        onUpdate(payload.new as GameRow);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

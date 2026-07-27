// ============================================================
// 联网游戏状态管理 (Zustand)
// 在本地 GameEngine 之上封装 Supabase 同步
// ============================================================

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { GameState } from '@/lib/engine/types';
import {
  createGame,
  placeTile,
  foundHotel,
  chooseAcquirer,
  buyStock,
  completeStockBuying,
  makeMergerDecision,
  finishMergerDecisions,
  declareGameEnd,
  getCurrentPlayer,
  type PlaceTileResult,
  type BuyStockResult,
} from '@/lib/engine/GameEngine';
import { classicConfig } from '@/lib/config/classic';
import {
  writeGameLog,
  updateGame,
  updatePlayer,
  updateTile,
  updateHotel,
  subscribeToGameLog,
} from '@/lib/supabase/queries';
import type { GameLogRow } from '@/lib/supabase/database';

interface OnlineGameStore {
  // 状态
  gameState: GameState | null;
  localPlayerId: string;
  gameCode: string;
  gameId: string;
  selectedTileId: string | null;
  message: string | null;
  devMode: boolean;
  isLoading: boolean;
  unsubscribes: (() => void)[];

  // 初始化
  initFromDB: (code: string, pid: string) => Promise<boolean>;
  cleanup: () => void;

  // 操作
  toggleDevMode: () => void;
  selectTile: (tileId: string) => void;
  confirmPlaceTile: () => PlaceTileResult | null;
  confirmFoundHotel: (hotelId: string) => boolean;
  confirmAcquirerChoice: (hotelId: string) => boolean;
  confirmBuyStock: (hotelId: string, quantity: number) => BuyStockResult | null;
  finishBuying: () => void;
  confirmMergerDecision: (
    mergerIndex: number,
    playerId: string,
    decision: 'sell' | 'trade' | 'hold',
    quantity: number
  ) => { success: boolean; error?: string };
  finishMergers: () => void;
  declareEnd: () => boolean;
  clearMessage: () => void;
  resetGame: () => void;
}

export const useOnlineGameStore = create<OnlineGameStore>((set, get) => ({
  gameState: null,
  localPlayerId: '',
  gameCode: '',
  gameId: '',
  selectedTileId: null,
  message: null,
  devMode: false,
  isLoading: true,
  unsubscribes: [],

  initFromDB: async (code: string, pid: string) => {
    set({ isLoading: true, gameCode: code, localPlayerId: pid });

    // 从 Supabase 获取游戏
    const { data: gameData, error: gameErr } = await supabase
      .from('games')
      .select('id, config, status, current_phase, current_player_index, stocks_bought_this_turn, pending_hotel_founding, pending_acquirer_choice, active_mergers')
      .eq('code', code.toUpperCase())
      .single();

    if (gameErr || !gameData) {
      console.error('游戏不存在', gameErr);
      set({ isLoading: false });
      return false;
    }

    const gameId = gameData.id;

    // 获取玩家
    const { data: playerRows } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('turn_order');

    // 获取板块
    const { data: tileRows } = await supabase
      .from('tiles')
      .select('*')
      .eq('game_id', gameId);

    // 获取酒店
    const { data: hotelRows } = await supabase
      .from('hotels')
      .select('*')
      .eq('game_id', gameId);

    if (!playerRows || !tileRows || !hotelRows || playerRows.length < 2) {
      console.error('游戏数据不完整');
      set({ isLoading: false });
      return false;
    }

    // 用本地引擎创建初始状态
    const playerNames = playerRows.map((p: { display_name: string }) => p.display_name);
    const config = { ...classicConfig, ...((gameData as Record<string, unknown>).config as Record<string, unknown> || {}) };
    let state = createGame(gameId, config, playerNames);

    // 用数据库数据覆盖
    // 玩家
    for (const pr of playerRows) {
      const localPlayer = state.players[state.playerOrder[pr.turn_order]];
      if (localPlayer) {
        localPlayer.id = pr.id;
        localPlayer.name = pr.display_name;
        localPlayer.cash = pr.cash;
        localPlayer.stocks = pr.stocks || [];
        localPlayer.handTileIds = pr.hand_tile_ids || [];
      }
    }

    // 板块
    for (const tr of tileRows) {
      const localTile = Object.values(state.tiles).find(
        (t) => t.position.row === tr.row_num && t.position.col === tr.col_num
      );
      if (localTile) {
        localTile.id = tr.id;
        localTile.placed = tr.placed;
        localTile.hotelId = tr.hotel_id;
        localTile.placedBy = tr.placed_by;
      }
    }

    // 酒店
    for (const hr of hotelRows) {
      const localHotel = Object.values(state.hotels).find((h) => h.name === hr.name);
      if (localHotel) {
        localHotel.id = hr.id;
        localHotel.size = hr.size;
        localHotel.isSafe = hr.is_safe;
        localHotel.isActive = hr.is_active;
        localHotel.remainingStocks = hr.remaining_stocks;
        localHotel.stockPrice = hr.stock_price;
      }
    }

    // 恢复阶段状态（使用 any 绕过严格类型检查）
    const gd = gameData as Record<string, unknown>;
    state.currentPlayerIndex = (gd.current_player_index as number) || 0;
    state.phase = (gd.current_phase as GameState['phase']) || 'place_tile';
    state.stocksBoughtThisTurn = (gd.stocks_bought_this_turn as number) || 0;

    if (gd.status === 'finished') {
      state.status = 'finished';
      state.phase = 'game_over';
    }

    // 订阅实时更新
    const unsub = subscribeToGameLog(gameId, (log: GameLogRow) => {
      // 忽略自己的操作（本地已经执行过了）
      // 简单处理：如果是本地玩家发起的操作，跳过
      if (log.player_id === pid) return;

      // 远程操作 → 在本地 engine 重放
      handleRemoteLog(get(), log);
      set({ gameState: { ...get().gameState! } });
    });

    set({
      gameState: state,
      gameId,
      isLoading: false,
      unsubscribes: [unsub],
    });

    return true;
  },

  cleanup: () => {
    const { unsubscribes } = get();
    unsubscribes.forEach((fn) => fn());
    set({ unsubscribes: [] });
  },

  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),

  selectTile: (tileId: string) => {
    const { gameState, devMode } = get();
    if (!gameState) return;

    if (devMode) {
      const tile = gameState.tiles[tileId];
      if (!tile || tile.placed) return;
      set({ selectedTileId: tileId });
      return;
    }

    if (gameState.phase !== 'place_tile') return;
    const player = getCurrentPlayer(gameState);
    if (!player.handTileIds.includes(tileId)) return;
    set({ selectedTileId: tileId });
  },

  confirmPlaceTile: () => {
    const { gameState, selectedTileId, localPlayerId, gameId, devMode } = get();
    if (!gameState || !selectedTileId) return null;

    const player = getCurrentPlayer(gameState);

    // 检查是否是自己回合
    if (player.id !== localPlayerId && !devMode) return null;

    if (devMode && !player.handTileIds.includes(selectedTileId)) {
      player.handTileIds.push(selectedTileId);
    }

    const result = placeTile(gameState, selectedTileId);
    if (!result.success) {
      set({ message: result.error || '放置失败' });
      return result;
    }

    // 同步到 Supabase
    const tile = gameState.tiles[selectedTileId];
    const hotelId = tile.hotelId;

    // 写日志
    writeGameLog(gameId, localPlayerId, 'PLACE_TILE',
      `${player.name} 在 ${tile.label} 放置板块`,
      { tileId: selectedTileId, event: result.event }
    );

    // 更新板块
    updateTile(selectedTileId, { placed: true, hotel_id: hotelId, placed_by: localPlayerId });

    // 更新手牌
    updatePlayer(localPlayerId, { hand_tile_ids: player.handTileIds });

    // 更新游戏阶段
    updateGame(gameId, {
      current_phase: gameState.phase,
      current_player_index: gameState.currentPlayerIndex,
      stocks_bought_this_turn: gameState.stocksBoughtThisTurn,
    });

    set({ gameState: { ...gameState }, selectedTileId: null });
    return result;
  },

  confirmFoundHotel: (hotelId: string) => {
    const { gameState, localPlayerId, gameId } = get();
    if (!gameState || gameState.phase !== 'choose_hotel') return false;

    const result = foundHotel(gameState, hotelId);
    if (!result) return false;

    const player = getCurrentPlayer(gameState);

    // 同步
    writeGameLog(gameId, localPlayerId, 'FOUND_HOTEL',
      `${player.name} 创立了 ${gameState.hotels[hotelId]?.name}`,
      { hotelId }
    );

    // 更新酒店
    const hotel = gameState.hotels[hotelId];
    updateHotel(hotelId, {
      is_active: true,
      size: hotel.size,
      stock_price: hotel.stockPrice,
      remaining_stocks: hotel.remainingStocks,
    });

    // 更新玩家手牌和股票
    updatePlayer(localPlayerId, {
      hand_tile_ids: player.handTileIds,
      stocks: player.stocks,
    });

    // 更新游戏阶段
    updateGame(gameId, {
      current_phase: gameState.phase,
      pending_hotel_founding: null,
    });

    set({ gameState: { ...gameState } });
    return true;
  },

  confirmAcquirerChoice: (hotelId: string) => {
    const { gameState, localPlayerId, gameId } = get();
    if (!gameState || gameState.phase !== 'choose_acquirer') return false;

    const result = chooseAcquirer(gameState, hotelId);
    if (!result) return false;

    writeGameLog(gameId, localPlayerId, 'CHOOSE_ACQUIRER',
      `${getCurrentPlayer(gameState).name} 选择了并购方`,
      { survivorId: hotelId }
    );

    set({ gameState: { ...gameState } });
    return true;
  },

  confirmBuyStock: (hotelId: string, quantity: number) => {
    const { gameState, localPlayerId, gameId } = get();
    if (!gameState || gameState.phase !== 'buy_stocks') return null;

    const result = buyStock(gameState, hotelId, quantity);
    if (!result.success) {
      set({ message: result.error || '购买失败' });
      return result;
    }

    const player = getCurrentPlayer(gameState);
    const hotel = gameState.hotels[hotelId];

    writeGameLog(gameId, localPlayerId, 'BUY_STOCK',
      `${player.name} 购买了 ${quantity} 张 ${hotel.name} 股票`,
      { hotelId, quantity }
    );

    updatePlayer(localPlayerId, {
      cash: player.cash,
      stocks: player.stocks,
      hand_tile_ids: player.handTileIds,
    });

    updateHotel(hotelId, { remaining_stocks: hotel.remainingStocks });
    updateGame(gameId, { stocks_bought_this_turn: gameState.stocksBoughtThisTurn });

    set({ gameState: { ...gameState } });
    return result;
  },

  finishBuying: () => {
    const { gameState, localPlayerId, gameId } = get();
    if (!gameState || gameState.phase !== 'buy_stocks') return;

    completeStockBuying(gameState);

    const player = getCurrentPlayer(gameState);

    writeGameLog(gameId, localPlayerId, 'FINISH_BUYING',
      `${player.name} 完成了购买并结束回合`,
      {}
    );

    updatePlayer(localPlayerId, { hand_tile_ids: player.handTileIds });
    updateGame(gameId, {
      current_phase: gameState.phase,
      current_player_index: gameState.currentPlayerIndex,
      stocks_bought_this_turn: 0,
    });

    set({ gameState: { ...gameState } });
  },

  confirmMergerDecision: (
    mergerIndex: number,
    playerId: string,
    decision: 'sell' | 'trade' | 'hold',
    quantity: number
  ) => {
    const { gameState, gameId } = get();
    if (!gameState || gameState.phase !== 'merger_decisions') {
      return { success: false, error: '不在并购决策阶段' };
    }

    const result = makeMergerDecision(gameState, mergerIndex, playerId, decision, quantity);
    if (!result.success) return result;

    writeGameLog(gameId, playerId, 'MERGER_DECISION',
      `${gameState.players[playerId]?.name} 在并购中选择了 ${decision}`,
      { mergerIndex, decision, quantity }
    );

    // 如果是最后决策完成
    if (gameState.phase !== 'merger_decisions') {
      updateGame(gameId, { current_phase: gameState.phase });
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  finishMergers: () => {
    const { gameState, gameId } = get();
    if (!gameState || gameState.phase !== 'merger_decisions') return;

    finishMergerDecisions(gameState);
    updateGame(gameId, { current_phase: gameState.phase });
    set({ gameState: { ...gameState } });
  },

  declareEnd: () => {
    const { gameState, localPlayerId, gameId } = get();
    if (!gameState) return false;

    const result = declareGameEnd(gameState);
    if (!result) return false;

    writeGameLog(gameId, localPlayerId, 'DECLARE_END', '宣布游戏结束', {});
    updateGame(gameId, { status: 'finished', current_phase: 'game_over' });

    set({ gameState: { ...gameState } });
    return true;
  },

  clearMessage: () => set({ message: null }),
  resetGame: () => {
    get().cleanup();
    set({ gameState: null, selectedTileId: null, message: null, devMode: false, isLoading: true });
  },
}));

// ---- 远程操作处理 ----

function handleRemoteLog(
  store: ReturnType<typeof useOnlineGameStore.getState>,
  log: GameLogRow
) {
  const { gameState } = store;
  if (!gameState) return;

  switch (log.action) {
    case 'PLACE_TILE': {
      const tileId = (log.payload as Record<string, unknown>)?.tileId as string;
      if (tileId) placeTile(gameState, tileId);
      break;
    }
    case 'FOUND_HOTEL': {
      const hotelId = (log.payload as Record<string, unknown>)?.hotelId as string;
      if (hotelId) foundHotel(gameState, hotelId);
      break;
    }
    case 'CHOOSE_ACQUIRER': {
      const survivorId = (log.payload as Record<string, unknown>)?.survivorId as string;
      if (survivorId) chooseAcquirer(gameState, survivorId);
      break;
    }
    case 'BUY_STOCK': {
      const hotelId = (log.payload as Record<string, unknown>)?.hotelId as string;
      const quantity = (log.payload as Record<string, unknown>)?.quantity as number;
      if (hotelId && quantity) buyStock(gameState, hotelId, quantity);
      break;
    }
    case 'FINISH_BUYING': {
      completeStockBuying(gameState);
      break;
    }
    case 'MERGER_DECISION': {
      const mergerIndex = (log.payload as Record<string, unknown>)?.mergerIndex as number;
      const decision = (log.payload as Record<string, unknown>)?.decision as 'sell' | 'trade' | 'hold';
      const quantity = (log.payload as Record<string, unknown>)?.quantity as number;
      if (log.player_id && decision) {
        makeMergerDecision(gameState, mergerIndex, log.player_id, decision, quantity || 0);
      }
      break;
    }
    case 'DECLARE_END': {
      declareGameEnd(gameState);
      break;
    }
  }
}

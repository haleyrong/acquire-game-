// ============================================================
// 游戏状态管理 (Zustand) — 支持本地和联网模式
// ============================================================

import { create } from 'zustand';
import type { GameState, Tile } from '@/lib/engine/types';
import {
  createGame,
  placeTile,
  foundHotel,
  chooseAcquirer,
  swapTile,
  buyStock,
  completeStockBuying,
  skipShop,
  buyUniversalTile,
  buyFutures,
  sellFutures,
  getAvailableShopItems,
  getFuturesPrice,
  initFuturesConfig,
  skipUseItem,
  useUniversalTile,
  makeMergerDecision,
  finishMergerDecisions,
  canDeclareEnd,
  declareGameEnd,
  getCurrentPlayer,
  type PlaceTileResult,
  type BuyStockResult,
} from '@/lib/engine/GameEngine';
import { classicConfig } from '@/lib/config/classic';

type RemoteActionHandler = (action: string, payload: Record<string, unknown>, playerId: string) => void;

interface GameStore {
  // 状态
  gameState: GameState | null;
  selectedTileId: string | null;
  message: string | null;
  devMode: boolean;
  placingUniversalTile: boolean; // 正在使用万能板块（等待点击棋盘）

  // 联网
  remoteHandler: RemoteActionHandler | null;
  setRemoteHandler: (h: RemoteActionHandler | null) => void;

  // 操作
  initGame: (playerNames: string[], mode?: string) => void;
  toggleDevMode: () => void;
  selectTile: (tileId: string) => void;
  getAvailableTiles: () => Tile[];
  swapTile: (tileId: string) => { success: boolean; error?: string; newTileId?: string } | null;
  confirmPlaceTile: () => PlaceTileResult | null;
  confirmFoundHotel: (hotelId: string) => boolean;
  confirmAcquirerChoice: (hotelId: string) => boolean;
  confirmBuyStock: (hotelId: string, quantity: number) => BuyStockResult | null;
  finishBuying: () => void;
  // 商店/期货
  doSkipShop: () => void;
  doBuyUniversal: () => { success: boolean; error?: string };
  doBuyFutures: (hotelId: string, quantity: number) => { success: boolean; error?: string };
  doSellFutures: (hotelId: string, quantity: number) => { success: boolean; error?: string };
  doSkipUseItem: () => void;
  startPlacingUniversal: () => void;
  doUseUniversalTile: (tileId: string) => { success: boolean; error?: string; event: string; adjacentHotels: string[]; affectedHotelId?: string };
  confirmMergerDecision: (
    mergerIndex: number,
    playerId: string,
    decision: 'sell' | 'trade' | 'hold',
    quantity: number
  ) => { success: boolean; error?: string };
  finishMergers: () => void;
  canEndGame: () => boolean;
  declareEnd: () => boolean;
  clearMessage: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedTileId: null,
  message: null,
  devMode: false,
  placingUniversalTile: false,
  remoteHandler: null,

  setRemoteHandler: (h) => set({ remoteHandler: h }),

  initGame: (playerNames: string[], mode?: string) => {
    const state = createGame('local-game', classicConfig, playerNames);
    if (mode === 'futures') {
      state.mode = 'futures';
      initFuturesConfig(state);
    }
    set({ gameState: state, selectedTileId: null, message: null });
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

    const isItemPhase = gameState.phase === 'use_item';
    if (gameState.phase !== 'place_tile' && !isItemPhase) return;
    const player = getCurrentPlayer(gameState);
    // 道具阶段可以选择棋盘上的空位
    if (isItemPhase) {
      const tile = gameState.tiles[tileId];
      if (!tile || tile.placed) return;
      set({ selectedTileId: tileId });
      return;
    }
    if (!player.handTileIds.includes(tileId)) return;
    set({ selectedTileId: tileId });
  },

  getAvailableTiles: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return Object.values(gameState.tiles).filter((t) => !t.placed);
  },

  swapTile: (tileId: string) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'place_tile') return null;
    const result = swapTile(gameState, tileId);
    if (!result.success) { set({ message: result.error }); return null; }
    if (remoteHandler) {
      remoteHandler('SWAP_TILE', { oldTileId: tileId, newTileId: result.newTileId }, getCurrentPlayer(gameState).id);
    }
    set({ gameState: { ...gameState }, selectedTileId: null });
    return result;
  },

  confirmPlaceTile: () => {
    const { gameState, selectedTileId, devMode, remoteHandler, placingUniversalTile } = get();
    if (!gameState || !selectedTileId) return null;

    // 万能板块模式：点击棋盘空位就是放置位置
    if (placingUniversalTile && gameState.phase === 'use_item') {
      const result = useUniversalTile(gameState, selectedTileId);
      if (!result.success) { set({ message: result.error || '使用失败', placingUniversalTile: false }); return null; }
      if (remoteHandler) remoteHandler('USE_UNIVERSAL', { tileId: selectedTileId }, getCurrentPlayer(gameState).id);
      set({ gameState: { ...gameState }, selectedTileId: null, placingUniversalTile: false });
      return result;
    }

    if (devMode) {
      const player = getCurrentPlayer(gameState);
      if (!player.handTileIds.includes(selectedTileId)) {
        player.handTileIds.push(selectedTileId);
      }
    }

    const result = placeTile(gameState, selectedTileId);
    if (!result.success) {
      set({ message: result.error || '放置失败' });
      return result;
    }

    // 同步给远程玩家
    if (remoteHandler) {
      const tile = gameState.tiles[selectedTileId];
      remoteHandler('PLACE_TILE', {
        tileId: selectedTileId,
        label: tile.label,
        event: result.event,
      }, getCurrentPlayer(gameState).id);
    }

    set({ gameState: { ...gameState }, selectedTileId: null });
    return result;
  },

  confirmFoundHotel: (hotelId: string) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'choose_hotel') return false;

    const hotel = gameState.hotels[hotelId];
    const result = foundHotel(gameState, hotelId);

    if (result && remoteHandler) {
      remoteHandler('FOUND_HOTEL', {
        hotelId,
        hotelName: hotel?.name,
      }, getCurrentPlayer(gameState).id);
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  confirmAcquirerChoice: (hotelId: string) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'choose_acquirer') return false;

    const hotel = gameState.hotels[hotelId];
    const result = chooseAcquirer(gameState, hotelId);

    if (result && remoteHandler) {
      remoteHandler('CHOOSE_ACQUIRER', {
        survivorId: hotelId,
        survivorName: hotel?.name,
      }, getCurrentPlayer(gameState).id);
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  confirmBuyStock: (hotelId: string, quantity: number) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'buy_stocks') return null;

    const hotel = gameState.hotels[hotelId];
    const result = buyStock(gameState, hotelId, quantity);
    if (!result.success) {
      set({ message: result.error || '购买失败' });
      return result;
    }

    if (remoteHandler) {
      remoteHandler('BUY_STOCK', {
        hotelId,
        hotelName: hotel?.name,
        quantity,
      }, getCurrentPlayer(gameState).id);
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  finishBuying: () => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'buy_stocks') return;

    const player = getCurrentPlayer(gameState);
    const drawnId = completeStockBuying(gameState);

    if (remoteHandler && drawnId) {
      remoteHandler('FINISH_BUYING', {
        playerId: player.id,
        drawnTileId: drawnId,
      }, player.id);
    }

    set({ gameState: { ...gameState } });
  },

  confirmMergerDecision: (
    mergerIndex: number,
    playerId: string,
    decision: 'sell' | 'trade' | 'hold',
    quantity: number
  ) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'merger_decisions') {
      return { success: false, error: '不在并购决策阶段' };
    }

    const result = makeMergerDecision(gameState, mergerIndex, playerId, decision, quantity);

    if (result.success && remoteHandler) {
      remoteHandler('MERGER_DECISION', {
        mergerIndex,
        decision,
        quantity,
      }, playerId);
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  finishMergers: () => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'merger_decisions') return;

    finishMergerDecisions(gameState);
    if (remoteHandler) {
      remoteHandler('FINISH_MERGERS', {}, '');
    }
    set({ gameState: { ...gameState } });
  },

  canEndGame: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return canDeclareEnd(gameState);
  },

  declareEnd: () => {
    const { gameState, remoteHandler } = get();
    if (!gameState) return false;

    const player = getCurrentPlayer(gameState);
    const result = declareGameEnd(gameState);

    if (result && remoteHandler) {
      remoteHandler('DECLARE_END', {}, player.id);
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  // 商店操作
  doSkipShop: () => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'shop') return;
    const player = getCurrentPlayer(gameState);
    skipShop(gameState);
    if (remoteHandler) remoteHandler('SKIP_SHOP', {}, player.id);
    set({ gameState: { ...gameState } });
  },

  doBuyUniversal: () => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'shop') return { success: false, error: '不在商店阶段' };
    const result = buyUniversalTile(gameState);
    if (result.success && remoteHandler) remoteHandler('BUY_UNIVERSAL', {}, getCurrentPlayer(gameState).id);
    set({ gameState: gameState ? { ...gameState } : null });
    return result;
  },

  doBuyFutures: (hotelId: string, quantity: number) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'shop') return { success: false, error: '不在商店阶段' };
    const result = buyFutures(gameState, hotelId, quantity);
    if (result.success && remoteHandler) remoteHandler('BUY_FUTURES', { hotelId, quantity }, getCurrentPlayer(gameState).id);
    set({ gameState: gameState ? { ...gameState } : null });
    return result;
  },

  doSellFutures: (hotelId: string, quantity: number) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'shop') return { success: false, error: '不在商店阶段' };
    const result = sellFutures(gameState, hotelId, quantity);
    if (result.success && remoteHandler) remoteHandler('SELL_FUTURES', { hotelId, quantity }, getCurrentPlayer(gameState).id);
    set({ gameState: gameState ? { ...gameState } : null });
    return result;
  },

  // 道具操作
  doSkipUseItem: () => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'use_item') return;
    skipUseItem(gameState);
    set({ gameState: { ...gameState } });
  },

  startPlacingUniversal: () => set({ placingUniversalTile: true }),

  doUseUniversalTile: (tileId: string) => {
    const { gameState, remoteHandler } = get();
    if (!gameState || gameState.phase !== 'use_item') return { success: false, error: '不在道具阶段', event: 'none', adjacentHotels: [] };
    const result = useUniversalTile(gameState, tileId);
    if (result.success && remoteHandler) {
      remoteHandler('USE_UNIVERSAL', { tileId }, getCurrentPlayer(gameState).id);
    }
    set({ gameState: gameState ? { ...gameState } : null });
    return result;
  },

  clearMessage: () => set({ message: null }),

  resetGame: () =>
    set({ gameState: null, selectedTileId: null, message: null, devMode: false, placingUniversalTile: false }),
}));

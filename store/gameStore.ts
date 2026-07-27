// ============================================================
// 游戏状态管理 (Zustand)
// ============================================================

import { create } from 'zustand';
import type { GameState, Tile } from '@/lib/engine/types';
import {
  createGame,
  placeTile,
  foundHotel,
  chooseAcquirer,
  buyStock,
  completeStockBuying,
  makeMergerDecision,
  finishMergerDecisions,
  canDeclareEnd,
  declareGameEnd,
  getCurrentPlayer,
  type PlaceTileResult,
  type BuyStockResult,
} from '@/lib/engine/GameEngine';
import { classicConfig } from '@/lib/config/classic';

interface GameStore {
  // 状态
  gameState: GameState | null;
  selectedTileId: string | null;
  message: string | null;
  devMode: boolean;

  // 操作
  initGame: (playerNames: string[]) => void;
  toggleDevMode: () => void;
  selectTile: (tileId: string) => void;
  getAvailableTiles: () => Tile[];
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

  initGame: (playerNames: string[]) => {
    const state = createGame('local-game', classicConfig, playerNames);
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

    if (gameState.phase !== 'place_tile') return;
    const player = getCurrentPlayer(gameState);
    if (!player.handTileIds.includes(tileId)) return;
    set({ selectedTileId: tileId });
  },

  getAvailableTiles: () => {
    const { gameState } = get();
    if (!gameState) return [];
    return Object.values(gameState.tiles).filter((t) => !t.placed);
  },

  confirmPlaceTile: () => {
    const { gameState, selectedTileId, devMode } = get();
    if (!gameState || !selectedTileId) return null;

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

    set({ gameState: { ...gameState }, selectedTileId: null });
    return result;
  },

  confirmFoundHotel: (hotelId: string) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'choose_hotel') return false;

    const result = foundHotel(gameState, hotelId);
    set({ gameState: { ...gameState } });
    return result;
  },

  confirmAcquirerChoice: (hotelId: string) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'choose_acquirer') return false;

    const result = chooseAcquirer(gameState, hotelId);
    set({ gameState: { ...gameState } });
    return result;
  },

  confirmBuyStock: (hotelId: string, quantity: number) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'buy_stocks') return null;

    const result = buyStock(gameState, hotelId, quantity);
    if (!result.success) {
      set({ message: result.error || '购买失败' });
      return result;
    }

    set({ gameState: { ...gameState } });
    return result;
  },

  finishBuying: () => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'buy_stocks') return;

    completeStockBuying(gameState);
    set({ gameState: { ...gameState } });
  },

  confirmMergerDecision: (
    mergerIndex: number,
    playerId: string,
    decision: 'sell' | 'trade' | 'hold',
    quantity: number
  ) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'merger_decisions') {
      return { success: false, error: '不在并购决策阶段' };
    }

    const result = makeMergerDecision(gameState, mergerIndex, playerId, decision, quantity);
    set({ gameState: { ...gameState } });
    return result;
  },

  finishMergers: () => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'merger_decisions') return;

    finishMergerDecisions(gameState);
    set({ gameState: { ...gameState } });
  },

  canEndGame: () => {
    const { gameState } = get();
    if (!gameState) return false;
    return canDeclareEnd(gameState);
  },

  declareEnd: () => {
    const { gameState } = get();
    if (!gameState) return false;

    const result = declareGameEnd(gameState);
    set({ gameState: { ...gameState } });
    return result;
  },

  clearMessage: () => set({ message: null }),

  resetGame: () =>
    set({ gameState: null, selectedTileId: null, message: null, devMode: false }),
}));

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

type RemoteActionHandler = (action: string, payload: Record<string, unknown>, playerId: string) => void;

interface GameStore {
  // 状态
  gameState: GameState | null;
  selectedTileId: string | null;
  message: string | null;
  devMode: boolean;

  // 联网
  remoteHandler: RemoteActionHandler | null;
  setRemoteHandler: (h: RemoteActionHandler | null) => void;

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
  remoteHandler: null,

  setRemoteHandler: (h) => set({ remoteHandler: h }),

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
    const { gameState, selectedTileId, devMode, remoteHandler } = get();
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
    completeStockBuying(gameState);

    if (remoteHandler) {
      remoteHandler('FINISH_BUYING', {
        nextPlayerIndex: gameState.currentPlayerIndex,
        nextPhase: gameState.phase,
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

  clearMessage: () => set({ message: null }),

  resetGame: () =>
    set({ gameState: null, selectedTileId: null, message: null, devMode: false }),
}));

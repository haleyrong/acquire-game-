'use client';

import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer, isTileInDeadZone } from '@/lib/engine/GameEngine';

export function PlayerHand({ isMyTurn = true, localPlayerId }: { isMyTurn?: boolean; localPlayerId?: string }) {
  const gameState = useGameStore((s) => s.gameState);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const selectTile = useGameStore((s) => s.selectTile);
  const confirmPlaceTile = useGameStore((s) => s.confirmPlaceTile);
  const swapTile = useGameStore((s) => s.swapTile);

  if (!gameState) return null;

  const player = localPlayerId ? gameState.players[localPlayerId] : getCurrentPlayer(gameState);
  if (!player) return null;

  const handTiles = player.handTileIds
    .map((id) => gameState.tiles[id])
    .filter(Boolean);

  if (handTiles.length === 0) return null;

  return (
    <div className="bg-surface backdrop-blur rounded-2xl p-4 shadow-md border border-card-border/50">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        📋 手牌（{handTiles.length}/6）
      </h3>
      <div className="flex flex-wrap gap-2">
        {handTiles.map((tile) => {
          const isSelected = selectedTileId === tile.id;
          const isDead = isTileInDeadZone(gameState, tile.id);
          return (
            <div key={tile.id} className="relative group">
              <button
                className={`
                  w-14 h-14 rounded-lg border-2 font-bold text-sm
                  transition-all duration-100
                  ${isDead ? 'border-slate-400 bg-slate-200 text-slate-400' : ''}
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-100 text-blue-700 shadow-md scale-105'
                      : !isDead
                        ? 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:bg-blue-50'
                        : ''
                  }
                `}
                onClick={() => {
                  if (!isMyTurn) return;
                  if (isDead) return; // 死区牌不能放
                  if (isSelected) {
                    confirmPlaceTile();
                  } else {
                    selectTile(tile.id);
                  }
                }}
              >
                {tile.label}
              </button>
              {/* 换牌按钮：仅死区牌显示 */}
              {isMyTurn && isDead && (
                <button
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white
                             text-xs flex items-center justify-center shadow-md
                             hover:bg-amber-600 active:scale-95 transition-all animate-pulse"
                  title="此牌位于安全酒店之间，只能换不能放"
                  onClick={(e) => {
                    e.stopPropagation();
                    swapTile(tile.id);
                  }}
                >
                  ♻️
                </button>
              )}
            </div>
          );
        })}
      </div>
      {selectedTileId && (
        <p className="text-xs text-blue-500 mt-2">
          💡 点击选中的板块可放置到棋盘上
        </p>
      )}
    </div>
  );
}

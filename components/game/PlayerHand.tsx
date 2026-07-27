'use client';

import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function PlayerHand({ isMyTurn = true }: { isMyTurn?: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const selectTile = useGameStore((s) => s.selectTile);
  const confirmPlaceTile = useGameStore((s) => s.confirmPlaceTile);

  if (!gameState) return null;

  const player = getCurrentPlayer(gameState);
  const handTiles = player.handTileIds
    .map((id) => gameState.tiles[id])
    .filter(Boolean);

  if (handTiles.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        📋 手牌（{handTiles.length}/6）
      </h3>
      <div className="flex flex-wrap gap-2">
        {handTiles.map((tile) => {
          const isSelected = selectedTileId === tile.id;
          return (
            <button
              key={tile.id}
              className={`
                w-14 h-14 rounded-lg border-2 font-bold text-sm
                transition-all duration-100
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-100 text-blue-700 shadow-md scale-105'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:bg-blue-50'
                }
              `}
              onClick={() => {
                if (!isMyTurn) return;
                if (isSelected) {
                  confirmPlaceTile();
                } else {
                  selectTile(tile.id);
                }
              }}
            >
              {tile.label}
            </button>
          );
        })}
      </div>
      {selectedTileId && (
        <p className="text-xs text-blue-500 mt-2">
          💡 点击选中的板块可放置到棋盘上，或再次点击棋盘上的位置
        </p>
      )}
    </div>
  );
}

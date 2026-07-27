'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';

export function DevTilePicker() {
  const gameState = useGameStore((s) => s.gameState);
  const devMode = useGameStore((s) => s.devMode);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const selectTile = useGameStore((s) => s.selectTile);

  if (!gameState || !devMode) return null;

  // 按行列排序的所有未放置板块
  const availableTiles = useMemo(() => {
    return Object.values(gameState.tiles)
      .filter((t) => !t.placed)
      .sort((a, b) => {
        if (a.position.row !== b.position.row) return a.position.row - b.position.row;
        return a.position.col - b.position.col;
      });
  }, [gameState.tiles]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">
          🛠️ 板块选择器（{availableTiles.length} 块可用）
        </h3>
      </div>
      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
        {availableTiles.map((tile) => {
          const isSelected = selectedTileId === tile.id;
          return (
            <button
              key={tile.id}
              onClick={() => selectTile(tile.id)}
              className={`
                w-9 h-9 rounded text-[10px] font-medium transition-all
                ${
                  isSelected
                    ? 'bg-blue-500 text-white shadow-md scale-110 ring-2 ring-blue-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 border border-slate-200'
                }
              `}
            >
              {tile.label}
            </button>
          );
        })}
      </div>
      {selectedTileId && (
        <p className="text-xs text-blue-500 mt-2">
          💡 已选中 {gameState.tiles[selectedTileId]?.label}，点击棋盘上空位放置
        </p>
      )}
    </div>
  );
}

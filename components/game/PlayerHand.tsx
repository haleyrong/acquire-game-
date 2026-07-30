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

  const items = player.items?.filter((it) => it.quantity > 0) || [];

  if (handTiles.length === 0 && items.length === 0) return null;

  return (
    <div className="flex gap-3">
      {/* 手牌栏 — 宽度减半 */}
      <div className="flex-1 bg-surface backdrop-blur rounded-2xl p-3 shadow-md border border-card-border/50">
        <h3 className="text-xs font-semibold text-slate-700 mb-2">
          📋 手牌（{handTiles.length}/6）
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {handTiles.map((tile) => {
            const isSelected = selectedTileId === tile.id;
            const isDead = isTileInDeadZone(gameState, tile.id);
            return (
              <div key={tile.id} className="relative group">
                <button
                  className={`
                    w-10 h-10 rounded-md border-2 font-bold text-xs
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
                    if (isDead) return;
                    if (isSelected) {
                      confirmPlaceTile();
                    } else {
                      selectTile(tile.id);
                    }
                  }}
                >
                  {tile.label}
                </button>
                {isMyTurn && isDead && (
                  <button
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white
                               text-[10px] flex items-center justify-center shadow-md
                               hover:bg-amber-600 active:scale-95 transition-all animate-pulse"
                    title="只能换不能放"
                    onClick={(e) => { e.stopPropagation(); swapTile(tile.id); }}>
                    ♻️
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {selectedTileId && (
          <p className="text-[10px] text-blue-500 mt-1.5">💡 再点一次放置</p>
        )}
      </div>

      {/* 道具栏 */}
      <div className="flex-1 bg-surface backdrop-blur rounded-2xl p-3 shadow-md border border-card-border/50">
        <h3 className="text-xs font-semibold text-slate-700 mb-2">
          🎒 道具
        </h3>
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">暂无道具</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const info = item.type === 'universal_tile'
                ? { name: '万能板块', icon: '🃏' }
                : { name: item.type, icon: '?' };
              return (
                <div key={item.type} className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-lg">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-amber-800 leading-tight">{info.name}</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-700">×{item.quantity}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

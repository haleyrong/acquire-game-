'use client';

import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer, getAdjacentPositions } from '@/lib/engine/GameEngine';
import { BoardTile } from './BoardTile';

export function GameBoard({ readOnly = false, localPlayerId }: { readOnly?: boolean; localPlayerId?: string }) {
  const gameState = useGameStore((s) => s.gameState);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const devMode = useGameStore((s) => s.devMode);
  const placingUniversalTile = useGameStore((s) => s.placingUniversalTile);
  const selectTile = useGameStore((s) => s.selectTile);
  const confirmPlaceTile = useGameStore((s) => s.confirmPlaceTile);

  if (!gameState) return null;

  // 只显示本地玩家的手牌，不显示别人的
  const player = localPlayerId ? gameState.players[localPlayerId] : getCurrentPlayer(gameState);
  if (!player) return null;
  const isMyTurn = (!readOnly && (gameState.phase === 'place_tile' || gameState.phase === 'use_item')) || devMode;
  const isUniversalMode = placingUniversalTile && gameState.phase === 'use_item';
  const isChoosingHotel = gameState.phase === 'choose_hotel';

  // 计算需要高亮的 pending 板块
  const pendingTileIds = new Set<string>();
  if (gameState.pendingHotelFounding) {
    pendingTileIds.add(gameState.pendingHotelFounding.placedTileId);
    gameState.pendingHotelFounding.adjacentTileIds.forEach((id) =>
      pendingTileIds.add(id)
    );
  }

  // 计算死区（安全酒店之间的空位）
  const deadZoneTileIds = new Set<string>();
  for (const tile of Object.values(gameState.tiles)) {
    if (tile.placed) continue;
    // 检查该空位相邻的酒店
    const adjHotels = new Set<string>();
    for (const pos of getAdjacentPositions(tile.position)) {
      const adjTile = Object.values(gameState.tiles).find(
        (t) => t.position.row === pos.row && t.position.col === pos.col
      );
      if (adjTile?.hotelId && gameState.hotels[adjTile.hotelId]?.isSafe) {
        adjHotels.add(adjTile.hotelId);
      }
    }
    if (adjHotels.size >= 2) deadZoneTileIds.add(tile.id);
  }

  // 构建 9 行 × 12 列的网格
  const rows = [];
  for (let row = 1; row <= 9; row++) {
    const cells = [];
    for (let col = 1; col <= 12; col++) {
      const tile = Object.values(gameState.tiles).find(
        (t) => t.position.row === row && t.position.col === col
      );
      if (tile) {
        const isUniversalTarget = isUniversalMode && !tile.placed;
        const inHand = devMode
          ? !tile.placed
          : isUniversalTarget || player.handTileIds.includes(tile.id);

        cells.push(
          <BoardTile
            key={tile.id}
            tile={tile}
            hotel={tile.hotelId ? gameState.hotels[tile.hotelId] : null}
            isInHand={inHand}
            isSelected={selectedTileId === tile.id}
            isPending={isChoosingHotel && pendingTileIds.has(tile.id)}
            isDeadZone={deadZoneTileIds.has(tile.id)}
            isUniversalTarget={isUniversalTarget}
            isMyTurn={isMyTurn}
            devMode={devMode}
            onSelect={() => selectTile(tile.id)}
            onPlace={() => confirmPlaceTile()}
          />
        );
      }
    }
    rows.push(
      <div key={row} className="flex gap-0.5">
        {cells}
      </div>
    );
  }

  return (
    <div className="bg-card/80 backdrop-blur rounded-2xl p-4 shadow-lg border border-card-border/50">
      {/* 列标签 */}
      <div className="flex gap-0.5 mb-1 ml-8">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="w-16 h-5 flex items-center justify-center text-xs text-slate-500 font-medium"
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="flex">
        {/* 行标签 */}
        <div className="flex flex-col gap-0.5 mr-1">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="w-7 h-10 flex items-center justify-center text-xs text-slate-500 font-medium"
            >
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>

        {/* 网格 */}
        <div className="flex flex-col gap-0.5">{rows}</div>
      </div>

      {/* 图例 */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="text-slate-500">图例：</span>
        {Object.values(gameState.hotels)
          .filter((h) => h.isActive)
          .map((h) => (
            <span key={h.id} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-sm inline-block shrink-0"
                style={{ backgroundColor: h.color }}
              />
              {h.icon} {h.name} ({h.size}块)
            </span>
          ))}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

export function HotelChoiceModal({ localPlayerId, isMyTurn }: { localPlayerId?: string; isMyTurn?: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const confirmFoundHotel = useGameStore((s) => s.confirmFoundHotel);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState || gameState.phase !== 'choose_hotel') return null;

  const pending = gameState.pendingHotelFounding;
  if (!pending) return null;

  const placedTile = gameState.tiles[pending.placedTileId];
  const adjacentTiles = pending.adjacentTileIds.map((id) => gameState.tiles[id]).filter(Boolean);
  const totalSize = 1 + adjacentTiles.length;

  const hotelOptions = Object.values(gameState.hotels)
    .filter((h) => !h.isActive)
    .map((hotel) => {
      const hc = gameState.config.hotels.find((c) => c.name === hotel.name);
      const minSize = hc?.minFoundingSize ?? 2;
      const icon = hc?.icon || '🏨';
      return { hotel, minSize, icon, eligible: totalSize >= minSize };
    });

  const eligible = hotelOptions.filter((o) => o.eligible);
  const ineligible = hotelOptions.filter((o) => !o.eligible);

  // 折叠状态
  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setCollapsed(false)}
          className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-amber-600 animate-pulse">
          🏨 选择酒店
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-sm w-full mx-4 relative">
        <button onClick={() => setCollapsed(true)}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 text-xs"
          title="缩小">−</button>

        <div className="text-center mb-4">
          <p className="text-3xl mb-2">🏨</p>
          <h2 className="text-lg font-bold text-slate-800">建立新酒店！</h2>
          <p className="text-sm text-slate-500 mt-1">
            在 <span className="font-mono font-bold text-blue-600">{placedTile?.label}</span> 放置板块，共 <span className="font-bold text-amber-600">{totalSize}</span> 块相连。
          </p>
          {ineligible.length > 0 && (
            <p className="text-xs text-amber-500 mt-1">⚠️ 部分酒店需更多相连板块</p>
          )}
        </div>

        <div className="space-y-2 mb-4">
          {eligible.map(({ hotel, minSize, icon }) => (
            <button key={hotel.id} onClick={() => confirmFoundHotel(hotel.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98] transition-all text-left">
              <div className="w-10 h-10 rounded-lg shrink-0 shadow-sm flex items-center justify-center text-xl" style={{ backgroundColor: hotel.color }}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-700">{hotel.name}</div>
                <div className="text-xs text-slate-500">{hotel.tier === 'luxury' ? '奢侈级' : hotel.tier === 'standard' ? '标准级' : '经济级'} · 最低 {minSize} 块</div>
              </div>
              <span className="text-slate-300 text-lg">→</span>
            </button>
          ))}
        </div>

        {ineligible.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-2">需要更多相连板块：</p>
            {ineligible.map(({ hotel, minSize }) => (
              <div key={hotel.id} className="flex items-center gap-3 p-2 rounded-lg opacity-50">
                <div className="w-6 h-6 rounded shrink-0" style={{ backgroundColor: hotel.color }} />
                <span className="text-xs text-slate-500">{hotel.name} · 需要 {minSize} 块（当前 {totalSize} 块）</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400 text-center mt-2">选择后激活酒店，获得 1 股免费股票</p>
      </div>
    </div>
  );
}

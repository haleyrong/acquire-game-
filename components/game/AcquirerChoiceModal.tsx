'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

export function AcquirerChoiceModal() {
  const gameState = useGameStore((s) => s.gameState);
  const confirmAcquirerChoice = useGameStore((s) => s.confirmAcquirerChoice);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState || gameState.phase !== 'choose_acquirer') return null;

  const pending = gameState.pendingAcquirerChoice;
  if (!pending) return null;

  const tieHotels = pending.tieHotels.map((id) => gameState.hotels[id]).filter(Boolean);

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setCollapsed(false)}
          className="bg-purple-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-purple-600 animate-pulse">
          ⚖️ 选择并购方
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
          <p className="text-3xl mb-2">⚖️</p>
          <h2 className="text-lg font-bold text-slate-800">同级并购！</h2>
          <p className="text-sm text-slate-500 mt-1">
            两家规模相同，请选择由<strong>哪一家</strong>并购对方？
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {tieHotels.map((hotel) => (
            <button key={hotel.id} onClick={() => confirmAcquirerChoice(hotel.id)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98] transition-all">
              <div className="w-12 h-12 rounded-xl shadow-md" style={{ backgroundColor: hotel.color }} />
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">{hotel.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">规模 {hotel.size} 块 · ${hotel.stockPrice}/股</div>
              </div>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">选为并购方</span>
            </button>
          ))}
        </div>

        {pending.smallerVictims.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            另外 {pending.smallerVictims.map((id) => gameState.hotels[id]?.name).join('、')} 也将被一并并购
          </p>
        )}
      </div>
    </div>
  );
}

'use client';

import { useGameStore } from '@/store/gameStore';

export function AcquirerChoiceModal() {
  const gameState = useGameStore((s) => s.gameState);
  const confirmAcquirerChoice = useGameStore((s) => s.confirmAcquirerChoice);

  if (!gameState || gameState.phase !== 'choose_acquirer') return null;

  const pending = gameState.pendingAcquirerChoice;
  if (!pending) return null;

  const tieHotels = pending.tieHotels
    .map((id) => gameState.hotels[id])
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-sm w-full mx-4">
        <div className="text-center mb-4">
          <p className="text-3xl mb-2">⚖️</p>
          <h2 className="text-lg font-bold text-slate-800">同级并购！</h2>
          <p className="text-sm text-slate-500 mt-1">
            你有两家规模相同的酒店相连，请选择由<strong>哪一家</strong>并购对方？
          </p>
        </div>

        {/* 两家同级酒店对比 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {tieHotels.map((hotel) => (
            <button
              key={hotel.id}
              onClick={() => confirmAcquirerChoice(hotel.id)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200
                         hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]
                         transition-all"
            >
              <div
                className="w-12 h-12 rounded-xl shadow-md"
                style={{ backgroundColor: hotel.color }}
              />
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">
                  {hotel.name}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  规模 {hotel.size} 块 · ${hotel.stockPrice}/股
                </div>
              </div>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                选为并购方
              </span>
            </button>
          ))}
        </div>

        {/* 其他的小酒店提示 */}
        {pending.smallerVictims.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            另外{' '}
            {pending.smallerVictims.map((id) => gameState.hotels[id]?.name).join('、')}{' '}
            也将被一并并购
          </p>
        )}
      </div>
    </div>
  );
}

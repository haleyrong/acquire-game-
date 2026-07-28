'use client';

import { useGameStore } from '@/store/gameStore';

export function RoundHistory() {
  const gameState = useGameStore((s) => s.gameState);
  if (!gameState || gameState.roundHistory.length === 0) return null;

  const latest = gameState.roundHistory[gameState.roundHistory.length - 1];
  const prev = gameState.roundHistory.length > 1
    ? gameState.roundHistory[gameState.roundHistory.length - 2]
    : null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-base font-semibold text-slate-700 mb-2">
        📊 上回合回顾（第 {latest.roundNumber} 回合）
      </h3>
      <div className="space-y-2">
        {latest.players.map((p) => {
          const prevP = prev?.players.find((pp) => pp.playerId === p.playerId);
          const cashDiff = prevP ? p.cash - prevP.cash : 0;
          const prevStocks = prevP?.stocks || [];

          // 新增的股票
          const gainedStocks = p.stocks
            .map((s) => {
              const prevS = prevStocks.find((ps) => ps.hotelId === s.hotelId);
              const diff = s.quantity - (prevS?.quantity || 0);
              return { ...s, diff };
            })
            .filter((s) => s.diff !== 0);

          return (
            <div key={p.playerId} className="p-2 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-slate-700">{p.playerName}</span>
                <span className={`text-sm font-mono font-medium ${cashDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {cashDiff >= 0 ? '+' : ''}${cashDiff.toLocaleString()}
                </span>
              </div>
              {gainedStocks.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {gainedStocks.map((s) => {
                    const hotel = gameState.hotels[s.hotelId];
                    return (
                      <div key={s.hotelId} className="flex items-center gap-1 text-xs text-slate-500 ml-1">
                        {hotel && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hotel.color }} />}
                        <span>{hotel?.name || '?'}</span>
                        <span className={`font-mono ml-auto ${s.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {s.diff > 0 ? '+' : ''}{s.diff} 股
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {gainedStocks.length === 0 && cashDiff === 0 && (
                <p className="text-xs text-slate-400 ml-1 mt-0.5">无变化</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

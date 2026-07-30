'use client';

import { useGameStore } from '@/store/gameStore';

export function ThisRoundPanel() {
  const gameState = useGameStore((s) => s.gameState);
  if (!gameState) return null;

  const startSnap = gameState.roundStartSnapshot;
  if (!startSnap) return null;

  return (
    <div className="bg-surface backdrop-blur rounded-2xl p-4 shadow-md border border-card-border/50">
      <h3 className="text-base font-semibold text-slate-700 mb-2">
        📊 本回合（第 {gameState.roundNumber} 回合）
      </h3>
      <div className="space-y-2">
        {gameState.playerOrder.map((pid, index) => {
          const player = gameState.players[pid];
          const startP = startSnap.find((s) => s.playerId === pid);
          if (!startP) return null;

          const cashDiff = player.cash - startP.cash;
          const isCurrent = index === gameState.currentPlayerIndex;
          const hasActed = index < gameState.currentPlayerIndex;
          const status = isCurrent ? '进行中' : hasActed ? '已行动' : '未行动';

          const stockDiffs = player.stocks
            .map((s) => {
              const prevS = startP.stocks.find((ps) => ps.hotelId === s.hotelId);
              const diff = s.quantity - (prevS?.quantity || 0);
              return { ...s, diff };
            })
            .filter((s) => s.diff !== 0);

          const futuresDiffs = player.futures
            .map((f) => {
              const prevF = (startP.futures || []).find((pf) => pf.hotelId === f.hotelId);
              const diff = f.quantity - (prevF?.quantity || 0);
              return { ...f, diff };
            })
            .filter((f) => f.diff !== 0);

          const hasChanges = cashDiff !== 0 || stockDiffs.length > 0 || futuresDiffs.length > 0;

          return (
            <div key={pid} className={`p-2 rounded-lg ${isCurrent ? 'bg-blue-50 border border-blue-200' : 'bg-surface/60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{player.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    status === '进行中' ? 'bg-blue-100 text-blue-600' :
                    status === '已行动' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>{status}</span>
                </div>
                {cashDiff !== 0 && (
                  <span className={`text-xs font-mono font-medium ${cashDiff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {cashDiff > 0 ? '+' : ''}${cashDiff.toLocaleString()}
                  </span>
                )}
              </div>

              {/* 股票变动 */}
              {stockDiffs.length > 0 && (
                <div className="mt-1 space-y-0.5 ml-1">
                  {stockDiffs.map((s) => {
                    const hotel = gameState.hotels[s.hotelId];
                    return (
                      <div key={s.hotelId} className="flex items-center gap-1 text-xs text-slate-500">
                        {hotel && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hotel.color }} />}
                        <span>📈 {hotel?.name || '?'}</span>
                        <span className={`font-mono ml-auto ${s.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {s.diff > 0 ? '+' : ''}{s.diff} 股
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 期货变动 */}
              {futuresDiffs.length > 0 && (
                <div className="mt-1 space-y-0.5 ml-1">
                  {futuresDiffs.map((f) => {
                    const fc = gameState.config.futuresConfig.find((c) => c.hotelId === f.hotelId);
                    return (
                      <div key={f.hotelId} className="flex items-center gap-1 text-xs text-slate-500">
                        <span>{fc?.icon || '?'}</span>
                        <span>📊 {fc?.name || '?'}</span>
                        <span className={`font-mono ml-auto ${f.diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {f.diff > 0 ? '+' : ''}{f.diff} 张
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!hasChanges && (
                <p className="text-[10px] text-slate-400 ml-1 mt-0.5">无变化</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

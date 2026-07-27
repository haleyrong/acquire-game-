'use client';

import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function PlayerList() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) return null;

  const currentPlayer = getCurrentPlayer(gameState);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">👥 玩家</h3>
      <div className="space-y-2">
        {gameState.playerOrder.map((playerId, index) => {
          const player = gameState.players[playerId];
          const isCurrent = player.id === currentPlayer.id;
          const totalStocks = player.stocks.reduce((sum, s) => sum + s.quantity, 0);

          return (
            <div
              key={player.id}
              className={`
                p-2 rounded-lg transition-all
                ${isCurrent ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}
              `}
            >
              <div className="flex items-center gap-3">
                {/* 回合指示器 */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${isCurrent ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}
                  `}
                >
                  {index + 1}
                </div>

                {/* 玩家信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm truncate ${isCurrent ? 'text-blue-700' : 'text-slate-700'}`}>
                      {player.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span className="font-mono text-emerald-600 font-medium">
                      ${player.cash.toLocaleString()}
                    </span>
                    {totalStocks > 0 && (
                      <span>📈 {totalStocks} 股</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

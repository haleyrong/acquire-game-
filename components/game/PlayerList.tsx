'use client';

import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function PlayerList({ localPlayerId }: { localPlayerId?: string }) {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) return null;

  const currentPlayer = getCurrentPlayer(gameState);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">👥 玩家</h3>
      <div className="space-y-2">
        {gameState.playerOrder.map((playerId, index) => {
          const player = gameState.players[playerId];
          const isCurrentTurn = player.id === currentPlayer.id;
          const isMe = localPlayerId ? player.id === localPlayerId : isCurrentTurn;
          const totalStocks = player.stocks.reduce((sum, s) => sum + s.quantity, 0);

          return (
            <div
              key={player.id}
              className={`p-2 rounded-lg transition-all ${isCurrentTurn ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}`}
            >
              {/* 基本信息行 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isCurrentTurn ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm truncate ${isCurrentTurn ? 'text-blue-700' : 'text-slate-700'}`}>{player.name}</span>
                    {isMe && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">我</span>}
                    {isCurrentTurn && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">当前</span>}
                  </div>
                  {/* 只显示自己的现金和持股数 */}
                  {isMe && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="font-mono text-emerald-600 font-medium">${player.cash.toLocaleString()}</span>
                      <span>📈 {totalStocks} 股</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 自己的持股明细 */}
              {isMe && (
                <div className="mt-2 ml-11 pl-2 border-l-2 border-slate-200 space-y-1">
                  {player.stocks.filter(s => s.quantity > 0).length > 0 ? (
                    player.stocks.filter(s => s.quantity > 0).map(s => {
                      const hotel = gameState.hotels[s.hotelId];
                      if (!hotel) return null;
                      return (
                        <div key={s.hotelId} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hotel.color }} />
                          <span className="text-slate-600">{hotel.name}</span>
                          <span className="font-mono font-medium text-slate-700 ml-auto">{s.quantity} 股</span>
                          <span className="text-slate-400">(${hotel.stockPrice.toLocaleString()})</span>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400">暂无持股</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

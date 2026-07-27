'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function StockMarket({ isMyTurn = true }: { isMyTurn?: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const confirmBuyStock = useGameStore((s) => s.confirmBuyStock);

  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (!gameState || gameState.phase !== 'buy_stocks') return null;

  const player = getCurrentPlayer(gameState);

  // 不是自己回合：只读显示
  if (!isMyTurn) {
    const myHoldings = player.stocks.filter(s => s.quantity > 0);
    if (myHoldings.length === 0) return null;
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">💰 你的持股</h3>
        <div className="space-y-1">
          {myHoldings.map(s => {
            const hotel = gameState.hotels[s.hotelId];
            if (!hotel) return null;
            return (
              <div key={s.hotelId} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hotel.color }} />
                <span>{hotel.name}</span>
                <span className="font-mono ml-auto">{s.quantity} 股 × ${hotel.stockPrice.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const maxBuy = gameState.config.maxBuyPerTurn;
  const bought = gameState.stocksBoughtThisTurn;
  const remaining = maxBuy - bought;

  const activeHotels = Object.values(gameState.hotels).filter((h) => h.isActive);

  if (activeHotels.length === 0) return null;

  const totalSelected = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  const handleBuy = (hotelId: string) => {
    const qty = quantities[hotelId] || 0;
    if (qty <= 0) return;

    const result = confirmBuyStock(hotelId, qty);
    if (result?.success) {
      // 清除已购买的数量
      setQuantities((prev) => ({ ...prev, [hotelId]: 0 }));
    }
  };

  const adjustQty = (hotelId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[hotelId] || 0;
      const next = Math.max(0, Math.min(
        current + delta,
        remaining - totalSelected + current,
        gameState.hotels[hotelId].remainingStocks
      ));
      return { ...prev, [hotelId]: next };
    });
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          💰 购买股票
        </h3>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
          已买 {bought}/{maxBuy} 张
        </span>
      </div>

      <div className="space-y-2">
        {activeHotels.map((hotel) => {
          const qty = quantities[hotel.id] || 0;
          const totalCost = hotel.stockPrice * qty;
          const canAfford = player.cash >= hotel.stockPrice;
          const hasStock = hotel.remainingStocks > 0;

          return (
            <div
              key={hotel.id}
              className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
            >
              {/* 颜色标记 */}
              <div
                className="w-3 h-3 rounded shrink-0"
                style={{ backgroundColor: hotel.color }}
              />

              {/* 持有数量 */}
              {(() => {
                const myHold = player.stocks.find((s) => s.hotelId === hotel.id);
                return (myHold?.quantity || 0) > 0 ? (
                  <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    持{myHold!.quantity}股
                  </span>
                ) : null;
              })()}

              {/* 酒店信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {hotel.name}
                  </span>
                  {hotel.isSafe && (
                    <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded">安全</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  ${hotel.stockPrice}/股 · 余{hotel.remainingStocks}股
                </div>
              </div>

              {/* 数量调节 */}
              {hasStock && canAfford && remaining > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustQty(hotel.id, -1)}
                    disabled={qty <= 0}
                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 text-sm
                               hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className={`w-5 text-center text-sm font-mono font-medium ${qty > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                    {qty}
                  </span>
                  <button
                    onClick={() => adjustQty(hotel.id, 1)}
                    disabled={totalSelected >= remaining}
                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 text-sm
                               hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              )}

              {/* 购买按钮 */}
              {qty > 0 && (
                <button
                  onClick={() => handleBuy(hotel.id)}
                  className="shrink-0 px-2.5 py-1 bg-emerald-500 text-white text-xs rounded-lg
                             hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  买 ${totalCost.toLocaleString()}
                </button>
              )}

              {/* 买不了的原因 */}
              {(!hasStock || !canAfford) && (
                <span className="text-[10px] text-slate-400 shrink-0">
                  {!hasStock ? '售罄' : '钱不够'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

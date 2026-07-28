'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function BuyStockModal({ isMyTurn }: { isMyTurn: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const confirmBuyStock = useGameStore((s) => s.confirmBuyStock);
  const finishBuying = useGameStore((s) => s.finishBuying);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [bought, setBought] = useState<{ name: string; icon: string; qty: number; cost: number }[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState || gameState.phase !== 'buy_stocks') return null;

  const player = getCurrentPlayer(gameState);
  const maxBuy = gameState.config.maxBuyPerTurn;
  const boughtThisTurn = gameState.stocksBoughtThisTurn;
  const remaining = maxBuy - boughtThisTurn;
  const activeHotels = Object.values(gameState.hotels).filter((h) => h.isActive);

  if (activeHotels.length === 0) return null;

  const totalSelected = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  const handleBuy = (hotelId: string) => {
    const qty = quantities[hotelId] || 0;
    if (qty <= 0) return;
    const result = confirmBuyStock(hotelId, qty);
    if (result?.success) {
      const hotel = gameState.hotels[hotelId];
      setBought((prev) => [...prev, {
        name: hotel.name,
        icon: hotel.icon,
        qty,
        cost: hotel.stockPrice * qty,
      }]);
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

  const handleFinish = () => {
    finishBuying();
  };

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setCollapsed(false)}
          className="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-emerald-600 animate-pulse">
          💰 购买股票
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setCollapsed(true)}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 text-xs"
          title="缩小">−</button>
        {/* 标题 */}
        <div className="text-center mb-4">
          <p className="text-3xl mb-2">💰</p>
          <h2 className="text-lg font-bold text-slate-800">
            {isMyTurn ? '购买股票' : `${player.name} 正在购买股票`}
          </h2>
          {isMyTurn && (
            <p className="text-xs text-slate-500 mt-1">
              每回合最多购买 {maxBuy} 张，已买 {boughtThisTurn} 张
            </p>
          )}
        </div>

        {/* 已购买列表 */}
        {bought.length > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <h3 className="text-xs font-semibold text-emerald-700 mb-1">✅ 已购买</h3>
            {bought.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-emerald-700">
                <span>{b.icon} {b.name} × {b.qty} 股</span>
                <span className="font-mono">-${b.cost.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* 购买列表（仅自己操作时可见） */}
        {isMyTurn && (
          <div className="space-y-2 mb-4">
            {activeHotels.map((hotel) => {
              const qty = quantities[hotel.id] || 0;
              const totalCost = hotel.stockPrice * qty;
              const canAfford = player.cash >= hotel.stockPrice;
              const hasStock = hotel.remainingStocks > 0;

              return (
                <div key={hotel.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors">
                  <span className="text-lg">{hotel.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-700">{hotel.name}</span>
                      {hotel.isSafe && <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded">安全</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      ${hotel.stockPrice}/股 · 余{hotel.remainingStocks}股
                      {(() => {
                        const myHold = player.stocks.find((s) => s.hotelId === hotel.id);
                        return (myHold?.quantity || 0) > 0 ? (
                          <span className="ml-1 text-purple-500">· 持{myHold!.quantity}股</span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {hasStock && canAfford && remaining > 0 ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => adjustQty(hotel.id, -1)} disabled={qty <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 text-slate-500 text-sm hover:bg-slate-200 disabled:opacity-30">−</button>
                      <span className={`w-6 text-center text-sm font-mono font-medium ${qty > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{qty}</span>
                      <button onClick={() => adjustQty(hotel.id, 1)} disabled={totalSelected >= remaining}
                        className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 text-slate-500 text-sm hover:bg-slate-200 disabled:opacity-30">+</button>
                      {qty > 0 && (
                        <button onClick={() => handleBuy(hotel.id)}
                          className="ml-1 px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 active:scale-95">
                          买 ${totalCost.toLocaleString()}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 shrink-0">
                      {!hasStock ? '售罄' : !canAfford ? '钱不够' : `已买${boughtThisTurn}/${maxBuy}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 操作按钮 */}
        {isMyTurn && (
          <div className="flex gap-2">
            <button onClick={handleFinish}
              className="w-full py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm">
              ✅ {boughtThisTurn > 0 ? `完成购买 (${boughtThisTurn}张)` : '跳过购买'} · 结束回合
            </button>
          </div>
        )}

        {!isMyTurn && (
          <p className="text-center text-sm text-slate-500 animate-pulse">
            ⏳ 等待 {player.name} 完成购买...
          </p>
        )}

        <p className="text-xs text-slate-400 text-center mt-3">
          {isMyTurn ? `持有现金: $${player.cash.toLocaleString()}` : '对方购买完成后将自动更新'}
        </p>
      </div>
    </div>
  );
}

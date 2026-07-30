'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer, getFuturesPrice } from '@/lib/engine/GameEngine';

export function ShopModal({ isMyTurn }: { isMyTurn: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const skipShop = useGameStore((s) => s.doSkipShop);
  const buyUniversal = useGameStore((s) => s.doBuyUniversal);
  const buyFutures = useGameStore((s) => s.doBuyFutures);
  const sellFutures = useGameStore((s) => s.doSellFutures);

  const [futuresQty, setFuturesQty] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<'items' | 'futures'>('items');

  if (!gameState || gameState.phase !== 'shop') return null;

  const player = getCurrentPlayer(gameState);
  const universalPrice = gameState.config.universalTilePrice;

  const adjustQty = (hotelId: string, delta: number) => {
    setFuturesQty((prev) => {
      const cur = prev[hotelId] || 0;
      const next = Math.max(-99, cur + delta);
      return { ...prev, [hotelId]: next };
    });
  };

  const handleBuyFutures = (hotelId: string) => {
    const qty = futuresQty[hotelId] || 0;
    if (qty <= 0) return;
    const result = buyFutures(hotelId, qty);
    if (result.success) setFuturesQty((p) => ({ ...p, [hotelId]: 0 }));
  };

  const handleSellFutures = (hotelId: string) => {
    const qty = Math.abs(futuresQty[hotelId] || 0);
    if (qty <= 0) return;
    const result = sellFutures(hotelId, qty);
    if (result.success) setFuturesQty((p) => ({ ...p, [hotelId]: 0 }));
  };

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setCollapsed(false)}
          className="bg-purple-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-purple-600 animate-pulse">
          🛒 商店
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setCollapsed(true)}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 text-xs"
          title="缩小">−</button>

        {/* 标题 */}
        <div className="text-center mb-4">
          <p className="text-3xl mb-2">🛒</p>
          <h2 className="text-lg font-bold text-slate-800">
            {isMyTurn ? '商店' : `${player.name} 正在逛商店`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">现金: ${player.cash.toLocaleString()}</p>
        </div>

        {/* 标签页切换 */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-4">
          <button
            onClick={() => setTab('items')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'items' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}>
            🎒 道具
          </button>
          <button
            onClick={() => setTab('futures')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'futures' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}>
            📈 期货
          </button>
        </div>

        {/* 道具标签页 */}
        {tab === 'items' && (
          <div className="mb-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🃏</span>
                  <div>
                    <span className="text-sm font-semibold text-slate-700">万能板块</span>
                    <p className="text-xs text-slate-500">放在棋盘上任意空位</p>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-amber-700">${universalPrice.toLocaleString()}</span>
              </div>
              {isMyTurn && (
                <button
                  onClick={() => buyUniversal()}
                  disabled={player.cash < universalPrice}
                  className={`w-full py-2 rounded-lg text-sm font-semibold ${
                    player.cash >= universalPrice
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}>
                  {player.cash >= universalPrice ? '购买万能板块' : '现金不足'}
                </button>
              )}
            </div>

            {/* 我的道具 */}
            {player.items.filter(it => it.quantity > 0).length > 0 && (
              <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <h3 className="text-xs font-semibold text-purple-700 mb-2">🎒 我的道具</h3>
                {player.items.filter(it => it.quantity > 0).map(it => (
                  <div key={it.type} className="flex items-center justify-between text-sm">
                    <span className="text-purple-700">🃏 万能板块</span>
                    <span className="font-mono font-bold text-purple-700">×{it.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 期货标签页 */}
        {tab === 'futures' && (
          <div className="mb-4">
            <div className="space-y-2">
              {gameState.config.futuresConfig.map((fc) => {
                const hotel = gameState.hotels[fc.hotelId];
                if (!hotel) return null;
                const price = getFuturesPrice(gameState, hotel.id);
                const myHolding = player.futures.find((f) => f.hotelId === hotel.id);
                const myQty = myHolding?.quantity || 0;
                const avgPrice = myHolding?.purchasePrice || 0;
                const qty = futuresQty[hotel.id] || 0;

                return (
                  <div key={hotel.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{fc.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">{fc.name}</span>
                          <span className="text-[10px] text-slate-400">({hotel.name})</span>
                          {hotel.isActive && <span className="text-[10px] text-slate-400">规模{hotel.size}块</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="font-mono text-emerald-600">${price.toLocaleString()}/张</span>
                          <span>持{myQty}张</span>
                          {myQty > 0 && <span className="text-slate-400">均价${avgPrice.toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>

                    {isMyTurn && (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => adjustQty(hotel.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-red-100 text-red-500 text-sm hover:bg-red-200">−</button>
                        <span className={`text-xs font-mono font-bold w-10 text-center ${qty < 0 ? 'text-red-500' : qty > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {qty > 0 ? `+${qty}` : qty}
                        </span>
                        <button onClick={() => adjustQty(hotel.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-emerald-100 text-emerald-500 text-sm hover:bg-emerald-200">+</button>

                        {qty > 0 && (
                          <button onClick={() => handleBuyFutures(hotel.id)}
                            className="px-2 py-1 bg-emerald-500 text-white text-xs rounded hover:bg-emerald-600">
                            买入 {qty} 张 (${(price * qty).toLocaleString()})
                          </button>
                        )}
                        {qty < 0 && myQty > 0 && (
                          <button onClick={() => handleSellFutures(hotel.id)}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">
                            卖出 {Math.abs(qty)} 张 (+${(price * Math.abs(qty)).toLocaleString()})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 结束商店 */}
        {isMyTurn && (
          <button onClick={skipShop}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600">
            ✅ 离开商店 · 补牌 · 结束回合
          </button>
        )}
        {!isMyTurn && (
          <p className="text-center text-sm text-slate-500 animate-pulse">⏳ 等待 {player.name} 完成购物...</p>
        )}

        <p className="text-xs text-slate-400 text-center mt-2">
          {tab === 'futures' ? '每人每期货最多持有10张' :
           isMyTurn ? '购买道具存入背包，放置板块后可使用' : '对方购物完成后将自动更新'}
        </p>
      </div>
    </div>
  );
}

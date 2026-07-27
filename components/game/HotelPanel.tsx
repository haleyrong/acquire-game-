'use client';

import { useGameStore } from '@/store/gameStore';

export function HotelPanel() {
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) return null;

  const activeHotels = Object.values(gameState.hotels).filter((h) => h.isActive);
  const inactiveHotels = Object.values(gameState.hotels).filter((h) => !h.isActive);

  // 计算某酒店的最大和第二大股东
  const getShareholders = (hotelId: string) => {
    const holders = gameState.playerOrder
      .map((pid) => {
        const p = gameState.players[pid];
        const h = p.stocks.find((s) => s.hotelId === hotelId);
        return { name: p.name, quantity: h?.quantity || 0 };
      })
      .filter((s) => s.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);
    return holders;
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">🏨 酒店连锁</h3>

      {activeHotels.length === 0 && (
        <p className="text-xs text-slate-400 mb-2">尚无酒店成立</p>
      )}

      {activeHotels.map((hotel) => {
        const shareholders = getShareholders(hotel.id);
        const price = hotel.stockPrice;

        return (
          <div key={hotel.id} className="py-3 border-b border-slate-100 last:border-0">
            {/* 酒店名 + 颜色标记 */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: hotel.color }} />
              <span className="text-sm font-semibold text-slate-700">{hotel.name}</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">
                {hotel.tier === 'luxury' ? '奢侈' : hotel.tier === 'standard' ? '标准' : '经济'}
              </span>
              {hotel.isSafe && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded">安全</span>
              )}
            </div>

            {/* 规模 + 股价 + 库存 */}
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-1">
              <span>规模 {hotel.size} 块</span>
              <span className="font-mono text-emerald-600 font-medium">
                ${price.toLocaleString()}/股
              </span>
              <span>余 {hotel.remainingStocks} 股</span>
            </div>

            {/* 股东信息 */}
            {shareholders.length > 0 && (
              <div className="text-[11px] space-y-0.5 ml-1">
                {shareholders.slice(0, 2).map((s, i) => {
                  const bonus = i === 0
                    ? price * gameState.config.majorityBonusMultiplier
                    : price * gameState.config.minorityBonusMultiplier;

                  // 检查是否有平级情况
                  const sameRank = shareholders.filter(sh => sh.quantity === s.quantity);
                  const isTie = sameRank.length > 1;

                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-slate-500">
                        {i === 0 ? '🥇' : '🥈'} {s.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">{s.quantity}股</span>
                        <span className="text-amber-600 font-medium ml-1">
                          +${isTie ? Math.floor(bonus / sameRank.length).toLocaleString() : bonus.toLocaleString()}
                        </span>
                        {isTie && <span className="text-[9px] text-slate-400">(平分)</span>}
                      </div>
                    </div>
                  );
                })}
                {shareholders.length > 2 && (
                  <div className="text-slate-400 text-[10px]">
                    及其他 {shareholders.length - 2} 位股东
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 未激活的酒店 */}
      {inactiveHotels.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">待激活</p>
          <div className="flex flex-wrap gap-2">
            {inactiveHotels.map((hotel) => (
              <div key={hotel.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded opacity-50" style={{ backgroundColor: hotel.color }} />
                {hotel.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

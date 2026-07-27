'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

export function MergerModal() {
  const gameState = useGameStore((s) => s.gameState);
  const confirmMergerDecision = useGameStore((s) => s.confirmMergerDecision);

  const [sellQty, setSellQty] = useState(0);
  const [tradeQty, setTradeQty] = useState(0);

  if (!gameState || gameState.phase !== 'merger_decisions') return null;

  const pendingMergers = gameState.activeMergers.filter((m) => m.status === 'pending');
  if (pendingMergers.length === 0) return null;

  const merger = pendingMergers[0]; // 按序处理第一个
  const mergerIndex = gameState.activeMergers.indexOf(merger);
  const totalMergers = gameState.activeMergers.length;
  const currentMergerNumber = gameState.activeMergers.filter(
    (m, i) => i <= mergerIndex && m.status !== 'completed'
  ).length;

  const survivor = gameState.hotels[merger.acquiringHotelId];
  if (!survivor) return null;

  const currentDecisionPlayerId = merger.decisionQueue[merger.currentDecisionPlayerIndex];
  const isMyTurn = !!currentDecisionPlayerId;

  const decisionPlayer = currentDecisionPlayerId
    ? gameState.players[currentDecisionPlayerId]
    : null;

  const myHolding = decisionPlayer?.stocks.find(
    (s) => s.hotelId === merger.acquiredHotelId
  );
  const myQuantity = myHolding?.quantity || 0;

  const handleDecision = (decision: 'sell' | 'trade' | 'hold', quantity: number) => {
    if (!currentDecisionPlayerId) return;
    confirmMergerDecision(
      mergerIndex,
      currentDecisionPlayerId,
      decision,
      quantity
    );
    setSellQty(0);
    setTradeQty(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="text-center mb-4">
          <p className="text-4xl mb-2">🤝</p>
          <h2 className="text-xl font-bold text-slate-800">并购发生了！</h2>
          {totalMergers > 1 && (
            <p className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full inline-block mt-1">
              第 {currentMergerNumber}/{totalMergers} 起并购
            </p>
          )}
          <p className="text-base text-slate-600 mt-1">
            <span style={{ color: survivor.color }} className="font-bold">
              {survivor.name}
            </span>{' '}
            并购了{' '}
            <span
              style={{ color: merger.acquiredHotelColor }}
              className="font-bold"
            >
              {merger.acquiredHotelName}
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            股价 ${merger.victimStockPrice}/股
            {survivor.isSafe && (
              <span className="ml-1 text-amber-500">· {survivor.name}已是安全酒店</span>
            )}
          </p>
        </div>

        {/* 分红信息 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">💵 股东分红</h3>
          <div className="space-y-2">
            {merger.majorityPlayerName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">
                  🥇 {merger.majorityPlayerName}（最大股东）
                </span>
                <span className="font-mono font-bold text-amber-800">
                  +${merger.majorityBonus.toLocaleString()}
                </span>
              </div>
            )}
            {merger.minorityPlayerName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">
                  🥈 {merger.minorityPlayerName}（第二大股东）
                </span>
                <span className="font-mono font-bold text-amber-800">
                  +${merger.minorityBonus.toLocaleString()}
                </span>
              </div>
            )}
            {!merger.majorityPlayerName && !merger.minorityPlayerName && (
              <p className="text-sm text-amber-600">该酒店无股东，无人获得分红</p>
            )}
          </div>
        </div>

        {/* 决策区域 */}
        {!decisionPlayer && merger.status === 'pending' && (
          <p className="text-center text-sm text-slate-500">所有股东已决策完毕</p>
        )}

        {isMyTurn && merger.status === 'pending' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              🎯 你的决策
            </h3>
            <p className="text-xs text-blue-600 mb-3">
              你持有 {myQuantity} 张 {merger.acquiredHotelName} 股票
            </p>

            <div className="space-y-3">
              {/* 卖出 */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    💰 卖出变现
                  </span>
                  <span className="text-xs text-slate-500">
                    ${merger.victimStockPrice}/股
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={myQuantity}
                    value={sellQty}
                    onChange={(e) => setSellQty(Number(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <span className="text-sm font-mono font-bold text-blue-600 w-12 text-right">
                    {sellQty}张
                  </span>
                </div>
                {sellQty > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-slate-500">
                      获得 ${(merger.victimStockPrice * sellQty).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleDecision('sell', sellQty)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg
                                 hover:bg-blue-600 active:scale-95 transition-all"
                    >
                      确认卖出
                    </button>
                  </div>
                )}
              </div>

              {/* 置换 */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    🔄 置换股票
                  </span>
                  <span className="text-xs text-slate-500">
                    {gameState.config.tradeRatio} 旧股 → 1 {survivor.name} 股
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={myQuantity - (myQuantity % gameState.config.tradeRatio)}
                    step={gameState.config.tradeRatio}
                    value={tradeQty}
                    onChange={(e) => setTradeQty(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="text-sm font-mono font-bold text-emerald-600 w-12 text-right">
                    {tradeQty}张
                  </span>
                </div>
                {tradeQty > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-slate-500">
                      换得 {Math.floor(tradeQty / gameState.config.tradeRatio)} 张{' '}
                      {survivor.name} 股票
                    </span>
                    <button
                      onClick={() => handleDecision('trade', tradeQty)}
                      className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-lg
                                 hover:bg-emerald-600 active:scale-95 transition-all"
                    >
                      确认置换
                    </button>
                  </div>
                )}
              </div>

              {/* 保留 */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      📦 保留股票
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      保留全部 {myQuantity} 张（酒店已下市，终局无价值）
                    </p>
                  </div>
                  <button
                    onClick={() => handleDecision('hold', myQuantity)}
                    className="px-3 py-1 bg-slate-200 text-slate-600 text-xs rounded-lg
                               hover:bg-slate-300 active:scale-95 transition-all"
                  >
                    全部保留
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isMyTurn && decisionPlayer && merger.status === 'pending' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500">
              ⏳ 等待{' '}
              <span className="font-bold text-slate-700">
                {decisionPlayer.name}
              </span>{' '}
              做出决策...
            </p>
            <p className="text-xs text-slate-400 mt-1">
              队列 ({merger.currentDecisionPlayerIndex + 1}/{merger.decisionQueue.length})
            </p>
          </div>
        )}

        {/* 提示 */}
        <p className="text-xs text-slate-400 text-center mt-3">
          股东决策完毕后自动进入
          {totalMergers > 1 ? `下一并购（${currentMergerNumber}/${totalMergers}）` : '买股票阶段'}
        </p>
      </div>
    </div>
  );
}

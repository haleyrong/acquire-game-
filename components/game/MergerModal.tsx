'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';

export function MergerModal({ localPlayerId }: { localPlayerId?: string }) {
  const gameState = useGameStore((s) => s.gameState);
  const confirmMergerDecision = useGameStore((s) => s.confirmMergerDecision);
  const [sellQty, setSellQty] = useState(0);
  const [tradeQty, setTradeQty] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState || gameState.phase !== 'merger_decisions') return null;

  const pendingMerger = gameState.activeMergers.find((m) => m.status === 'pending');
  if (!pendingMerger) return null;

  const merger = pendingMerger;
  const mergerIndex = gameState.activeMergers.indexOf(merger);
  const totalPending = gameState.activeMergers.filter((m) => m.status === 'pending').length;
  const completedCount = gameState.activeMergers.filter((m) => m.status === 'completed').length;
  const totalMergers = completedCount + totalPending;

  const survivor = gameState.hotels[merger.acquiringHotelId];
  if (!survivor) return null;

  const currentDecisionPid = merger.decisionQueue[merger.currentDecisionPlayerIndex];
  const isMe = localPlayerId ? localPlayerId === currentDecisionPid : true;
  const decisionPlayer = currentDecisionPid ? gameState.players[currentDecisionPid] : null;
  const decisionHolding = decisionPlayer?.stocks.find((s) => s.hotelId === merger.acquiredHotelId);
  const decisionQuantity = decisionHolding?.quantity || 0;

  const handleDecision = (decision: 'sell' | 'trade' | 'hold', quantity: number) => {
    if (!currentDecisionPid) return;
    confirmMergerDecision(mergerIndex, currentDecisionPid, decision, quantity);
    setSellQty(0);
    setTradeQty(0);
  };

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setCollapsed(false)}
          className="bg-red-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-red-600 animate-pulse">
          🤝 并购进行中
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setCollapsed(true)}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 text-xs"
          title="缩小">−</button>
        {/* 标题 */}
        <div className="text-center mb-4">
          <p className="text-4xl mb-2">🤝</p>
          <h2 className="text-xl font-bold text-slate-800">并购发生了！</h2>
          {totalMergers > 1 && (
            <p className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full inline-block mt-1">
              第 {completedCount + 1}/{totalMergers} 起并购
            </p>
          )}
          <p className="text-base text-slate-600 mt-1">
            <span style={{ color: survivor.color }} className="font-bold">{survivor.name}</span>
            {' '}并购了{' '}
            <span style={{ color: merger.acquiredHotelColor }} className="font-bold">{merger.acquiredHotelName}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            股价 ${merger.victimStockPrice}/股
            {survivor.isSafe && <span className="ml-1 text-amber-500">· 已是安全酒店</span>}
          </p>
        </div>

        {/* 分红信息 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">💵 股东分红</h3>
          <div className="space-y-2">
            {merger.majorityPlayerName ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">🥇 {merger.majorityPlayerName}（最大股东）</span>
                <span className="font-mono font-bold text-amber-800">+${merger.majorityBonus.toLocaleString()}</span>
              </div>
            ) : (
              <p className="text-xs text-amber-400">最大股东：无</p>
            )}
            {merger.minorityPlayerName ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700">🥈 {merger.minorityPlayerName}（第二大股东）</span>
                <span className="font-mono font-bold text-amber-800">+${merger.minorityBonus.toLocaleString()}</span>
              </div>
            ) : (
              <p className="text-xs text-amber-400">第二大股东：无</p>
            )}
          </div>
        </div>

        {/* 决策区域 */}
        {!currentDecisionPid && (
          <p className="text-center text-sm text-slate-500 mb-4">所有股东已决策完毕，并购自动完成</p>
        )}

        {/* 别人在决策，自己等待 */}
        {currentDecisionPid && decisionPlayer && !isMe && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-center">
            <p className="text-sm text-slate-500">
              ⏳ 等待 <strong className="text-slate-700">{decisionPlayer.name}</strong> 做出并购决策...
            </p>
            <p className="text-xs text-slate-400 mt-1">
              持有 {decisionQuantity} 张 {merger.acquiredHotelName} 股票
            </p>
          </div>
        )}

        {/* 自己的决策 */}
        {currentDecisionPid && decisionPlayer && isMe && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              🎯 你的决策
            </h3>
            <p className="text-xs text-blue-600 mb-3">
              持有 {decisionQuantity} 张 {merger.acquiredHotelName} 股票
            </p>

            <div className="space-y-3">
              {/* 卖出 */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">💰 卖出变现</span>
                  <span className="text-xs text-slate-500">${merger.victimStockPrice}/股</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={decisionQuantity} value={sellQty}
                    onChange={(e) => { setSellQty(Number(e.target.value)); setTradeQty(0); }}
                    className="flex-1 accent-blue-500" />
                  <span className="text-sm font-mono font-bold text-blue-600 w-12 text-right">{sellQty}张</span>
                </div>
                {sellQty > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-slate-500">获得 ${(merger.victimStockPrice * sellQty).toLocaleString()}</span>
                    <button onClick={() => handleDecision('sell', sellQty)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 active:scale-95 transition-all">
                      卖出（可继续操作）
                    </button>
                  </div>
                )}
              </div>

              {/* 置换 */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">🔄 置换股票</span>
                  <span className="text-xs text-slate-500">
                    {gameState.config.tradeRatio} 旧股 → 1 {survivor.name} 股 · 余 {survivor.remainingStocks} 股
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={decisionQuantity - (decisionQuantity % gameState.config.tradeRatio)}
                    step={gameState.config.tradeRatio} value={tradeQty}
                    onChange={(e) => { setTradeQty(Number(e.target.value)); setSellQty(0); }}
                    className="flex-1 accent-emerald-500" />
                  <span className="text-sm font-mono font-bold text-emerald-600 w-12 text-right">{tradeQty}张</span>
                </div>
                {tradeQty > 0 && (() => {
                  const newStockCount = Math.floor(tradeQty / gameState.config.tradeRatio);
                  const hasEnough = survivor.remainingStocks >= newStockCount;
                  return (
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-xs ${hasEnough ? 'text-slate-500' : 'text-red-500'}`}>
                        换得 {newStockCount} 张 {survivor.name} 股票
                        {!hasEnough && ` (仅剩${survivor.remainingStocks}股！)`}
                      </span>
                      <button onClick={() => handleDecision('trade', tradeQty)}
                        className={`px-3 py-1 text-white text-xs rounded-lg active:scale-95 transition-all ${
                          hasEnough
                            ? 'bg-emerald-500 hover:bg-emerald-600'
                            : 'bg-red-500 hover:bg-red-600 animate-pulse'
                        }`}>
                        {hasEnough ? '置换（可继续）' : '余量不足'}
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* 保留并结束操作（始终可见） */}
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700">📦 保留并结束操作</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {decisionQuantity > 0
                        ? `${decisionQuantity} 张保留（公司已下市，终局无价值）`
                        : '无需保留，直接结束操作'}
                    </p>
                  </div>
                  <button onClick={() => handleDecision('hold', decisionQuantity)}
                    className="px-4 py-2 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 active:scale-95 transition-all font-medium">
                    保留 & 结束 → 下一人
                  </button>
                </div>
              </div>
              {/* 卖/换后剩余操作提示 */}
              <p className="text-xs text-slate-400 text-center">
                可以先卖/换多步，最后点「保留并结束」推进到下一位
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 text-center mt-3">
          {currentDecisionPid
            ? `${decisionPlayer?.name} 正在决策 (${merger.currentDecisionPlayerIndex + 1}/${merger.decisionQueue.length})`
            : `进入 ${String(gameState.phase) === 'buy_stocks' ? '购买股票' : '下一并购'}`}
        </p>
      </div>
    </div>
  );
}

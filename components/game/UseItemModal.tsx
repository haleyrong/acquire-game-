'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function UseItemModal({ isMyTurn }: { isMyTurn: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const placingUniversalTile = useGameStore((s) => s.placingUniversalTile);
  const skipUseItem = useGameStore((s) => s.doSkipUseItem);
  const startPlacingUniversal = useGameStore((s) => s.startPlacingUniversal);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState || gameState.phase !== 'use_item') return null;
  if (gameState.mode !== 'futures') return null;

  const player = getCurrentPlayer(gameState);
  const items = player.items || [];

  const handleUseUniversal = () => {
    startPlacingUniversal();
    setCollapsed(true); // 缩小弹窗，让用户点击棋盘
  };

  // 当用户点击棋盘某个空位后，万能板块被放置，placingUniversal 变回 false，恢复弹窗
  if (!placingUniversalTile && collapsed) {
    // 万能板块已使用完毕，弹窗应恢复正常以显示后续选项
    // 但实际应在 confirmPlaceTile 中清除状态后自然展示
  }

  if (collapsed) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50">
        <button onClick={() => setCollapsed(false)}
          className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-amber-600 animate-pulse">
          {placingUniversalTile ? '🃏 点击棋盘空位放置' : '🎒 使用道具'}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 max-w-sm w-full mx-4 relative">
        <button onClick={() => setCollapsed(true)}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 text-xs"
          title="缩小">−</button>

        <div className="text-center mb-4">
          <p className="text-3xl mb-2">🎒</p>
          <h2 className="text-lg font-bold text-slate-800">
            {isMyTurn ? '使用道具' : `${player.name} 正在使用道具`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">每回合限用1次</p>
        </div>

        {/* 万能板块提示 */}
        {placingUniversalTile && (
          <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-xl text-center">
            <p className="text-sm font-bold text-amber-800">👇 点击棋盘上空位放置万能板块</p>
            <p className="text-xs text-amber-600 mt-1">放置后可触发建立企业/并购等操作</p>
          </div>
        )}

        {/* 道具列表 */}
        <div className="space-y-2 mb-4">
          {items.filter((it) => it.quantity > 0).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">暂无道具</p>
          )}
          {items.filter((it) => it.quantity > 0).map((item) => (
            <div key={item.type} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <span className="text-2xl">🃏</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700">万能板块</div>
                <div className="text-xs text-slate-500">放置到任意空位，可触发企业/并购</div>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-amber-700">×{item.quantity}</span>
              </div>
              {isMyTurn && (
                <button onClick={handleUseUniversal}
                  className="ml-2 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 active:scale-95 transition-all shadow-sm">
                  使用
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 操作 */}
        {isMyTurn && (
          <button onClick={skipUseItem}
            className="w-full py-2.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 active:scale-[0.98] transition-all">
            ➡️ 跳过 · 进入购买股票
          </button>
        )}
        {!isMyTurn && (
          <p className="text-center text-sm text-slate-500 animate-pulse">⏳ 等待 {player.name} 选择...</p>
        )}
      </div>
    </div>
  );
}

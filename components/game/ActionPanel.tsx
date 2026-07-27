'use client';

import { useGameStore } from '@/store/gameStore';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export function ActionPanel({ isMyTurn = true }: { isMyTurn?: boolean }) {
  const gameState = useGameStore((s) => s.gameState);
  const devMode = useGameStore((s) => s.devMode);
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const confirmPlaceTile = useGameStore((s) => s.confirmPlaceTile);
  const finishBuying = useGameStore((s) => s.finishBuying);
  const canEndGame = useGameStore((s) => s.canEndGame);
  const declareEnd = useGameStore((s) => s.declareEnd);
  const message = useGameStore((s) => s.message);
  const clearMessage = useGameStore((s) => s.clearMessage);

  if (!gameState) return null;

  const player = getCurrentPlayer(gameState);
  const phase = gameState.phase;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      {/* 消息提示 */}
      {message && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-amber-700">⚠️ {message}</span>
          <button
            onClick={clearMessage}
            className="text-amber-500 hover:text-amber-700 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 开发者模式横幅 */}
      {devMode && (
        <div className="mb-3 p-2 bg-amber-100 border border-amber-300 rounded-lg text-center">
          <span className="text-xs font-semibold text-amber-800">
            🛠️ 开发者模式 — 任意选板块 · 跳过购物 · 无需抽牌
          </span>
        </div>
      )}

      {/* 当前阶段提示 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-lg font-bold text-slate-800">
            {player.name} 的回合
          </span>
          <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
            {phase === 'place_tile' && '📍 放置板块'}
            {phase === 'choose_hotel' && '🏨 选择酒店'}
            {phase === 'choose_acquirer' && '⚖️ 选择并购方'}
            {phase === 'buy_stocks' && '💰 购买股票'}
            {phase === 'merger_decisions' && '🤝 并购决策'}
            {phase === 'game_over' && '🏆 游戏结束'}
          </span>
        </div>

        {/* 现金 + 持股概览 */}
        <div className="text-right">
          <span className="text-sm font-mono font-bold text-emerald-600">
            ${player.cash.toLocaleString()}
          </span>
          {player.stocks.length > 0 && (
            <span className="ml-2 text-xs text-slate-400">
              {player.stocks.reduce((sum, s) => sum + s.quantity, 0)} 股
            </span>
          )}
        </div>
      </div>

      {/* 不是自己回合 */}
      {!isMyTurn && !devMode && phase !== 'game_over' && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <p className="text-sm text-slate-500">⏳ 等待对手操作...</p>
          <p className="text-xs text-slate-400 mt-1">
            当前阶段：{phase === 'place_tile' ? '放置板块' : phase === 'buy_stocks' ? '购买股票' : phase === 'merger_decisions' ? '并购决策' : '操作中'}
          </p>
        </div>
      )}

      {/* 操作按钮（仅自己回合） */}
      {(isMyTurn || devMode) && (
      <div className="flex gap-2">
        {/* 放置板块阶段 */}
        {phase === 'place_tile' && (
          <>
            <button
              disabled={!selectedTileId}
              onClick={() => confirmPlaceTile()}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  selectedTileId
                    ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              📍 放置板块
            </button>

            {/* 宣布游戏结束 */}
            {canEndGame() && (
              <button
                onClick={() => {
                  if (confirm('确定要宣布游戏结束吗？结束后将进行终局结算，所有股票按市价兑现。')) {
                    declareEnd();
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white
                           hover:bg-red-600 shadow-sm transition-all animate-pulse"
              >
                🏁 宣布游戏结束
              </button>
            )}
          </>
        )}

        {/* 购买股票阶段（dev模式不显示，因为自动跳过） */}
        {phase === 'buy_stocks' && !devMode && (
          <button
            onClick={finishBuying}
            className="w-full py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold
                       hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm"
          >
            ✅ 完成购买 · 补牌 · 结束回合
          </button>
        )}

        {/* 游戏结束 */}
        {phase === 'game_over' && (
          <div className="text-center w-full">
            <p className="text-lg font-bold text-amber-600">🏆 游戏结束！</p>
          </div>
        )}
      </div>
      )}

      <p className="text-xs text-slate-400 mt-2">
        {!isMyTurn && !devMode && phase !== 'game_over' && '请等待对手完成操作，棋盘会自动更新'}
        {devMode && phase === 'place_tile' && '在下方板块选择器中点选板块，再点棋盘空位放置'}
        {!devMode && isMyTurn && phase === 'place_tile' && '点击手牌选择板块，再点一次放置到棋盘'}
        {canEndGame() && phase === 'place_tile' && isMyTurn && ' ⚡ 已满足结束条件，可以宣布游戏结束！'}
        {phase === 'choose_hotel' && '请在弹窗中选择要激活的酒店连锁'}
        {phase === 'choose_acquirer' && '请在弹窗中选择并购方'}
        {phase === 'merger_decisions' && '并购正在进行，请在弹窗中做出决策'}
        {!devMode && phase === 'buy_stocks' &&
          `可购买 0~${gameState.config.maxBuyPerTurn - gameState.stocksBoughtThisTurn} 张股票（点击下方酒店选择数量）`}
        {phase === 'game_over' && '感谢参与！'}
      </p>
    </div>
  );
}

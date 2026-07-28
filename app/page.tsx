'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  GameBoard,
  PlayerHand,
  PlayerList,
  HotelPanel,
  StockMarket,
  ActionPanel,
  HotelChoiceModal,
  AcquirerChoiceModal,
  MergerModal,
  DevTilePicker,
  RoundHistory,
} from '@/components/game';

export default function Home() {
  const gameState = useGameStore((s) => s.gameState);
  const devMode = useGameStore((s) => s.devMode);
  const initGame = useGameStore((s) => s.initGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const toggleDevMode = useGameStore((s) => s.toggleDevMode);

  const [player1Name, setPlayer1Name] = useState('玩家1');
  const [player2Name, setPlayer2Name] = useState('玩家2');

  // ---- 开始界面 ----
  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              🏨 并购风云
            </h1>
            <p className="text-slate-500">经典地产投资桌游 · 网页版</p>
          </div>

          {/* 开始表单 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-semibold text-slate-700">开始新游戏</h2>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                👤 玩家 1
              </label>
              <input
                type="text"
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入名字"
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                👤 玩家 2
              </label>
              <input
                type="text"
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入名字"
                maxLength={10}
              />
            </div>

            <button
              onClick={() => initGame([player1Name || '玩家1', player2Name || '玩家2'])}
              disabled={!player1Name.trim() || !player2Name.trim()}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-lg
                         hover:bg-blue-600 active:scale-[0.98] transition-all
                         disabled:bg-slate-300 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              🎮 开始游戏
            </button>

            <p className="text-xs text-slate-400 text-center">
              Phase 1 · 本地双人 Hotseat 模式
            </p>
          </div>

          {/* 规则简介 */}
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              📖 游戏简介
            </h3>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• 放置板块，建立或扩张酒店连锁</li>
              <li>• 投资股票，等待酒店升值</li>
              <li>• 触发并购时可获得高额分红</li>
              <li>• 现金 + 股票总值最高者获胜</li>
            </ul>
          </div>

          {/* 在线模式入口 */}
          <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-center">
            <p className="text-xs text-slate-400 mb-2">
              想和朋友远程对战？
            </p>
            <a
              href="/lobby"
              className="text-sm text-blue-500 hover:text-blue-600 font-medium"
            >
              🌐 在线联机模式 →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- 游戏界面 ----
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* 顶栏 */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">🏨 并购风云</h1>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
            回合 {gameState.roundNumber}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* 开发者模式开关 */}
          <button
            onClick={toggleDevMode}
            className={`
              text-xs px-2.5 py-1 rounded-full font-medium transition-all
              ${devMode
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }
            `}
          >
            🛠️ {devMode ? '开发者模式 ON' : '开发者模式'}
          </button>
          <button
            onClick={resetGame}
            className="text-sm text-slate-500 hover:text-red-500 transition-colors"
          >
            退出游戏
          </button>
        </div>
      </header>

      {/* 弹窗 */}
      <HotelChoiceModal />
      <AcquirerChoiceModal />
      <MergerModal />

      {/* 主体 */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
        {/* 左侧：棋盘 */}
        <div className="flex-1 flex flex-col gap-4">
          {gameState.status === 'finished' ? (
            <GameOverScreen />
          ) : (
            <GameBoard />
          )}

          {/* 开发者模式：板块选择器 */}
          {devMode && <DevTilePicker />}

          {/* 底部：手牌 + 股票市场 + 操作 */}
          <div className="space-y-3">
            {!devMode && <PlayerHand />}
            {gameState.phase === 'buy_stocks' && !devMode && <StockMarket />}
            <ActionPanel />
          </div>
        </div>

        {/* 右侧：信息面板 */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          <PlayerList />
          <HotelPanel />
          <RoundHistory />
        </div>
      </main>
    </div>
  );
}

/** 游戏结束界面 */
function GameOverScreen() {
  const gameState = useGameStore((s) => s.gameState);
  const resetGame = useGameStore((s) => s.resetGame);

  if (!gameState) return null;

  // 计算每个玩家的板块数和现金
  const rankings = gameState.playerOrder.map((pid) => {
    const player = gameState.players[pid];
    const tileCount = Object.values(gameState.tiles).filter(
      (t) => t.placedBy === pid
    ).length;
    return { ...player, tileCount };
  });

  // 按现金排序
  rankings.sort((a, b) => b.cash - a.cash);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 max-w-md w-full text-center">
        <p className="text-5xl mb-4">🏆</p>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">游戏结束！</h2>
        <p className="text-slate-500 mb-6">感谢参与</p>

        <div className="space-y-3 mb-6">
          {rankings.map((player, index) => (
            <div
              key={player.id}
              className={`
                flex items-center justify-between p-3 rounded-xl
                ${index === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </span>
                <span className="font-medium text-slate-700">{player.name}</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-emerald-600">
                  ${player.cash.toLocaleString()}
                </span>
                <p className="text-xs text-slate-400">
                  放置 {player.tileCount} 块
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={resetGame}
          className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold
                     hover:bg-blue-600 active:scale-[0.98] transition-all"
        >
          🔄 再来一局
        </button>
      </div>
    </div>
  );
}

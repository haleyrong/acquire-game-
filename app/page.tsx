'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { initFuturesConfig } from '@/lib/engine/GameEngine';
import {
  GameBoard,
  PlayerHand,
  PlayerList,
  HotelPanel,
  ActionPanel,
  HotelChoiceModal,
  AcquirerChoiceModal,
  MergerModal,
  DevTilePicker,
  RoundHistory,
  ThisRoundPanel,
  BuyStockModal,
  ShopModal,
  UseItemModal,
} from '@/components/game';

export default function Home() {
  const gameState = useGameStore((s) => s.gameState);
  const devMode = useGameStore((s) => s.devMode);
  const initGame = useGameStore((s) => s.initGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const toggleDevMode = useGameStore((s) => s.toggleDevMode);

  const [showTurnToast, setShowTurnToast] = useState(false);
  const prevTurnRef = useRef<string | null>(null);

  // 回合切换提示
  useEffect(() => {
    if (!gameState) return;
    const turnKey = `${gameState.currentPlayerIndex}-${gameState.roundNumber}`;
    if (turnKey !== prevTurnRef.current) {
      prevTurnRef.current = turnKey;
      setShowTurnToast(true);
      const t = setTimeout(() => setShowTurnToast(false), 1500);
      return () => clearTimeout(t);
    }
  }, [gameState?.currentPlayerIndex, gameState?.roundNumber]);

  const [gameMode, setGameMode] = useState<'classic' | 'futures'>('classic');
  const [player1Name, setPlayer1Name] = useState('玩家1');
  const [player2Name, setPlayer2Name] = useState('玩家2');

  // ---- 开始界面 ----
  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-extrabold mb-3 tracking-wide text-amber-400"
              style={{ textShadow: '0 2px 8px rgba(196,150,10,0.3)' }}>
              🏨 并购风云
            </h1>
            <p className="text-amber-200/70 text-sm tracking-wider">经典地产投资桌游 · 网页版</p>
          </div>

          {/* 开始表单 */}
          <div className="bg-surface backdrop-blur rounded-2xl p-6 shadow-md border border-card-border/50 space-y-4">
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

            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              <button
                onClick={() => setGameMode('classic')}
                className={`flex-1 py-2 text-sm font-medium ${gameMode === 'classic' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'}`}>
                🏛️ 经典
              </button>
              <button
                onClick={() => setGameMode('futures')}
                className={`flex-1 py-2 text-sm font-medium ${gameMode === 'futures' ? 'bg-purple-500 text-white' : 'bg-white text-slate-600'}`}>
                📈 期货
              </button>
            </div>

            <button
              onClick={() => initGame([player1Name || '玩家1', player2Name || '玩家2'], gameMode)}
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
          <div className="mt-6 bg-surface backdrop-blur rounded-2xl p-6 shadow-md border border-card-border/50">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              📖 游戏简介
            </h3>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• 放置板块，建立或扩张企业连锁</li>
              <li>• 投资股票，等待酒店升值</li>
              <li>• 触发并购时可获得高额分红</li>
              <li>• 现金 + 股票总值最高者获胜</li>
            </ul>
          </div>

          {/* 在线模式入口 */}
          <div className="mt-4 bg-surface backdrop-blur rounded-2xl p-4 shadow-md border border-card-border/50 text-center">
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
      {/* 轮到你的提示 */}
      {showTurnToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-xl text-lg font-bold">
            🎯 到你了！
          </div>
        </div>
      )}

      {/* 顶栏 */}
      <header className="bg-surface/90 backdrop-blur border-b border-card-border/30 px-4 py-2 flex items-center justify-between shrink-0">
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
      {gameState.phase === 'use_item' && gameState.mode === 'futures' && <UseItemModal isMyTurn={true} />}
      {gameState.phase === 'buy_stocks' && <BuyStockModal isMyTurn={true} />}
      {gameState.phase === 'shop' && gameState.mode === 'futures' && <ShopModal isMyTurn={true} />}
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
            <ActionPanel />
          </div>
        </div>

        {/* 右侧：信息面板 */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          <PlayerList />
          <ThisRoundPanel />
          <RoundHistory />
          <HotelPanel />
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
      <div className="bg-surface backdrop-blur rounded-2xl p-8 shadow-lg border border-card-border/50 max-w-md w-full text-center">
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

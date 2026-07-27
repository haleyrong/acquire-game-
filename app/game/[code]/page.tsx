'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { supabase } from '@/lib/supabase/client';
import {
  GameBoard, PlayerHand, PlayerList, GameLog, HotelPanel,
  StockMarket, ActionPanel, HotelChoiceModal, AcquirerChoiceModal,
  MergerModal, DevTilePicker,
} from '@/components/game';
import { getCurrentPlayer } from '@/lib/engine/GameEngine';

export default function GameRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string)?.toUpperCase() || '';
  const pid = searchParams.get('pid') || '';

  const store = useGameStore();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code || !pid) return;

    async function load() {
      try {
        // 1. 查询游戏ID
        const { data: game, error: gameErr } = await supabase
          .from('games')
          .select('id')
          .eq('code', code)
          .maybeSingle();

        if (gameErr) throw new Error(`查询游戏失败: ${gameErr.message}`);
        if (!game) { setErrorMsg(`游戏 ${code} 不存在`); setStatus('error'); return; }

        // 2. 查询玩家
        const { data: dbPlayers, error: playerErr } = await supabase
          .from('players')
          .select('id,display_name')
          .eq('game_id', game.id)
          .order('turn_order');

        if (playerErr) throw new Error(`查询玩家失败: ${playerErr.message}`);
        if (!dbPlayers || dbPlayers.length === 0) { setErrorMsg('游戏没有玩家'); setStatus('error'); return; }

        // 3. 用本地引擎创建游戏
        const playerNames = dbPlayers.map((p) => p.display_name);
        store.initGame(playerNames);

        // 4. 获取创建后的状态，覆盖玩家 ID 为数据库 ID
        const state = useGameStore.getState().gameState;
        if (!state) { setErrorMsg('引擎初始化失败'); setStatus('error'); return; }

        const newOrder: string[] = [];
        for (let i = 0; i < dbPlayers.length; i++) {
          const localId = state.playerOrder[i];
          const dbId = dbPlayers[i].id;
          state.players[dbId] = state.players[localId];
          state.players[dbId].id = dbId;
          delete state.players[localId];
          newOrder.push(dbId);
        }
        state.playerOrder = newOrder;
        state.gameId = game.id;

        useGameStore.setState({ gameState: { ...state } });
        setStatus('ready');
      } catch (e) {
        setErrorMsg(`${(e as Error).message}`);
        setStatus('error');
      }
    }

    load();
  }, []); // eslint-disable-line

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-3xl mb-2 animate-bounce">🎲</p>
          <p className="text-slate-500">加载中...</p>
          <p className="text-xs text-slate-400 mt-1">房间 {code}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="text-4xl mb-4">😢</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">加载失败</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-left break-all">
            <p className="text-sm text-red-600 whitespace-pre-wrap">{errorMsg}</p>
          </div>
          <a href="/lobby" className="text-sm text-blue-500 hover:text-blue-600">返回大厅</a>
        </div>
      </div>
    );
  }

  return <GameUI code={code} />;
}

function GameUI({ code }: { code: string }) {
  const gameState = useGameStore((s) => s.gameState);
  const devMode = useGameStore((s) => s.devMode);
  const toggleDevMode = useGameStore((s) => s.toggleDevMode);
  const resetGame = useGameStore((s) => s.resetGame);

  if (!gameState) return null;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">🏨 并购风云</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">房间 {code}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleDevMode} className={`text-xs px-2.5 py-1 rounded-full font-medium ${devMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
            🛠️ {devMode ? 'ON' : ''}
          </button>
          <a href="/lobby" onClick={resetGame} className="text-sm text-slate-500 hover:text-red-500">退出</a>
        </div>
      </header>

      <HotelChoiceModal />
      <AcquirerChoiceModal />
      <MergerModal />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
        <div className="flex-1 flex flex-col gap-4">
          {gameState.status === 'finished' ? <GameOverScreen /> : <GameBoard />}
          {devMode && <DevTilePicker />}
          <div className="space-y-3">
            {!devMode && <PlayerHand />}
            {gameState.phase === 'buy_stocks' && !devMode && <StockMarket />}
            <ActionPanel />
          </div>
        </div>
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          <PlayerList />
          <HotelPanel />
          <GameLog />
        </div>
      </main>
    </div>
  );
}

function GameOverScreen() {
  const gameState = useGameStore((s) => s.gameState);
  const resetGame = useGameStore((s) => s.resetGame);
  if (!gameState) return null;

  const rankings = gameState.playerOrder
    .map((pid) => ({ ...gameState.players[pid], tileCount: Object.values(gameState.tiles).filter((t) => t.placedBy === pid).length }))
    .sort((a, b) => b.cash - a.cash);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 max-w-md w-full text-center">
        <p className="text-5xl mb-4">🏆</p>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">游戏结束！</h2>
        <div className="space-y-3 mb-6">
          {rankings.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
              <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span className="font-medium text-slate-700">{p.name}</span>
              <span className="font-mono font-bold text-emerald-600">${p.cash.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <a href="/lobby" onClick={resetGame} className="block w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600">返回大厅</a>
      </div>
    </div>
  );
}

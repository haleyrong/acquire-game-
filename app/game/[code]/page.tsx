'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { supabase } from '@/lib/supabase/client';
import {
  placeTile, foundHotel, chooseAcquirer, buyStock,
  completeStockBuying, makeMergerDecision,
  finishMergerDecisions, declareGameEnd, getCurrentPlayer,
} from '@/lib/engine/GameEngine';
import {
  GameBoard, PlayerHand, PlayerList, GameLog, HotelPanel,
  StockMarket, ActionPanel, HotelChoiceModal, AcquirerChoiceModal,
  MergerModal, DevTilePicker,
} from '@/components/game';

export default function GameRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = (params.code as string)?.toUpperCase() || '';
  const pid = searchParams.get('pid') || '';
  const isHost = searchParams.get('host') === 'true';

  const store = useGameStore();
  const [status, setStatus] = useState<'loading' | 'waiting' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [joinedPlayers, setJoinedPlayers] = useState<{ id: string; name: string }[]>([]);
  const gameIdRef = useRef<string>('');
  const processedLogIds = useRef<Set<string>>(new Set());

  // ==== 加载房间 ====
  const loadRoom = useCallback(async () => {
    if (!code || !pid) return;
    try {
      const { data: game, error: gameErr } = await supabase
        .from('games').select('id,status').eq('code', code).maybeSingle();
      if (gameErr) { setErrorMsg(gameErr.message); setStatus('error'); return; }
      if (!game) { setErrorMsg('游戏不存在'); setStatus('error'); return; }
      gameIdRef.current = game.id;

      // 查询玩家
      const { data: players } = await supabase
        .from('players').select('id,display_name').eq('game_id', game.id).order('turn_order');
      if (!players) { setErrorMsg('无玩家'); setStatus('error'); return; }
      setJoinedPlayers(players.map((p) => ({ id: p.id, name: p.display_name })));

      if (game.status === 'playing') {
        initEngine(players.map((p) => p.display_name), players);
        setStatus('playing');
      } else {
        setStatus('waiting');
      }
    } catch (e) {
      setErrorMsg(`${(e as Error).message}`);
      setStatus('error');
    }
  }, [code, pid]);

  const initEngine = (names: string[], players: { id: string }[]) => {
    store.initGame(names);
    const s = useGameStore.getState().gameState;
    if (!s) return;
    const order: string[] = [];
    for (let i = 0; i < players.length; i++) {
      const lid = s.playerOrder[i];
      s.players[players[i].id] = s.players[lid];
      s.players[players[i].id].id = players[i].id;
      delete s.players[lid];
      order.push(players[i].id);
    }
    s.playerOrder = order;
    s.gameId = gameIdRef.current;
    useGameStore.setState({ gameState: { ...s } });
  };

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // ==== 等待室：轮询检查游戏是否开始和新玩家加入 ====
  useEffect(() => {
    if (status !== 'waiting') return;
    const id = setInterval(async () => {
      try {
        const { data: game } = await supabase
          .from('games').select('status').eq('id', gameIdRef.current).maybeSingle();
        if (game?.status === 'playing') {
          const { data: pl } = await supabase
            .from('players').select('id,display_name').eq('game_id', gameIdRef.current).order('turn_order');
          if (pl && pl.length >= 2) {
            initEngine(pl.map((x) => x.display_name), pl);
            setStatus('playing');
          }
        }
        // 检查新玩家
        const { data: pl } = await supabase
          .from('players').select('id,display_name').eq('game_id', gameIdRef.current).order('turn_order');
        if (pl) setJoinedPlayers(pl.map((x) => ({ id: x.id, name: x.display_name })));
      } catch {} // eslint-disable-line
    }, 2000);
    return () => clearInterval(id);
  }, [status]); // eslint-disable-line

  // ==== 游戏中：轮询同步操作 ====
  useEffect(() => {
    if (status !== 'playing') return;

    // 设置 local → remote 同步
    store.setRemoteHandler(async (action, payload, playerId) => {
      if (playerId !== pid) return;
      const p = useGameStore.getState().gameState?.players[playerId];
      const { error } = await supabase.from('game_log').insert({
        game_id: gameIdRef.current, player_id: playerId, action,
        description: `${p?.name || '?'}: ${action}`, payload,
      });
      if (error) console.error('写入 game_log 失败:', error);
    });

    // 轮询获取远程操作（每1.5秒）
    const id = setInterval(async () => {
      try {
        const { data: logs } = await supabase
          .from('game_log')
          .select('id,action,payload,player_id')
          .eq('game_id', gameIdRef.current)
          .order('created_at', { ascending: true })
          .limit(30);

        if (logs && logs.length > 0) {
          let changed = false;
          const s = useGameStore.getState().gameState;
          if (!s) return;

          for (const log of logs) {
            // 跳过已处理的
            if (processedLogIds.current.has(log.id)) continue;
            processedLogIds.current.add(log.id);
            // 跳过自己的
            if ((log.player_id as string) === pid) continue;
            // 重放远程操作
            applyRemoteAction(s, log.action as string, (log.payload || {}) as Record<string, unknown>, log.player_id as string);
            changed = true;
          }

          if (changed) {
            useGameStore.setState({ gameState: { ...s } });
          }
        }
      } catch (e) { console.error('轮询失败:', e); }
    }, 1500);

    return () => {
      clearInterval(id);
      store.setRemoteHandler(null);
    };
  }, [status]); // eslint-disable-line

  // ==== 房主开始游戏 ====
  const handleStart = useCallback(async () => {
    if (!gameIdRef.current) return;
    const { error } = await supabase.from('games').update({ status: 'playing' }).eq('id', gameIdRef.current);
    if (error) { setErrorMsg(error.message); return; }
    initEngine(joinedPlayers.map((p) => p.name), joinedPlayers);
    setStatus('playing');
  }, [joinedPlayers]);

  // ==== 渲染 ====
  if (status === 'loading') return <CenterMsg icon="🎲" msg="加载中..." sub={`房间 ${code}`} />;
  if (status === 'error') return <CenterMsg icon="😢" msg="加载失败" sub={errorMsg} extra={<BackBtn />} />;

  if (status === 'waiting') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 max-w-sm w-full text-center">
          <p className="text-4xl mb-4">⏳</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">等待玩家加入</h2>
          <p className="text-sm text-slate-500 mb-1">
            房间码: <span className="text-2xl font-bold tracking-widest text-blue-600">{code}</span>
          </p>
          <p className="text-xs text-slate-400 mb-6">把房间码发给朋友即可加入</p>

          <div className="space-y-2 mb-6 text-left">
            {joinedPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <span className="text-sm text-slate-700">{p.name}{i === 0 ? ' (房主)' : ''}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 6 - joinedPlayers.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg opacity-40">
                <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">?</span>
                <span className="text-sm text-slate-400">等待中...</span>
              </div>
            ))}
          </div>

          {isHost && joinedPlayers.length >= 2 && (
            <button onClick={handleStart} className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 active:scale-[0.98] transition-all">
              🚀 开始游戏
            </button>
          )}
          {isHost && joinedPlayers.length < 2 && (
            <p className="text-xs text-slate-400">至少需要2名玩家才能开始</p>
          )}
          {!isHost && (
            <p className="text-sm text-slate-500 animate-pulse">等待房主开始游戏...</p>
          )}
          <a href="/lobby" className="block mt-4 text-xs text-slate-400 hover:text-red-400">退出房间</a>
        </div>
      </div>
    );
  }

  return <GameUI code={code} pid={pid} />;
}

// ==== 远程操作重放 ====
function applyRemoteAction(
  state: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>,
  action: string, payload: Record<string, unknown>, playerId: string
) {
  const p = state.players[playerId];
  switch (action) {
    case 'PLACE_TILE': {
      const tid = payload.tileId as string;
      if (!tid || !p) return;
      if (!p.handTileIds.includes(tid)) p.handTileIds.push(tid);
      placeTile(state, tid);
      break;
    }
    case 'FOUND_HOTEL': { const hid = payload.hotelId as string; if (hid) foundHotel(state, hid); break; }
    case 'CHOOSE_ACQUIRER': { const sid = payload.survivorId as string; if (sid) chooseAcquirer(state, sid); break; }
    case 'BUY_STOCK': { const hid = payload.hotelId as string; const qty = payload.quantity as number; if (hid && qty) buyStock(state, hid, qty); break; }
    case 'FINISH_BUYING': completeStockBuying(state); break;
    case 'MERGER_DECISION': makeMergerDecision(state, (payload.mergerIndex as number) ?? 0, playerId, payload.decision as 'sell'|'trade'|'hold', (payload.quantity as number) || 0); break;
    case 'FINISH_MERGERS': finishMergerDecisions(state); break;
    case 'DECLARE_END': declareGameEnd(state); break;
  }
}

// ==== 游戏界面 ====
function GameUI({ code, pid }: { code: string; pid: string }) {
  const gameState = useGameStore((s) => s.gameState);
  const devMode = useGameStore((s) => s.devMode);
  const toggleDevMode = useGameStore((s) => s.toggleDevMode);
  const resetGame = useGameStore((s) => s.resetGame);
  if (!gameState) return null;

  const player = getCurrentPlayer(gameState);
  const isMyTurn = player.id === pid;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">🏨 并购风云</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">房间 {code}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isMyTurn ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
            {isMyTurn ? '✅ 你的回合' : '⏳ 对方回合'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleDevMode} className={`text-xs px-2.5 py-1 rounded-full font-medium ${devMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>🛠️</button>
          <a href="/lobby" onClick={resetGame} className="text-sm text-slate-500 hover:text-red-500">退出</a>
        </div>
      </header>

      <HotelChoiceModal />
      <AcquirerChoiceModal />
      <MergerModal />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
        <div className="flex-1 flex flex-col gap-4">
          {gameState.status === 'finished' ? <GameOverScreen /> : <GameBoard readOnly={!isMyTurn} />}
          {devMode && <DevTilePicker />}
          <div className="space-y-3">
            {!devMode && <PlayerHand isMyTurn={isMyTurn} />}
            {gameState.phase === 'buy_stocks' && !devMode && <StockMarket />}
            <ActionPanel isMyTurn={isMyTurn} />
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

function CenterMsg({ icon, msg, sub, extra }: { icon: string; msg: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-3xl mb-2 animate-bounce">{icon}</p>
        <p className="text-slate-500">{msg}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        {extra}
      </div>
    </div>
  );
}

function BackBtn() {
  return <a href="/lobby" className="text-sm text-blue-500 hover:text-blue-600">返回大厅</a>;
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
              <span className="font-medium">{p.name}</span>
              <span className="font-mono font-bold text-emerald-600">${p.cash.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <a href="/lobby" onClick={resetGame} className="block w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600">返回大厅</a>
      </div>
    </div>
  );
}

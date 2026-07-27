'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { supabase } from '@/lib/supabase/client';
import * as Engine from '@/lib/engine/GameEngine';
import {
  GameBoard, PlayerHand, PlayerList, GameLog, HotelPanel,
  StockMarket, ActionPanel, HotelChoiceModal, AcquirerChoiceModal,
  MergerModal, DevTilePicker,
} from '@/components/game';

export default function GameRoomPage() {
  const { code: _code } = useParams();
  const sp = useSearchParams();
  const code = (_code as string)?.toUpperCase() || '';
  const pid = sp.get('pid') || '';
  const isHost = sp.get('host') === 'true';

  const [status, setStatus] = useState<'loading' | 'waiting' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const gameIdRef = useRef('');
  const seenLogIds = useRef(new Set<string>());

  // 从 JSON 快照加载游戏状态
  const loadFromSnapshot = (snapshot: Record<string, unknown>) => {
    const s = snapshot as unknown as ReturnType<typeof useGameStore.getState>['gameState'];
    if (!s) return false;
    useGameStore.setState({ gameState: s });
    return true;
  };

  // 加载房间
  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from('games').select('id,status,state_snapshot')
        .eq('code', code).maybeSingle();
      if (!g) return setErrorMsg('游戏不存在'), setStatus('error');
      gameIdRef.current = g.id;
      const { data: pl } = await supabase.from('players').select('id,display_name')
        .eq('game_id', g.id).order('turn_order');
      if (!pl?.length) return setErrorMsg('无玩家'), setStatus('error');
      setPlayers(pl.map(p => ({ id: p.id, name: p.display_name })));

      if (g.status === 'playing' && g.state_snapshot) {
        // 从快照加载
        if (loadFromSnapshot(g.state_snapshot as Record<string, unknown>)) {
          setStatus('playing');
        } else {
          setErrorMsg('快照加载失败');
          setStatus('error');
        }
      } else {
        setStatus('waiting');
      }
    })();
  }, [code]);

  // 等待室轮询
  useEffect(() => {
    if (status !== 'waiting') return;
    const i = setInterval(async () => {
      const { data: g } = await supabase.from('games')
        .select('status,state_snapshot').eq('id', gameIdRef.current).maybeSingle();
      const { data: pl } = await supabase.from('players')
        .select('id,display_name').eq('game_id', gameIdRef.current).order('turn_order');
      if (pl) setPlayers(pl.map(p => ({ id: p.id, name: p.display_name })));
      if (g?.status === 'playing' && g.state_snapshot && pl && pl.length >= 2) {
        if (loadFromSnapshot(g.state_snapshot as Record<string, unknown>)) {
          setStatus('playing');
        }
      }
    }, 2000);
    return () => clearInterval(i);
  }, [status]);

  // 本地操作写入 game_log
  useEffect(() => {
    if (status !== 'playing') return;
    const store = useGameStore.getState();
    store.setRemoteHandler(async (action, payload, playerId) => {
      if (playerId !== pid) return;
      await supabase.from('game_log').insert({
        game_id: gameIdRef.current, player_id: playerId, action,
        description: action, payload,
      });
    });
  }, [status, pid]);

  // 轮询 game_log 并重放
  useEffect(() => {
    if (status !== 'playing') return;
    const i = setInterval(async () => {
      const { data: logs } = await supabase.from('game_log')
        .select('*').eq('game_id', gameIdRef.current)
        .order('created_at', { ascending: true }).limit(100);
      if (!logs?.length) return;

      let changed = false;
      const s = useGameStore.getState().gameState;
      if (!s) return;

      for (const log of logs) {
        if (seenLogIds.current.has(log.id)) continue;
        seenLogIds.current.add(log.id);
        if (log.player_id === pid) continue;
        replayAction(s, log.action, (log.payload || {}) as Record<string, unknown>, log.player_id);
        changed = true;
      }
      if (changed) useGameStore.setState({ gameState: { ...s } });
    }, 1500);
    return () => clearInterval(i);
  }, [status, pid]);

  // 房主开始游戏：创建状态 + 存快照
  const startGame = async () => {
    const names = players.map(p => p.name);
    useGameStore.getState().initGame(names);
    const s = useGameStore.getState().gameState!;
    // 用数据库 ID 替换本地 ID
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

    // 存快照到数据库
    await supabase.from('games').update({
      status: 'playing',
      state_snapshot: JSON.parse(JSON.stringify(s)),
    }).eq('id', gameIdRef.current);

    setStatus('playing');
  };

  if (status === 'loading') return <Center icon="🎲" msg="加载中..." sub={code} />;
  if (status === 'error') return <Center icon="😢" msg="加载失败" sub={errorMsg} />;

  if (status === 'waiting') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 max-w-sm w-full text-center">
          <p className="text-4xl mb-4">⏳</p>
          <h2 className="text-xl font-bold text-slate-800 mb-2">等待玩家加入</h2>
          <p className="text-sm text-slate-500 mb-1">房间码: <span className="text-2xl font-bold tracking-widest text-blue-600">{code}</span></p>
          <p className="text-xs text-slate-400 mb-6">把房间码发给朋友</p>
          <div className="space-y-2 mb-6 text-left">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{i+1}</span>
                <span className="text-sm text-slate-700">{p.name}{i===0?' (房主)':''}</span>
              </div>
            ))}
          </div>
          {isHost && players.length >= 2 && <button onClick={startGame} className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600">🚀 开始游戏</button>}
          {isHost && players.length < 2 && <p className="text-xs text-slate-400">至少需要2名玩家</p>}
          {!isHost && <p className="text-sm text-slate-500 animate-pulse">等待房主开始游戏...</p>}
          <a href="/lobby" className="block mt-4 text-xs text-slate-400 hover:text-red-400">退出</a>
        </div>
      </div>
    );
  }

  return <GameUI code={code} pid={pid} />;
}

function replayAction(s: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>, action: string, payload: Record<string, unknown>, playerId: string) {
  const p = s.players[playerId];
  try {
    switch (action) {
      case 'PLACE_TILE': {
        const tid = payload.tileId as string;
        if (tid && p) { if (!p.handTileIds.includes(tid)) p.handTileIds.push(tid); Engine.placeTile(s, tid); }
        break;
      }
      case 'FOUND_HOTEL': { const h = payload.hotelId as string; if (h) Engine.foundHotel(s, h); break; }
      case 'CHOOSE_ACQUIRER': { const h = payload.survivorId as string; if (h) Engine.chooseAcquirer(s, h); break; }
      case 'BUY_STOCK': { Engine.buyStock(s, payload.hotelId as string, payload.quantity as number); break; }
      case 'FINISH_BUYING': Engine.completeStockBuying(s); break;
      case 'MERGER_DECISION': Engine.makeMergerDecision(s, (payload.mergerIndex as number)??0, playerId, payload.decision as 'sell'|'trade'|'hold', (payload.quantity as number)||0); break;
      case 'DECLARE_END': Engine.declareGameEnd(s); break;
    }
  } catch(e) { console.error('重放失败:', action, e); }
}

function GameUI({ code, pid }: { code: string; pid: string }) {
  const gs = useGameStore(s => s.gameState);
  const dev = useGameStore(s => s.devMode);
  if (!gs) return null;
  const player = Engine.getCurrentPlayer(gs);
  const myTurn = player.id === pid;
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">🏨 并购风云</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">房间 {code}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${myTurn?'bg-green-100 text-green-600':'bg-orange-100 text-orange-600'}`}>{myTurn?'✅ 你的回合':'⏳ 对方回合'}</span>
        </div>
        <a href="/lobby" className="text-sm text-slate-500 hover:text-red-500">退出</a>
      </header>
      <HotelChoiceModal /><AcquirerChoiceModal /><MergerModal />
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
        <div className="flex-1 flex flex-col gap-4">
          {gs.status==='finished' ? <OverScreen /> : <GameBoard readOnly={!myTurn} />}
          {dev && <DevTilePicker />}
          <div className="space-y-3">
            {!dev && <PlayerHand isMyTurn={myTurn} />}
            {gs.phase==='buy_stocks' && !dev && <StockMarket />}
            <ActionPanel isMyTurn={myTurn} />
          </div>
        </div>
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4"><PlayerList /><HotelPanel /><GameLog /></div>
      </main>
    </div>
  );
}

function Center({ icon, msg, sub }: { icon: string; msg: string; sub?: string }) {
  return <div className="flex-1 flex items-center justify-center"><div className="text-center"><p className="text-3xl mb-2 animate-bounce">{icon}</p><p className="text-slate-500">{msg}</p>{sub && <p className="text-xs text-slate-400 mt-1">房间 {sub}</p>}</div></div>;
}

function OverScreen() {
  const gs = useGameStore(s => s.gameState);
  if (!gs) return null;
  const ranks = gs.playerOrder.map(pid => ({ ...gs.players[pid] })).sort((a,b) => b.cash-a.cash);
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 max-w-md w-full text-center">
        <p className="text-5xl mb-4">🏆</p><h2 className="text-2xl font-bold text-slate-800 mb-2">游戏结束！</h2>
        <div className="space-y-3 mb-6">
          {ranks.map((p,i) => <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${i===0?'bg-amber-50 border border-amber-200':'bg-slate-50'}`}><span className="text-2xl">{i===0?'🥇':i===1?'🥈':'🥉'}</span><span className="font-medium">{p.name}</span><span className="font-mono font-bold text-emerald-600">${p.cash.toLocaleString()}</span></div>)}
        </div>
        <a href="/lobby" className="block w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600">返回大厅</a>
      </div>
    </div>
  );
}

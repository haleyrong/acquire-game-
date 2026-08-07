'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { supabase } from '@/lib/supabase/client';
import { debugLog } from '@/components/game/DebugLog';
import * as Engine from '@/lib/engine/GameEngine';
import {
  GameBoard, PlayerHand, PlayerList, HotelPanel, RoundHistory, ThisRoundPanel,
  ActionPanel, HotelChoiceModal, AcquirerChoiceModal,
  MergerModal, DevTilePicker, BuyStockModal, ShopModal, UseItemModal, DebugLogPanel,
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
  const localSnapshotVer = useRef(0); // 本地版本号，比对是否要更新

  // === 快照加载 ===
  const loadSnapshot = useCallback((snap: Record<string, unknown>, ver: number) => {
    if (ver <= localSnapshotVer.current) return false;
    const s = snap as unknown as ReturnType<typeof useGameStore.getState>['gameState'];
    if (!s) return false;
    useGameStore.setState({ gameState: s, selectedTileId: null });
    localSnapshotVer.current = ver;
    return true;
  }, []);

  // === 保存快照 ===
  const saveSnapshot = useCallback(async () => {
    const s = useGameStore.getState().gameState;
    if (!s || !gameIdRef.current) { debugLog('saveSnapshot: 无状态或无gameId', 'warn'); return; }
    const newVer = localSnapshotVer.current + 1;
    localSnapshotVer.current = newVer;
    const snap = JSON.parse(JSON.stringify(s));
    snap._ver = newVer;
    const { error } = await supabase.from('games').update({ state_snapshot: snap }).eq('id', gameIdRef.current);
    if (error) {
      debugLog('saveSnapshot 写入失败: ' + error.message, 'error');
    } else {
      debugLog(`saveSnapshot: ver=${newVer} phase=${snap.phase} player=${snap.currentPlayerIndex} 写入成功`);
    }
  }, []);

  // === 加载房间 ===
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
        const snap = g.state_snapshot as Record<string, unknown>;
        loadSnapshot(snap, (snap._ver as number) || 0);
        setStatus('playing');
      } else {
        setStatus('waiting');
      }
    })();
  }, [code, loadSnapshot]);

  // === 等待室轮询 ===
  useEffect(() => {
    if (status !== 'waiting') return;
    const i = setInterval(async () => {
      try {
        const { data: g } = await supabase.from('games')
          .select('status,state_snapshot').eq('id', gameIdRef.current).maybeSingle();
        const { data: pl } = await supabase.from('players')
          .select('id,display_name').eq('game_id', gameIdRef.current).order('turn_order');
        if (pl) setPlayers(pl.map(p => ({ id: p.id, name: p.display_name })));
        if (g?.status === 'playing' && g.state_snapshot && pl?.length) {
          const snap = g.state_snapshot as Record<string, unknown>;
          loadSnapshot(snap, (snap._ver as number) || 0);
          setStatus('playing');
        }
      } catch {} // eslint-disable-line
    }, 2000);
    return () => clearInterval(i);
  }, [status, loadSnapshot]);

  // === 每步操作后自动存快照 ===
  useEffect(() => {
    if (status !== 'playing') return;
    debugLog(`安装 remoteHandler, pid=${pid}`);
    useGameStore.getState().setRemoteHandler(async (action, payload, playerId) => {
      debugLog(`remoteHandler触发: action=${action} playerId=${playerId} pidCheck=${playerId === pid}`);
      await saveSnapshot();
    });
  }, [status, pid, saveSnapshot]);

  // === 轮询快照（纯快照，不重放） ===
  useEffect(() => {
    if (status !== 'playing') return;
    let pollCount = 0;
    const i = setInterval(async () => {
      try {
        pollCount++;
        const { data: g, error } = await supabase.from('games')
          .select('state_snapshot').eq('id', gameIdRef.current).single();
        if (error) { debugLog('轮询读失败: ' + error.message, 'warn'); return; }
        if (!g?.state_snapshot) {
          if (pollCount <= 4) debugLog('轮询: state_snapshot 为空');
          return;
        }
        const snap = g.state_snapshot as Record<string, unknown>;
        const remoteVer = (snap._ver as number) || 0;
        if (remoteVer > localSnapshotVer.current) {
          debugLog(`轮询: 检测到新版本 ver=${remoteVer} (本地=${localSnapshotVer.current})，加载中...`);
          loadSnapshot(snap, remoteVer);
          debugLog('轮询: 快照加载完成');
        }
      } catch (e) {
        debugLog('轮询异常: ' + (e as Error).message, 'warn');
      }
    }, 1500);
    return () => clearInterval(i);
  }, [status, pid, loadSnapshot]);

  // === 房主开始 ===
  const startGame = async () => {
    const names = players.map(p => p.name);
    useGameStore.getState().initGame(names);
    const s = useGameStore.getState().gameState!;
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
    localSnapshotVer.current = 1;
    const snap = JSON.parse(JSON.stringify(s));
    snap._ver = 1;
    await supabase.from('games').update({ status: 'playing', state_snapshot: snap }).eq('id', gameIdRef.current);
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

function GameUI({ code, pid }: { code: string; pid: string }) {
  const gs = useGameStore(s => s.gameState);
  const dev = useGameStore(s => s.devMode);
  const [showTurnToast, setShowTurnToast] = useState(false);
  const prevTurnRef = useRef<string | null>(null);

  if (!gs) return null;
  const player = Engine.getCurrentPlayer(gs);
  const myTurn = player.id === pid;

  // 检测回合切换到自己时弹出提示
  useEffect(() => {
    const turnKey = `${gs.currentPlayerIndex}-${gs.roundNumber}`;
    if (myTurn && turnKey !== prevTurnRef.current) {
      prevTurnRef.current = turnKey;
      setShowTurnToast(true);
      const t = setTimeout(() => setShowTurnToast(false), 1500);
      return () => clearTimeout(t);
    }
    if (!myTurn) {
      prevTurnRef.current = null;
    }
  }, [gs.currentPlayerIndex, gs.roundNumber, myTurn]);

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

      <header className="bg-surface/90 backdrop-blur border-b border-card-border/30 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">🏨 并购风云</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">房间 {code}</span>
          <span className="text-lg font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full">回合 {gs.roundNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${myTurn?'bg-green-100 text-green-600':'bg-orange-100 text-orange-600'}`}>{myTurn?'✅ 你的回合':'⏳ 对方回合'}</span>
        </div>
        <a href="/lobby" className="text-sm text-slate-500 hover:text-red-500">退出</a>
      </header>
      {/* 只有自己回合才显示交互弹窗，其他人看到等待提示 */}
      {myTurn ? <HotelChoiceModal /> : gs.phase === 'choose_hotel' && <WaitOverlay msg="等待对手选择酒店..." />}
      {myTurn ? <AcquirerChoiceModal /> : gs.phase === 'choose_acquirer' && <WaitOverlay msg="等待对手选择并购方..." />}
      {gs.phase === 'use_item' && gs.mode === 'futures' && <UseItemModal isMyTurn={myTurn} />}
      {gs.phase === 'buy_stocks' && <BuyStockModal isMyTurn={myTurn} />}
      {gs.phase === 'shop' && gs.mode === 'futures' && <ShopModal isMyTurn={myTurn} />}
      <MergerModal localPlayerId={pid} />
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1400px] mx-auto w-full">
        <div className="flex-1 flex flex-col gap-4">
          {gs.status==='finished' ? <OverScreen /> : <GameBoard readOnly={!myTurn} localPlayerId={pid} />}
          {dev && <DevTilePicker />}
          <div className="space-y-3">
            {!dev && <PlayerHand isMyTurn={myTurn} localPlayerId={pid} />}
            <ActionPanel isMyTurn={myTurn} />
          </div>
        </div>
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4"><PlayerList localPlayerId={pid} /><ThisRoundPanel /><RoundHistory /><HotelPanel /></div>
      </main>
      <DebugLogPanel />
    </div>
  );
}

function WaitOverlay({ msg }: { msg: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 pointer-events-none">
      <div className="bg-surface/95 backdrop-blur rounded-2xl px-6 py-3 shadow-lg text-sm text-slate-500 animate-pulse">
        ⏳ {msg}
      </div>
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

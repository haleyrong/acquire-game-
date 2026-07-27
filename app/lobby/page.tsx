'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOnlineGame, joinOnlineGame } from '@/lib/supabase/queries';

export default function LobbyPage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!playerName.trim()) { setError('请输入你的名字'); return; }
    setIsCreating(true); setError('');
    try {
      const result = await createOnlineGame(playerName.trim());
      if (!result) { setError('创建失败'); return; }
      router.push(`/game/${result.code}?pid=${result.playerId}&host=true`);
    } catch (e) {
      setError(`创建失败: ${(e as Error).message}`);
    } finally { setIsCreating(false); }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setError('请输入你的名字'); return; }
    if (!joinCode.trim()) { setError('请输入房间码'); return; }
    setIsJoining(true); setError('');
    try {
      const result = await joinOnlineGame(joinCode.trim().toUpperCase(), playerName.trim());
      if (!result) { setError('房间不存在。请检查代码后重试'); return; }
      router.push(`/game/${joinCode.trim().toUpperCase()}?pid=${result.playerId}`);
    } catch (e) {
      setError(`加入失败: ${(e as Error).message}`);
    } finally { setIsJoining(false); }
  };

  const supabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your_project_url');

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">🏨 并购风云</h1>
          <p className="text-slate-500">经典地产投资桌游 · 在线联机</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">🌐 在线联机</h2>

          {/* 名字输入 */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">👤 你的名字</label>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入你的名字" maxLength={10} disabled={!supabaseConfigured} />
          </div>

          {/* 玩家人数 & 创建 */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">👥 玩家人数: {playerCount}</label>
            <input type="range" min={2} max={6} value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="w-full accent-blue-500" />
          </div>

          <button onClick={handleCreate}
            disabled={!playerName.trim() || isCreating || !supabaseConfigured}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 active:scale-[0.98] transition-all
                       disabled:bg-slate-300 disabled:cursor-not-allowed">
            {isCreating ? '创建中...' : '🎮 创建新房间'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">或加入已有房间</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">🔑 房间码（4位字母）</label>
            <input type="text" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tracking-widest text-center
                         focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="例: ABCD" maxLength={4} disabled={!supabaseConfigured} />
          </div>
          <button onClick={handleJoin}
            disabled={!playerName.trim() || joinCode.length < 4 || isJoining || !supabaseConfigured}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 active:scale-[0.98] transition-all
                       disabled:bg-slate-300 disabled:cursor-not-allowed">
            {isJoining ? '加入中...' : '🚪 加入房间'}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-center">
          <p className="text-xs text-slate-400 mb-2">暂时没法联网？试试本机双人模式</p>
          <a href="/" className="text-sm text-blue-500 hover:text-blue-600 font-medium">🖥️ 本地热座模式 →</a>
        </div>
      </div>
    </div>
  );
}

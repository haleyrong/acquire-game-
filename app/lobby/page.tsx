'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOnlineGame,
  joinOnlineGame,
} from '@/lib/supabase/queries';

export default function LobbyPage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('请输入你的名字');
      return;
    }
    setIsCreating(true);
    setError('');

    try {
      const result = await createOnlineGame(playerName.trim());
      if (!result) {
        setError('创建失败，请确认 Supabase 已配置');
        return;
      }

      // 跳转到游戏房间（游戏状态在客户端本地创建）
      router.push(`/game/${result.code}?pid=${result.playerId}`);
    } catch (e) {
      setError(`创建失败: ${(e as Error).message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError('请输入你的名字');
      return;
    }
    if (!joinCode.trim()) {
      setError('请输入房间码');
      return;
    }
    setIsJoining(true);
    setError('');

    try {
      const result = await joinOnlineGame(joinCode.trim().toUpperCase(), playerName.trim());
      if (!result) {
        setError('房间不存在或已开始。请检查代码后重试');
        return;
      }

      router.push(`/game/${joinCode.trim().toUpperCase()}?pid=${result.playerId}`);
    } catch (e) {
      setError(`加入失败: ${(e as Error).message}`);
    } finally {
      setIsJoining(false);
    }
  };

  const supabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your_project_url');

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            🏨 并购风云
          </h1>
          <p className="text-slate-500">经典地产投资桌游 · 在线联机</p>
        </div>

        {/* 在线游玩卡片 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">🌐 在线联机</h2>

          {/* Supabase 未配置提示 */}
          {!supabaseConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-700">
                ⚠️ <strong>Supabase 尚未配置</strong>
              </p>
              <p className="text-xs text-amber-600 mt-1">
                请按下面步骤完成配置：<br/>
                1. 访问 <a href="https://supabase.com" className="underline" target="_blank">supabase.com</a> 注册账号<br/>
                2. 创建项目并获取 API URL 和 anon key<br/>
                3. 在 SQL Editor 运行建表语句<br/>
                4. 填入 <code className="bg-amber-100 px-1 rounded">.env.local</code> 文件<br/>
                5. 在 Supabase Auth 设置中启用匿名登录<br/><br/>
                SQL 文件位置：<code className="bg-amber-100 px-1 rounded">supabase-schema.sql</code>
              </p>
            </div>
          )}

          {/* 名字输入 */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">
              👤 你的名字
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="输入你的名字"
              maxLength={10}
              disabled={!supabaseConfigured}
            />
          </div>

          {/* 创建房间 */}
          <button
            onClick={handleCreate}
            disabled={!playerName.trim() || isCreating || !supabaseConfigured}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold
                       hover:bg-blue-600 active:scale-[0.98] transition-all
                       disabled:bg-slate-300 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isCreating ? '创建中...' : '🎮 创建新房间'}
          </button>

          {/* 分割线 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">或加入已有房间</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* 加入房间 */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">
              🔑 房间码（4位字母）
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tracking-widest text-center
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         uppercase placeholder:normal-case placeholder:tracking-normal"
              placeholder="例: ABCD"
              maxLength={4}
              disabled={!supabaseConfigured}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={!playerName.trim() || joinCode.length < 4 || isJoining || !supabaseConfigured}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold
                       hover:bg-emerald-600 active:scale-[0.98] transition-all
                       disabled:bg-slate-300 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isJoining ? '加入中...' : '🚪 加入房间'}
          </button>

          {/* 错误 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* 本地热座入口 */}
        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-center">
          <p className="text-xs text-slate-400 mb-2">
            暂时没法联网？试试本机双人模式
          </p>
          <a
            href="/"
            className="text-sm text-blue-500 hover:text-blue-600 font-medium"
          >
            🖥️ 本地热座模式 →
          </a>
        </div>

        {/* Phase 2 标记 */}
        <p className="text-xs text-slate-300 text-center mt-4">
          Phase 2 · 在线联机
        </p>
      </div>
    </div>
  );
}

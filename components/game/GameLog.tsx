'use client';

import { useGameStore } from '@/store/gameStore';
import { useRef, useEffect } from 'react';

export function GameLog() {
  const gameState = useGameStore((s) => s.gameState);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.log.length]);

  if (!gameState || gameState.log.length === 0) return null;

  // 只显示最近20条
  const recentLogs = gameState.log.slice(-20);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">📜 日志</h3>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {recentLogs.map((entry) => {
          const player = entry.playerId
            ? gameState.players[entry.playerId]
            : null;
          return (
            <div key={entry.id} className="text-xs text-slate-600 flex gap-2">
              <span className="text-slate-400 shrink-0">
                {new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {player && (
                <span className="font-medium text-slate-700 shrink-0">
                  {player.name}:
                </span>
              )}
              <span>{entry.description}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';

// 全局日志收集器
const logs: { time: string; msg: string; type: 'info' | 'warn' | 'error' }[] = [];
let listeners: (() => void)[] = [];

function addGlobalLog(msg: string, type: 'info' | 'warn' | 'error' = 'info') {
  const now = new Date().toLocaleTimeString('zh-CN');
  logs.push({ time: now, msg, type });
  if (logs.length > 200) logs.shift();
  listeners.forEach((fn) => fn());
}

export function debugLog(msg: string, type?: 'info' | 'warn' | 'error') {
  addGlobalLog(msg, type);
  // 同时输出到浏览器 Console
  if (type === 'error') console.error('[Debug]', msg);
  else if (type === 'warn') console.warn('[Debug]', msg);
  else console.log('[Debug]', msg);
}

export function DebugLogPanel() {
  const [, forceUpdate] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'warn' | 'error'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const filtered = filter === 'all'
    ? logs
    : logs.filter((l) => l.type === filter);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-2 right-2 z-[100] bg-slate-800 text-green-400 text-xs px-3 py-1.5 rounded-full shadow-lg opacity-70 hover:opacity-100 font-mono"
      >
        📋 日志
      </button>
    );
  }

  return (
    <div className="fixed bottom-2 right-2 z-[100] bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl w-96 max-h-64 flex flex-col text-[11px] font-mono">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 shrink-0">
        <span className="text-green-400 font-semibold">📋 调试日志</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
          >全部</button>
          <button
            onClick={() => setFilter('warn')}
            className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'warn' ? 'bg-yellow-800 text-yellow-300' : 'text-slate-500'}`}
          >警告</button>
          <button
            onClick={() => setFilter('error')}
            className={`px-1.5 py-0.5 rounded text-[10px] ${filter === 'error' ? 'bg-red-900 text-red-300' : 'text-slate-500'}`}
          >错误</button>
          <button
            onClick={() => setExpanded(false)}
            className="text-slate-500 hover:text-slate-300 text-xs ml-1"
          >✕</button>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {filtered.length === 0 && (
          <div className="text-slate-600 text-center py-4">暂无日志</div>
        )}
        {filtered.map((l, i) => (
          <div key={i} className={`leading-relaxed ${
            l.type === 'error' ? 'text-red-400' :
            l.type === 'warn' ? 'text-yellow-400' :
            'text-slate-300'
          }`}>
            <span className="text-slate-600 mr-1">{l.time}</span>
            {l.msg}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

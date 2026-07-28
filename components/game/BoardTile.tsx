'use client';

import type { Tile, Hotel } from '@/lib/engine/types';

interface BoardTileProps {
  tile: Tile;
  hotel: Hotel | null;
  isInHand: boolean;
  isSelected: boolean;
  isPending: boolean;
  isDeadZone: boolean;
  isMyTurn: boolean;
  devMode?: boolean;
  onSelect: () => void;
  onPlace: () => void;
}

export function BoardTile({
  tile,
  hotel,
  isInHand,
  isSelected,
  isPending,
  isDeadZone,
  isMyTurn,
  devMode,
  onSelect,
  onPlace,
}: BoardTileProps) {
  // 基础样式
  let bgClass = 'bg-card border-card-border shadow-sm';
  let hoverClass = '';
  let cursorClass = 'cursor-default';

  if (isDeadZone && !tile.placed) {
    bgClass = 'bg-red-950/60 border-red-800';
    cursorClass = 'cursor-not-allowed';
  } else if (tile.placed && hotel) {
    // 有酒店的格子：纯色 + 内阴影模拟嵌入效果
    bgClass = 'shadow-inner';
  } else if (tile.placed) {
    // 独立板块：暖色
    bgClass = 'bg-amber-100 border-amber-400 shadow-sm';
  }

  if (isPending && tile.placed) {
    bgClass = 'ring-2 ring-amber-400 ring-offset-1 bg-amber-100 border-amber-400 animate-pulse shadow-md';
  } else if (isSelected) {
    bgClass = 'ring-2 ring-blue-500 ring-offset-1 bg-blue-50 border-blue-400 shadow-md scale-105';
  } else if (devMode && !tile.placed) {
    hoverClass = 'hover:bg-green-100 hover:border-green-400 border-dashed';
    cursorClass = 'cursor-pointer';
  } else if (isInHand && isMyTurn && !tile.placed && !isDeadZone) {
    hoverClass = 'hover:bg-blue-50 hover:border-blue-400 hover:shadow-md';
    cursorClass = 'cursor-pointer';
  }

  const hotelStyle = tile.placed && hotel
    ? { backgroundColor: hotel.color, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -2px 4px rgba(255,255,255,0.15)' }
    : {};

  return (
    <div
      className={`
        relative w-16 h-10 rounded-md border
        flex items-center justify-center
        text-[9px] font-medium
        transition-all duration-150 ease-out
        ${bgClass} ${hoverClass} ${cursorClass}
      `}
      style={hotelStyle}
      onClick={() => {
        if (isDeadZone && !tile.placed) return;
        if (devMode) {
          if (!tile.placed) {
            if (isSelected) { onPlace(); } else { onSelect(); }
          }
          return;
        }
        if (isInHand && isMyTurn && !tile.placed) {
          if (isSelected) { onPlace(); } else { onSelect(); }
        }
      }}
    >
      {/* 死区锁图标 */}
      {isDeadZone && !tile.placed && (
        <span className="text-red-400/60 text-xs">🔒</span>
      )}

      {/* 坐标标签 */}
      {!tile.placed && !isDeadZone && (
        <span className="text-text-soft/40">{tile.label}</span>
      )}

      {/* 已放置且有酒店：显示图标 */}
      {tile.placed && hotel && (
        <span className="text-white drop-shadow-md text-sm leading-none">
          {hotel.icon || hotel.name[0]}
        </span>
      )}
      {/* 已放置无酒店（独立板块） */}
      {tile.placed && !hotel && (
        <span className="text-amber-700 font-bold text-[8px]">{tile.label}</span>
      )}

      {/* 选中标记 */}
      {isSelected && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px] shadow">
          ✓
        </span>
      )}

      {/* 手中板块的指示点 */}
      {((isInHand && isMyTurn) || devMode) && !tile.placed && !isDeadZone && (
        <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full shadow-sm ${devMode ? 'bg-green-400' : 'bg-blue-400'}`} />
      )}

      {/* 开发者模式空位标记 */}
      {devMode && !tile.placed && !isSelected && !isDeadZone && (
        <span className="absolute inset-0 flex items-center justify-center text-[7px] text-slate-400/50">
          {tile.label}
        </span>
      )}
    </div>
  );
}

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
  let bgClass = 'bg-white border-slate-300';
  let hoverClass = '';
  let cursorClass = 'cursor-default';

  if (isDeadZone && !tile.placed) {
    // 安全酒店之间的死区
    bgClass = 'bg-slate-800 border-slate-700';
    cursorClass = 'cursor-not-allowed';
  } else if (tile.placed && hotel) {
    bgClass = '';
  } else if (tile.placed) {
    bgClass = 'bg-amber-100 border-amber-300';
  }

  if (isPending && tile.placed) {
    bgClass = 'ring-2 ring-amber-400 ring-offset-1 bg-amber-100 border-amber-400 animate-pulse';
  } else if (isSelected) {
    bgClass = 'ring-2 ring-blue-500 ring-offset-1 bg-blue-100 border-blue-400';
  } else if (devMode && !tile.placed) {
    hoverClass = 'hover:bg-green-50 hover:border-green-400 border-dashed';
    cursorClass = 'cursor-pointer';
    bgClass = 'bg-slate-50 border-slate-300';
  } else if (isInHand && isMyTurn && !tile.placed && !isDeadZone) {
    hoverClass = 'hover:bg-blue-50 hover:border-blue-400';
    cursorClass = 'cursor-pointer';
  }

  const hotelStyle = tile.placed && hotel
    ? { backgroundColor: hotel.color }
    : {};

  return (
    <div
      className={`
        relative w-16 h-10 rounded border
        flex items-center justify-center
        text-[9px] font-medium
        transition-all duration-100
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
      {/* 坐标标签 */}
      {!tile.placed && (
        <span className="text-slate-400">{tile.label}</span>
      )}

      {/* 已放置：显示酒店名的首字 */}
      {tile.placed && hotel && (
        <span className="text-white drop-shadow-sm font-bold text-xs">
          {hotel.name[0]}
        </span>
      )}

      {/* 选中标记 */}
      {isSelected && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[8px]">
          ✓
        </span>
      )}

      {/* 手中的板块加亮提示 */}
      {((isInHand && isMyTurn) || devMode) && !tile.placed && (
        <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${devMode ? 'bg-green-400' : 'bg-blue-400'}`} />
      )}

      {/* 开发者模式空位标记 */}
      {devMode && !tile.placed && !isSelected && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-400 opacity-60">
          {tile.label}
        </span>
      )}
    </div>
  );
}

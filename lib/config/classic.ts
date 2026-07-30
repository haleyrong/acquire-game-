// 经典模式默认配置
import type { GameConfig } from '../engine/types';

export const classicConfig: GameConfig = {
  startingCash: 6000,
  handSize: 6,
  safeSize: 11,

  stocksPerHotel: 25,
  maxBuyPerTurn: 3,
  tradeRatio: 2,

  majorityBonusMultiplier: 10,
  minorityBonusMultiplier: 5,

  endCondition: 'both',
  maxHotelSizeTrigger: 41,

  bonusForFoundingHotel: 1,

  // 商店配置
  universalTilePrice: 1000,
  maxFuturesPerPlayer: 10,
  shopItems: [
    { id: 'universal_tile', name: '万能板块', icon: '🃏', price: 1000, description: '可以放在棋盘上任意空位' },
  ],
  futuresConfig: [],
  // 期货名称映射
  futuresNames: {
    'SpaceX': { name: '火箭发射', icon: '🚀' },
    'Google': { name: '芯片', icon: '💻' },
    '妮妮美术馆': { name: '名画', icon: '🖼️' },
    '包包厨房': { name: '小麦粉', icon: '🌾' },
    '莎莎猫咖': { name: '咖啡豆', icon: '☕' },
    '比亚迪汽车': { name: '锂电池', icon: '🔋' },
    '中医连锁': { name: '中药材', icon: '🌿' },
  },

  hotels: [
    // Luxury (2家)
    { name: 'SpaceX', tier: 'luxury', color: '#E53E3E', minFoundingSize: 3, icon: '🚀' },
    { name: 'Google', tier: 'luxury', color: '#DD6B20', minFoundingSize: 3, icon: '🌐' },

    // Standard (3家)
    { name: '妮妮美术馆', tier: 'standard', color: '#38A169', minFoundingSize: 2, icon: '🎨' },
    { name: '包包厨房', tier: 'standard', color: '#3182CE', minFoundingSize: 2, icon: '🍳' },
    { name: '莎莎猫咖', tier: 'standard', color: '#805AD5', minFoundingSize: 2, icon: '🐱' },

    // Economy (2家)
    { name: '比亚迪汽车', tier: 'economy', color: '#D69E2E', minFoundingSize: 2, icon: '🚗' },
    { name: '中医连锁', tier: 'economy', color: '#718096', minFoundingSize: 2, icon: '🏥' },
  ],
};

// 股票价格表：按酒店档次和规模决定
export function getStockPrice(tier: string, size: number): number {
  if (tier === 'luxury') {
    if (size >= 41) return 1200;
    if (size >= 31) return 1100;
    if (size >= 21) return 1000;
    if (size >= 11) return 900;
    if (size >= 6) return 800;
    if (size >= 5) return 700;
    if (size >= 4) return 600;
    if (size >= 3) return 500;
    return 400; // size = 2
  }

  if (tier === 'standard') {
    if (size >= 41) return 1100;
    if (size >= 31) return 1000;
    if (size >= 21) return 900;
    if (size >= 11) return 800;
    if (size >= 6) return 700;
    if (size >= 5) return 600;
    if (size >= 4) return 500;
    if (size >= 3) return 400;
    return 300; // size = 2
  }

  // economy
  if (size >= 41) return 1000;
  if (size >= 31) return 900;
  if (size >= 21) return 800;
  if (size >= 11) return 700;
  if (size >= 6) return 600;
  if (size >= 5) return 500;
  if (size >= 4) return 400;
  if (size >= 3) return 300;
  return 200; // size = 2
}

// 期货价格乘数
export function getFuturesPriceMultiplier(size: number, tier: string): number {
  const isLuxury = tier === 'luxury';
  if (size >= 21) return isLuxury ? 15 : 10;
  if (size >= 10) return isLuxury ? 5 : 4;
  if (size >= 5) return isLuxury ? 2.5 : 2;
  return 1;
}

// 创建酒店名称列表（中文版用英文简称做ID）
export const HOTEL_NAMES = [
  'worldwide', 'imperial',
  'festival', 'american', 'continental',
  'luxor', 'tower',
] as const;

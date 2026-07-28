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

  hotels: [
    // Luxury (2家)
    { name: '寰宇国际', tier: 'luxury', color: '#E53E3E', minFoundingSize: 3, icon: '🏰' },
    { name: '帝国集团', tier: 'luxury', color: '#DD6B20', minFoundingSize: 3, icon: '👑' },

    // Standard (3家)
    { name: '妮妮美术馆', tier: 'standard', color: '#38A169', minFoundingSize: 2, icon: '🎨' },
    { name: '包包厨房', tier: 'standard', color: '#3182CE', minFoundingSize: 2, icon: '🍳' },
    { name: '大陆控股', tier: 'standard', color: '#805AD5', minFoundingSize: 2, icon: '🏢' },

    // Economy (2家)
    { name: '卢克索', tier: 'economy', color: '#D69E2E', minFoundingSize: 2, icon: '🏪' },
    { name: '高塔连锁', tier: 'economy', color: '#718096', minFoundingSize: 2, icon: '🗼' },
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

// 创建酒店名称列表（中文版用英文简称做ID）
export const HOTEL_NAMES = [
  'worldwide', 'imperial',
  'festival', 'american', 'continental',
  'luxor', 'tower',
] as const;

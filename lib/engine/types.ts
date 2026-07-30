// ============================================================
// 并购风云 (Acquire) — 核心类型定义
// ============================================================

// ---- 棋盘 ----

/** 棋盘位置：行 1-9 (A-I), 列 1-12 */
export interface Position {
  row: number; // 1-9
  col: number; // 1-12
}

/** 棋盘板块 */
export interface Tile {
  id: string;
  position: Position;
  label: string; // "1A", "5C", "12I"
  placed: boolean;
  hotelId: string | null; // 所属酒店（null = 未放置或无酒店）
  placedBy: string | null; // 放置者玩家ID
}

// ---- 酒店 ----

export type HotelTier = 'luxury' | 'standard' | 'economy';

/** 企业连锁 */
export interface Hotel {
  id: string;
  name: string;
  tier: HotelTier;
  color: string; // 显示颜色（hex）
  icon: string; // emoji 图标
  size: number; // 已放置板块数
  isSafe: boolean; // 是否安全（>= 11块）
  isActive: boolean; // 是否已建立
  remainingStocks: number; // 剩余可购股票（总共25张，减去已发放和购买）
  stockPrice: number; // 当前股价（由size决定）
}

/** 酒店配置模板（创建游戏时使用） */
export interface HotelConfig {
  name: string;
  tier: HotelTier;
  color: string;
  minFoundingSize: number;
  icon: string;
}

// ---- 玩家 ----

/** 玩家持股记录 */
export interface StockHolding {
  hotelId: string;
  quantity: number;
}

/** 期货持仓 */
export interface FuturesHolding {
  hotelId: string;
  quantity: number;
  purchasePrice: number; // 买入时的单价
}

/** 玩家道具 */
export interface PlayerItem {
  type: 'universal_tile'; // 道具类型
  quantity: number;
}

/** 玩家 */
export interface Player {
  id: string;
  name: string;
  cash: number;
  handTileIds: string[]; // 手中的板块ID（通常6张）
  stocks: StockHolding[];
  futures: FuturesHolding[]; // 期货持仓
  items: PlayerItem[]; // 道具
  usedItemThisTurn: boolean; // 本回合是否已使用过道具
  turnOrder: number;
  isConnected: boolean;
}

// ---- 并购 ----

/** 一次并购事件 */
export interface MergerEvent {
  acquiringHotelId: string; // 并购方（规模大的）
  acquiredHotelId: string; // 被并购方（规模小的）
  acquiredHotelName: string; // 被并购方名称
  acquiredHotelColor: string; // 被并购方颜色
  victimStockPrice: number; // 被并购前股价
  // 分红信息
  majorityPlayerId: string | null; // 最大股东
  majorityPlayerName: string | null;
  minorityPlayerId: string | null; // 第二大股东
  minorityPlayerName: string | null;
  majorityBonus: number;
  minorityBonus: number;
  // 决策队列（持有被并购方股票的玩家）
  decisionQueue: string[]; // 玩家ID列表
  currentDecisionPlayerIndex: number; // 当前轮到队列中第几个玩家决策
  status: 'pending' | 'completed';
}

/** 一次并购决策 */
export interface MergerDecision {
  playerId: string;
  decision: 'sell' | 'trade' | 'hold';
  quantity: number; // 决定卖/换的股票数量
}

// ---- 游戏阶段 ----

export type GameMode = 'classic' | 'futures';

export type GamePhase =
  | 'place_tile' // 放置板块
  | 'use_item' // 使用道具（期货模式）
  | 'choose_hotel' // 选择激活哪家酒店
  | 'choose_acquirer' // 并购时选择谁吞谁（同级酒店）
  | 'merger_decisions' // 被并购股东做决策
  | 'buy_stocks' // 购买股票
  | 'shop' // 商店阶段（期货模式）
  | 'draw_tile' // 补牌
  | 'game_over'; // 游戏结束

/** 待建立的酒店信息 */
export interface PendingHotelFounding {
  placedTileId: string; // 刚放置的板块ID
  adjacentTileIds: string[]; // 相邻的独立板块ID（无酒店归属）
}

/** 同级并购时待玩家选择的酒店 */
export interface PendingAcquirerChoice {
  placedTileId: string; // 刚放置的板块ID
  /** 同级酒店组：[酒店A_id, 酒店B_id] — 玩家选择谁吞谁 */
  tieHotels: string[];
  /** 其他已经确定归属的小酒店（直接被打包进并购队列） */
  smallerVictims: string[];
}

// ---- 游戏状态 ----

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  description: string;
}

export interface FuturesConfig {
  hotelId: string; // 对应企业
  basePrice: number; // 基础价格
  name: string; // 期货名称
  icon: string; // 期货图标
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  status: 'waiting' | 'playing' | 'finished';
  config: GameConfig;

  // 棋盘
  tiles: Record<string, Tile>; // tileId → Tile

  // 酒店
  hotels: Record<string, Hotel>; // hotelId → Hotel
  inactiveHotels: string[]; // 尚未激活的酒店ID列表

  // 玩家
  players: Record<string, Player>; // playerId → Player
  playerOrder: string[]; // 按turnOrder排列的玩家ID

  // 回合
  currentPlayerIndex: number; // playerOrder 中的索引
  phase: GamePhase;
  stocksBoughtThisTurn: number; // 当前回合已购买股票数（上限 maxBuyPerTurn）
  roundNumber: number; // 当前回合数（所有人完成一轮 +1）
  roundHistory: RoundRecord[]; // 历史回合记录
  roundStartSnapshot: PlayerRoundSnapshot[] | null; // 当前回合开始时的玩家快照

  // 并购
  activeMergers: MergerEvent[]; // 当前活跃的并购（可能有多个）

  // 建立新酒店
  pendingHotelFounding: PendingHotelFounding | null; // 等待玩家选择酒店

  // 同级并购
  pendingAcquirerChoice: PendingAcquirerChoice | null; // 等待玩家选择谁吞谁

  // 日志
  log: GameLogEntry[];
}

// ---- 回合记录 ----

export interface PlayerRoundSnapshot {
  playerId: string;
  playerName: string;
  cash: number;
  stocks: StockHolding[];
  futures: FuturesHolding[];
}

export interface RoundRecord {
  roundNumber: number;
  players: PlayerRoundSnapshot[];
}

// ---- 游戏日志 ----

export interface GameLogEntry {
  id: string;
  timestamp: number;
  playerId: string;
  action: string;
  description: string;
  payload?: Record<string, unknown>;
}

// ---- 玩家操作 ----

export type GameAction =
  | { type: 'PLACE_TILE'; tileId: string }
  | { type: 'CHOOSE_ACQUIRER'; acquiringHotelId: string; acquiredHotelId: string }
  | { type: 'MERGER_DECISION'; mergerIndex: number; decision: 'sell' | 'trade' | 'hold'; quantity: number }
  | { type: 'BUY_STOCK'; hotelId: string; quantity: number }
  | { type: 'SKIP_BUYING' }
  | { type: 'DRAW_TILE' };

// ---- 游戏配置 ----

export interface GameConfig {
  // 基础规则
  startingCash: number; // 默认 6000
  handSize: number; // 默认 6
  safeSize: number; // 默认 11

  // 股票规则
  stocksPerHotel: number; // 默认 25
  maxBuyPerTurn: number; // 默认 3
  tradeRatio: number; // 默认 2（2换1）

  // 并购规则
  majorityBonusMultiplier: number; // 最大股东分红倍率 默认 10
  minorityBonusMultiplier: number; // 第二大股东分红倍率 默认 5

  // 结束条件
  endCondition: 'all_safe' | 'max_size' | 'both'; // 默认 both
  maxHotelSizeTrigger: number; // 某酒店达此规模结束 默认 41

  // 酒店列表
  hotels: HotelConfig[];

  // 连胜奖励（进阶模式可选）
  bonusForFoundingHotel: number;

  // 期货模式
  shopItems: ShopItem[];
  futuresConfig: FuturesConfig[];
  futuresNames: Record<string, { name: string; icon: string }>;
  maxFuturesPerPlayer: number;
  universalTilePrice: number;
}

// ---- 分数 ----

export interface ScoreResult {
  playerId: string;
  playerName: string;
  cash: number; // 最终现金
  stockValue: number; // 股票兑现价值
  totalWealth: number; // 总财富
  rank: number; // 排名
}

// ---- AI接口（未来） ----

export interface PlayerAgent {
  playerId: string;
  getAction(gameState: GameState): Promise<GameAction>;
}

// ============================================================
// 并购风云 (Acquire) — 游戏引擎
// 纯函数，不依赖 React 或 Supabase
// ============================================================

import type {
  GameState,
  GameConfig,
  Tile,
  Hotel,
  Player,
  Position,
  GameLogEntry,
  MergerEvent,
} from './types';
import { getStockPrice } from '@/lib/config/classic';

// ---- 工具函数 ----

/** 位置 → 标签，如 (row=1, col=1) → "1A" */
export function getTileLabel(row: number, col: number): string {
  const colLabel = String.fromCharCode(64 + row); // 1→A, 2→B, ... 9→I
  return `${col}${colLabel}`;
}

/** 标签 → 位置，如 "1A" → {row:1, col:1} */
export function parseTileLabel(label: string): Position | null {
  const match = label.match(/^(\d{1,2})([A-I])$/);
  if (!match) return null;
  return {
    row: match[2].charCodeAt(0) - 64,
    col: parseInt(match[1]),
  };
}

/** 生成唯一ID */
let idCounter = 0;
export function generateId(prefix: string = ''): string {
  idCounter++;
  return `${prefix}${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 洗牌（Fisher-Yates） */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 获取相邻位置（上下左右） */
export function getAdjacentPositions(pos: Position): Position[] {
  const neighbors: Position[] = [];
  if (pos.row > 1) neighbors.push({ row: pos.row - 1, col: pos.col }); // 上
  if (pos.row < 9) neighbors.push({ row: pos.row + 1, col: pos.col }); // 下
  if (pos.col > 1) neighbors.push({ row: pos.row, col: pos.col - 1 }); // 左
  if (pos.col < 12) neighbors.push({ row: pos.row, col: pos.col + 1 }); // 右
  return neighbors;
}

// ---- 游戏初始化 ----

export function createGame(
  gameId: string,
  config: GameConfig,
  playerNames: string[]
): GameState {
  // 重置ID计数器
  idCounter = 0;

  // 1. 创建108块板块
  const tiles: Record<string, Tile> = {};
  for (let row = 1; row <= 9; row++) {
    for (let col = 1; col <= 12; col++) {
      const id = generateId('tile_');
      tiles[id] = {
        id,
        position: { row, col },
        label: getTileLabel(row, col),
        placed: false,
        hotelId: null,
        placedBy: null,
      };
    }
  }

  // 2. 创建7家酒店（初始未激活）
  const hotels: Record<string, Hotel> = {};
  const inactiveHotels: string[] = [];
  config.hotels.forEach((hc) => {
    const id = generateId('hotel_');
    hotels[id] = {
      id,
      name: hc.name,
      tier: hc.tier,
      color: hc.color,
      size: 0,
      isSafe: false,
      isActive: false,
      remainingStocks: config.stocksPerHotel,
      stockPrice: getStockPrice(hc.tier, 2), // 初始价格（规模2时）
    };
    inactiveHotels.push(id);
  });

  // 3. 创建玩家
  const players: Record<string, Player> = {};
  const playerOrder: string[] = [];
  playerNames.forEach((name, i) => {
    const id = generateId('player_');
    players[id] = {
      id,
      name,
      cash: config.startingCash,
      handTileIds: [],
      stocks: [],
      turnOrder: i,
      isConnected: true,
    };
    playerOrder.push(id);
  });

  // 4. 发牌：给每个玩家发6张
  const allTileIds = Object.keys(tiles);
  const shuffledTiles = shuffle(allTileIds);
  let tileIndex = 0;
  for (const playerId of playerOrder) {
    for (let i = 0; i < config.handSize; i++) {
      players[playerId].handTileIds.push(shuffledTiles[tileIndex]);
      tileIndex++;
    }
  }

  // 5. 随机放置 N 块初始板块（N = 玩家人数）
  const remainingTiles = allTileIds.filter((id) => {
    // 未被发到手中的板块
    return !Object.values(players).some((p) => p.handTileIds.includes(id));
  });
  const preplacedTiles = shuffle(remainingTiles).slice(0, playerNames.length);
  for (const tileId of preplacedTiles) {
    tiles[tileId].placed = true;
  }

  const state: GameState = {
    gameId,
    mode: 'classic',
    status: 'playing',
    config,
    tiles,
    hotels,
    inactiveHotels,
    players,
    playerOrder,
    currentPlayerIndex: 0,
    phase: 'place_tile',
    stocksBoughtThisTurn: 0,
    activeMergers: [],
    pendingHotelFounding: null,
    pendingAcquirerChoice: null,
    log: [],
  };

  // 初始日志
  addLog(state, '', '游戏开始', `${playerNames.join('、')} 加入游戏`);
  addLog(state, playerOrder[0], '回合开始', `${players[playerOrder[0]].name} 的回合`);

  return state;
}

// ---- 日志 ----

function addLog(
  state: GameState,
  playerId: string,
  action: string,
  description: string,
  payload?: Record<string, unknown>
) {
  state.log.push({
    id: generateId('log_'),
    timestamp: Date.now(),
    playerId,
    action,
    description,
    payload,
  });
}

// ---- 板块放置逻辑 ----

export interface PlaceTileResult {
  success: boolean;
  error?: string;
  /** 放置板块后触发的事件类型 */
  event: 'none' | 'found_hotel' | 'expand_hotel' | 'merger';
  /** 相邻的酒店ID列表 */
  adjacentHotels: string[];
  /** 受影响的酒店ID */
  affectedHotelId?: string;
}

/** 放置板块 */
export function placeTile(state: GameState, tileId: string): PlaceTileResult {
  const tile = state.tiles[tileId];
  if (!tile) return { success: false, error: '板块不存在', event: 'none', adjacentHotels: [] };
  if (tile.placed) return { success: false, error: '该位置已有板块', event: 'none', adjacentHotels: [] };

  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer.handTileIds.includes(tileId)) {
    return { success: false, error: '你手中没有这块板块', event: 'none', adjacentHotels: [] };
  }

  // 1. 标记板块为已放置
  tile.placed = true;
  tile.placedBy = currentPlayer.id;

  // 2. 从玩家手中移除
  currentPlayer.handTileIds = currentPlayer.handTileIds.filter((id) => id !== tileId);

  // 3. 检测相邻已放置板块所属的酒店
  const adjacentHotels = findAdjacentHotels(state, tileId);

  // 4. 确定事件类型
  let event: PlaceTileResult['event'];
  let affectedHotelId: string | undefined;

  if (adjacentHotels.length === 0) {
    // 无相邻酒店 → 检查是否可以建立新酒店
    const allOrphanTiles = findAllConnectedOrphanTiles(state, tile);
    // allOrphanTiles 包含 tile 自身 + 所有相连的独立板块
    const totalOrphanCount = allOrphanTiles.length; // >= 1（至少含 tile 自己）

    // 找出满足 minFoundingSize 的未激活酒店
    const eligibleHotels = state.inactiveHotels.filter((hid) => {
      const hotelConfig = state.config.hotels.find(
        (hc) => state.hotels[hid]?.name === hc.name
      );
      return hotelConfig && totalOrphanCount >= hotelConfig.minFoundingSize;
    });

    if (eligibleHotels.length > 0) {
      // 可以让玩家选择酒店
      event = 'found_hotel';
      state.phase = 'choose_hotel';
      state.pendingHotelFounding = {
        placedTileId: tile.id,
        adjacentTileIds: allOrphanTiles
          .filter((t) => t.id !== tile.id)
          .map((t) => t.id),
      };
    } else {
      // 不满足任何酒店的最低建立条件，无事发生
      event = 'none';
      state.phase = 'buy_stocks';
      state.stocksBoughtThisTurn = 0;
      if (totalOrphanCount > 1) {
        addLog(state, '', 'INFO',
          `${totalOrphanCount} 块独立板块相连，但没有酒店满足最低建立条件`);
      }
    }
  } else {
    // 相邻至少一家酒店
    if (adjacentHotels.length === 1) {
      // 只相邻一家酒店 → 扩张
      event = 'expand_hotel';
      affectedHotelId = adjacentHotels[0];
      addTileToHotel(state, tile, affectedHotelId);

      // 同时吸收所有相邻的孤儿板块
      absorbAdjacentOrphans(state, tile, affectedHotelId);

      state.phase = 'buy_stocks';
      state.stocksBoughtThisTurn = 0;
    } else {
    // 相邻多家酒店 → 并购！
    event = 'merger';

    // 按规模分组
    const hotelList = adjacentHotels
      .map((id) => state.hotels[id])
      .filter(Boolean);

    const maxSize = Math.max(...hotelList.map((h) => h.size));
    const largest = hotelList.filter((h) => h.size === maxSize);
    const smaller = hotelList.filter((h) => h.size < maxSize);

    if (largest.length === 1) {
      // 只有一个最大酒店 → 它自动成为幸存者
      const survivor = largest[0];
      affectedHotelId = survivor.id;

      // 新板块加入幸存者
      addTileToHotel(state, tile, survivor.id);

      // 吸收相邻孤儿板块
      absorbAdjacentOrphans(state, tile, survivor.id);

      // 所有更小的酒店被并购
      for (const victim of smaller) {
        if (victim.isActive && victim.size > 0) {
          initiateMerger(state, survivor, victim);
        }
      }

      // 进入决策或买股票
      advanceAfterMerger(state);
    } else {
      // 多个酒店规模相同 → 让放置者选择谁吞谁
      event = 'merger';
      // 新板块先不归属任何酒店，等玩家选完
      tile.hotelId = null; // 暂时无归属

      state.phase = 'choose_acquirer';
      state.pendingAcquirerChoice = {
        placedTileId: tile.id,
        tieHotels: largest.map((h) => h.id),
        smallerVictims: smaller.map((h) => h.id),
      };
    }
    } // end multi-hotel branch
  }

  addLog(
    state,
    currentPlayer.id,
    'PLACE_TILE',
    `${currentPlayer.name} 在 ${tile.label} 放置板块`,
    { tileId, tileLabel: tile.label, event }
  );

  return {
    success: true,
    event,
    adjacentHotels,
    affectedHotelId,
  };
}

/** 检测与某板块相邻的已放置板块所属的酒店（去重） */
function findAdjacentHotels(state: GameState, tileId: string): string[] {
  const tile = state.tiles[tileId];
  const adjacentPositions = getAdjacentPositions(tile.position);
  const hotelIds = new Set<string>();

  for (const pos of adjacentPositions) {
    // 找到该位置的板块
    const adjacentTile = findTileAtPosition(state, pos);
    if (adjacentTile && adjacentTile.placed && adjacentTile.hotelId) {
      hotelIds.add(adjacentTile.hotelId);
    }
  }

  return Array.from(hotelIds);
}

/** 根据位置查找板块 */
export function findTileAtPosition(state: GameState, pos: Position): Tile | null {
  for (const tile of Object.values(state.tiles)) {
    if (tile.position.row === pos.row && tile.position.col === pos.col) {
      return tile;
    }
  }
  return null;
}

/** 吸收与 tile 相邻的所有孤儿板块到酒店 */
function absorbAdjacentOrphans(state: GameState, tile: Tile, hotelId: string) {
  const orphans = findAdjacentOrphanTiles(state, tile);
  for (const orphan of orphans) {
    if (!orphan.hotelId) {
      orphan.hotelId = hotelId;
      state.hotels[hotelId].size++;
    }
  }
  if (orphans.length > 0) {
    state.hotels[hotelId].stockPrice = getStockPrice(
      state.hotels[hotelId].tier,
      state.hotels[hotelId].size
    );
    addLog(state, '', 'ABSORB',
      `${state.hotels[hotelId].name} 吸收了 ${orphans.length} 块独立板块`);
  }
}

/** 找到与某板块直接相邻的孤儿板块（不递归） */
function findAdjacentOrphanTiles(state: GameState, tile: Tile): Tile[] {
  return getAdjacentPositions(tile.position)
    .map((pos) => findTileAtPosition(state, pos))
    .filter((t): t is Tile => t !== null && t.placed && !t.hotelId);
}

/** 将板块加入酒店 */
function addTileToHotel(state: GameState, tile: Tile, hotelId: string) {
  const hotel = state.hotels[hotelId];
  if (!hotel) return;

  tile.hotelId = hotelId;
  hotel.size++;
  hotel.stockPrice = getStockPrice(hotel.tier, hotel.size);

  // 检查是否达到安全规模
  if (hotel.size >= state.config.safeSize && !hotel.isSafe) {
    hotel.isSafe = true;
    addLog(state, '', 'SAFE', `${hotel.name} 规模达到 ${hotel.size}，成为安全酒店！`);
  }
}

/** BFS 查找所有相连的独立板块（已放置但无酒店归属） */
function findAllConnectedOrphanTiles(state: GameState, startTile: Tile): Tile[] {
  if (startTile.hotelId) return [];

  const visited = new Set<string>();
  const result: Tile[] = [];
  const queue: Tile[] = [startTile];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    result.push(current);

    // 查看相邻板块
    const adjacent = getAdjacentPositions(current.position)
      .map((pos) => findTileAtPosition(state, pos))
      .filter(
        (t): t is Tile =>
          t !== null && t.placed && !t.hotelId && !visited.has(t.id)
      );

    queue.push(...adjacent);
  }

  return result;
}

// ---- 并购系统 ----

/** 并购分支完成后的推进 */
function advanceAfterMerger(state: GameState) {
  if (state.activeMergers.length > 0) {
    state.phase = 'merger_decisions';
  } else {
    state.phase = 'buy_stocks';
    state.stocksBoughtThisTurn = 0;
  }
}

/** 玩家选择了同级酒店中的幸存者 */
export function chooseAcquirer(state: GameState, chosenSurvivorId: string): boolean {
  const pending = state.pendingAcquirerChoice;
  if (!pending) return false;

  const survivor = state.hotels[chosenSurvivorId];
  if (!survivor) return false;
  if (!pending.tieHotels.includes(chosenSurvivorId)) return false;

  // 找出所有被并购方（同级中除幸存者外的所有酒店）
  const otherTies = pending.tieHotels.filter((id) => id !== chosenSurvivorId);
  if (otherTies.length === 0) return false;

  const tile = state.tiles[pending.placedTileId];

  // 新板块加入幸存者
  addTileToHotel(state, tile, chosenSurvivorId);

  // 吸收相邻孤儿板块
  absorbAdjacentOrphans(state, tile, chosenSurvivorId);

  // 同级所有其他酒店都被并购
  for (const victimId of otherTies) {
    const victim = state.hotels[victimId];
    if (victim) {
      initiateMerger(state, survivor, victim);
    }
  }

  // 更小的酒店也被并购
  for (const victimId of pending.smallerVictims) {
    const victim = state.hotels[victimId];
    if (victim && victim.isActive) {
      initiateMerger(state, survivor, victim);
    }
  }

  state.pendingAcquirerChoice = null;

  const victimNames = [...otherTies, ...pending.smallerVictims]
    .map((id) => state.hotels[id]?.name)
    .filter(Boolean)
    .join('、');

  addLog(state, getCurrentPlayer(state).id, 'CHOOSE',
    `${getCurrentPlayer(state).name} 选择由 ${survivor.name} 并购 ${victimNames}`);

  advanceAfterMerger(state);

  return true;
}

/** 发起并购：创建 MergerEvent，发放分红，设置决策队列 */
function initiateMerger(state: GameState, survivor: Hotel, victim: Hotel) {
  // 安全检查：victim 可能已被之前的并购处理掉了
  if (!victim.isActive || victim.size === 0) return;

  const victimPrice = getStockPrice(victim.tier, victim.size);

  // 找出 victim 的股东（按持股数降序）
  const shareholders = state.playerOrder
    .map((pid) => {
      const player = state.players[pid];
      const holding = player.stocks.find((s) => s.hotelId === victim.id);
      return { player, quantity: holding?.quantity || 0 };
    })
    .filter((s) => s.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);

  const majority = shareholders[0];
  const minority = shareholders[1];

  const majorityBonus = victimPrice * state.config.majorityBonusMultiplier;
  const minorityBonus = victimPrice * state.config.minorityBonusMultiplier;

  // 发放分红
  if (majority) {
    majority.player.cash += majorityBonus;
    addLog(state, majority.player.id, 'BONUS',
      `${majority.player.name} 作为 ${victim.name} 最大股东(${majority.quantity}股)获得分红 $${majorityBonus.toLocaleString()}`);
  }
  if (minority) {
    minority.player.cash += minorityBonus;
    addLog(state, minority.player.id, 'BONUS',
      `${minority.player.name} 作为 ${victim.name} 第二大股东(${minority.quantity}股)获得分红 $${minorityBonus.toLocaleString()}`);
  }

  // 构建决策队列：所有持有 victim 股票的玩家
  const decisionQueue: string[] = shareholders.map((s) => s.player.id);

  const mergerEvent: MergerEvent = {
    acquiringHotelId: survivor.id,
    acquiredHotelId: victim.id,
    acquiredHotelName: victim.name,
    acquiredHotelColor: victim.color,
    victimStockPrice: victimPrice,
    majorityPlayerId: majority?.player.id || null,
    majorityPlayerName: majority?.player.name || null,
    minorityPlayerId: minority?.player.id || null,
    minorityPlayerName: minority?.player.name || null,
    majorityBonus,
    minorityBonus,
    decisionQueue,
    currentDecisionPlayerIndex: 0,
    status: 'pending',
  };

  state.activeMergers.push(mergerEvent);

  addLog(state, '', 'MERGER',
    `${survivor.name} 将并购 ${victim.name}！股价 $${victimPrice}，等待股东决策`);
}

/** 获取当前活跃并购中需要决策的玩家ID */
export function getCurrentMergerDecisionPlayer(state: GameState): string | null {
  const merger = state.activeMergers.find((m) => m.status === 'pending');
  if (!merger) return null;
  if (merger.currentDecisionPlayerIndex >= merger.decisionQueue.length) return null;
  return merger.decisionQueue[merger.currentDecisionPlayerIndex];
}

/** 玩家做出并购决策（卖/换/留） */
export function makeMergerDecision(
  state: GameState,
  mergerIndex: number,
  playerId: string,
  decision: 'sell' | 'trade' | 'hold',
  quantity: number
): { success: boolean; error?: string } {
  const merger = state.activeMergers[mergerIndex];
  if (!merger) return { success: false, error: '并购不存在' };
  if (merger.status !== 'pending') return { success: false, error: '该并购已完成' };

  const currentDecisionPlayerId = merger.decisionQueue[merger.currentDecisionPlayerIndex];
  if (currentDecisionPlayerId !== playerId) {
    return { success: false, error: '还没轮到你决策' };
  }

  const player = state.players[playerId];
  const holding = player.stocks.find((s) => s.hotelId === merger.acquiredHotelId);
  const ownedQuantity = holding?.quantity || 0;

  if (ownedQuantity <= 0) {
    return { success: false, error: '你没有该酒店的股票' };
  }
  if (quantity > ownedQuantity) {
    return { success: false, error: `你只有 ${ownedQuantity} 张股票` };
  }
  if (quantity <= 0) {
    return { success: false, error: '数量必须大于 0' };
  }

  const survivor = state.hotels[merger.acquiringHotelId];
  const victimPrice = merger.victimStockPrice;

  if (!survivor) return { success: false, error: '幸存酒店不存在' };

  switch (decision) {
    case 'sell': {
      const cashOut = victimPrice * quantity;
      player.cash += cashOut;
      holding!.quantity -= quantity;
      if (holding!.quantity <= 0) {
        player.stocks = player.stocks.filter((s) => s.hotelId !== merger.acquiredHotelId);
      }
      addLog(state, playerId, 'SELL',
        `${player.name} 卖出 ${quantity} 张 ${merger.acquiredHotelName} 股票，获得 $${cashOut.toLocaleString()}`);
      break;
    }
    case 'trade': {
      const tradeRatio = state.config.tradeRatio;
      const canTrade = Math.floor(quantity / tradeRatio);
      if (canTrade <= 0) {
        return { success: false, error: `至少需要 ${tradeRatio} 张旧股才能换 1 张新股` };
      }
      const tradedQuantity = canTrade * tradeRatio;
      const newStockCount = canTrade;

      // 扣除旧股票
      holding!.quantity -= tradedQuantity;
      if (holding!.quantity <= 0) {
        player.stocks = player.stocks.filter((s) => s.hotelId !== merger.acquiredHotelId);
      }

      // 发新股
      if (survivor.remainingStocks >= newStockCount) {
        survivor.remainingStocks -= newStockCount;
        const existingSurvivor = player.stocks.find((s) => s.hotelId === survivor.id);
        if (existingSurvivor) {
          existingSurvivor.quantity += newStockCount;
        } else {
          player.stocks.push({ hotelId: survivor.id, quantity: newStockCount });
        }
      } else {
        // 股票不够，给现金补偿
        const cashCompensation = survivor.stockPrice * newStockCount;
        player.cash += cashCompensation;
        addLog(state, playerId, 'WARNING',
          `${survivor.name} 股票不足，补偿现金 $${cashCompensation.toLocaleString()}`);
      }

      addLog(state, playerId, 'TRADE',
        `${player.name} 用 ${tradedQuantity} 张 ${merger.acquiredHotelName} 股票换了 ${newStockCount} 张 ${survivor.name} 股票`);
      break;
    }
    case 'hold': {
      // 保留不做任何操作
      addLog(state, playerId, 'HOLD',
        `${player.name} 保留了 ${quantity} 张 ${merger.acquiredHotelName} 股票`);
      break;
    }
  }

  // 移到下一个决策者
  merger.currentDecisionPlayerIndex++;
  if (merger.currentDecisionPlayerIndex >= merger.decisionQueue.length) {
    merger.status = 'completed';
    // 执行板块转移和注销
    finalizeMerger(state, merger);
  }

  return { success: true };
}

/** 所有人决策完毕后，最终执行并购 */
function finalizeMerger(state: GameState, merger: MergerEvent) {
  const survivor = state.hotels[merger.acquiringHotelId];
  const victim = state.hotels[merger.acquiredHotelId];
  if (!survivor || !victim) return;

  // 转移所有板块
  let transferredCount = 0;
  for (const tile of Object.values(state.tiles)) {
    if (tile.hotelId === victim.id) {
      tile.hotelId = survivor.id;
      transferredCount++;
    }
  }
  survivor.size += transferredCount;
  survivor.stockPrice = getStockPrice(survivor.tier, survivor.size);

  // 检查安全
  if (survivor.size >= state.config.safeSize && !survivor.isSafe) {
    survivor.isSafe = true;
    addLog(state, '', 'SAFE', `${survivor.name} 规模达到 ${survivor.size}，成为安全酒店！`);
  }

  // 注销 victim
  victim.isActive = false;
  victim.size = 0;

  addLog(state, '', 'MERGER_DONE',
    `${survivor.name} 完成并购 ${merger.acquiredHotelName}！（规模 ${survivor.size} 块）`);

  // 清理已完成的并购
  state.activeMergers = state.activeMergers.filter((m) => m.status !== 'completed');

  // 所有并购完成后，进入买股票阶段
  if (state.activeMergers.every((m) => m.status === 'completed')) {
    state.phase = 'buy_stocks';
    state.stocksBoughtThisTurn = 0;
  }
}

/** 完成所有并购决策后继续游戏 */
export function finishMergerDecisions(state: GameState) {
  state.activeMergers = state.activeMergers.filter((m) => m.status !== 'completed');
  state.phase = 'buy_stocks';
  state.stocksBoughtThisTurn = 0;
}

// ---- 酒店建立 ----

/** 玩家选择酒店后，正式建立新酒店 */
export function foundHotel(state: GameState, hotelId: string): boolean {
  const pending = state.pendingHotelFounding;
  if (!pending) return false;

  const hotel = state.hotels[hotelId];
  if (!hotel || hotel.isActive) return false;

  // 从待激活列表中移除
  const idx = state.inactiveHotels.indexOf(hotelId);
  if (idx === -1) return false;
  state.inactiveHotels.splice(idx, 1);

  // 激活酒店
  hotel.isActive = true;

  const currentPlayer = getCurrentPlayer(state);
  const placedTile = state.tiles[pending.placedTileId];

  // 把放置的板块加入酒店
  placedTile.hotelId = hotelId;
  hotel.size++;

  // 把相邻独立板块也加入酒店
  for (const adjTileId of pending.adjacentTileIds) {
    const adjTile = state.tiles[adjTileId];
    if (adjTile) {
      adjTile.hotelId = hotelId;
      hotel.size++;
    }
  }

  hotel.stockPrice = getStockPrice(hotel.tier, hotel.size);

  // 给建立者免费发一张股票
  grantStock(state, currentPlayer.id, hotelId, 1);

  addLog(
    state,
    currentPlayer.id,
    'FOUND_HOTEL',
    `${currentPlayer.name} 创立了 ${hotel.name}（规模 ${hotel.size}）并获得1张免费股票！`
  );

  // 清除 pending，进入买股票阶段
  state.pendingHotelFounding = null;
  state.phase = 'buy_stocks';
  state.stocksBoughtThisTurn = 0;

  return true;
}

// ---- 股票操作 ----

/** 给玩家发放股票 */
function grantStock(state: GameState, playerId: string, hotelId: string, quantity: number) {
  const player = state.players[playerId];
  const hotel = state.hotels[hotelId];
  if (!player || !hotel) return;

  // 检查库存
  if (hotel.remainingStocks < quantity) {
    addLog(state, playerId, 'WARNING', `${hotel.name} 股票不足！`);
    return;
  }

  hotel.remainingStocks -= quantity;

  const existing = player.stocks.find((s) => s.hotelId === hotelId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    player.stocks.push({ hotelId, quantity });
  }
}

// ---- 购买股票 ----

export interface BuyStockResult {
  success: boolean;
  error?: string;
}

/** 购买股票 */
export function buyStock(
  state: GameState,
  hotelId: string,
  quantity: number
): BuyStockResult {
  const player = getCurrentPlayer(state);
  const hotel = state.hotels[hotelId];

  if (!hotel) return { success: false, error: '酒店不存在' };
  if (!hotel.isActive) return { success: false, error: '该酒店尚未激活' };
  if (quantity <= 0) return { success: false, error: '购买数量必须大于0' };

  const maxBuy = state.config.maxBuyPerTurn;
  const remaining = maxBuy - state.stocksBoughtThisTurn;
  if (quantity > remaining) {
    return { success: false, error: `本回合最多还能买 ${remaining} 张` };
  }

  const totalCost = hotel.stockPrice * quantity;
  if (player.cash < totalCost) {
    return { success: false, error: `现金不足！需要 $${totalCost.toLocaleString()}，你只有 $${player.cash.toLocaleString()}` };
  }

  if (hotel.remainingStocks < quantity) {
    return { success: false, error: `${hotel.name} 只剩 ${hotel.remainingStocks} 股可购` };
  }

  // 扣钱
  player.cash -= totalCost;

  // 给股票
  grantStock(state, player.id, hotelId, quantity);

  // 记录
  state.stocksBoughtThisTurn += quantity;

  addLog(
    state,
    player.id,
    'BUY_STOCK',
    `${player.name} 购买了 ${quantity} 张 ${hotel.name} 股票（$${totalCost.toLocaleString()}）`
  );

  return { success: true };
}

/** 完成股票购买阶段 → 补牌 → 结束回合 */
export function completeStockBuying(state: GameState): string | null {
  const player = getCurrentPlayer(state);

  // 补牌
  const drawnId = drawTile(state);

  // 下一位玩家
  nextTurn(state);

  return drawnId;
}

/** 检查当前玩家是否可以宣布游戏结束 */
export function canDeclareEnd(state: GameState): boolean {
  return state.phase === 'place_tile' && checkEndCondition(state);
}

/** 玩家宣布游戏结束 */
export function declareGameEnd(state: GameState): boolean {
  if (!canDeclareEnd(state)) return false;

  state.status = 'finished';
  state.phase = 'game_over';
  calculateFinalScores(state);

  const player = getCurrentPlayer(state);
  addLog(state, player.id, 'DECLARE_END', `${player.name} 宣布游戏结束！`);
  addLog(state, '', 'GAME_OVER', '游戏结束！');

  return true;
}

// ---- 回合管理 ----

/** 获取当前玩家 */
export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.playerOrder[state.currentPlayerIndex]];
}

/** 切换到下一个玩家 */
export function nextTurn(state: GameState) {
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.playerOrder.length;

  const player = getCurrentPlayer(state);
  state.phase = 'place_tile';
  state.stocksBoughtThisTurn = 0;

  addLog(state, player.id, 'TURN', `${player.name} 的回合`);
}

/** 补牌：给当前玩家补到满手牌 */
export function drawTile(state: GameState): string | null {
  const player = getCurrentPlayer(state);
  const needCount = state.config.handSize - player.handTileIds.length;
  if (needCount <= 0) return null;

  // 找到所有未放置且未被持有的板块
  const allHeldTileIds = new Set<string>();
  for (const p of Object.values(state.players)) {
    for (const tid of p.handTileIds) {
      allHeldTileIds.add(tid);
    }
  }

  const availableTiles = Object.values(state.tiles).filter(
    (t) => !t.placed && !allHeldTileIds.has(t.id)
  );

  if (availableTiles.length === 0) return null;

  // 随机抽一张
  const drawn = availableTiles[Math.floor(Math.random() * availableTiles.length)];
  player.handTileIds.push(drawn.id);

  addLog(state, player.id, 'DRAW', `${player.name} 抽了一张板块`);
  return drawn.id;
}

/** 指定牌补牌（用于远程重放，保证两张客户端抽到同一张牌） */
export function drawSpecificTile(state: GameState, playerId: string, tileId: string): boolean {
  const player = state.players[playerId];
  if (!player) return false;
  if (player.handTileIds.includes(tileId)) return true; // 已经有了
  player.handTileIds.push(tileId);
  return true;
}

// ---- 终局检测 ----

/** 检查游戏是否结束 */
export function checkEndCondition(state: GameState): boolean {
  const config = state.config;

  // 检查所有激活酒店是否都安全
  const activeHotels = Object.values(state.hotels).filter((h) => h.isActive);
  const allSafe = activeHotels.length > 0 && activeHotels.every((h) => h.isSafe);

  if (config.endCondition === 'all_safe' && allSafe) return true;

  // 检查是否有酒店规模触发上限
  const maxSize = activeHotels.reduce((max, h) => Math.max(max, h.size), 0);
  if (config.endCondition === 'max_size' && maxSize >= config.maxHotelSizeTrigger)
    return true;

  // both
  if (config.endCondition === 'both') {
    if (allSafe || maxSize >= config.maxHotelSizeTrigger) return true;
  }

  return false;
}

/** 终局结算 */
export function calculateFinalScores(state: GameState) {
  const activeHotels = Object.values(state.hotels).filter((h) => h.isActive);

  // 终局分红（和并购分红规则相同）
  for (const hotel of activeHotels) {
    if (hotel.size < 2) continue;
    // TODO Phase 3: 实现终局分红
  }

  // 所有股票按市价兑现，加现金
  return state.playerOrder.map((playerId, index) => {
    const player = state.players[playerId];
    let stockValue = 0;
    for (const holding of player.stocks) {
      const hotel = state.hotels[holding.hotelId];
      if (hotel && hotel.isActive) {
        stockValue += hotel.stockPrice * holding.quantity;
      }
      // 已下市酒店的股票价值为0（玩家选择hold的）
    }
    return {
      playerId,
      playerName: player.name,
      cash: player.cash,
      stockValue,
      totalWealth: player.cash + stockValue,
      rank: 0,
    };
  });
}

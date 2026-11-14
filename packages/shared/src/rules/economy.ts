import { WAREHOUSE_UPGRADE } from "../content/upgrades";
import { LEVELS } from "../content/levels";
import { chebyshevFootprints, type FootprintRect } from "./iso";

export const PASSIVE_CAP_SECONDS = 43_200;
export const LEVEL_MULTIPLIERS = [1, 1.25, 1.5] as const;
export const DECORATION_BOOST_CAP = 0.2;
export const ROAD_BONUS = 0.05;
export const ORDER_COEFFICIENTS = { easy: 1, medium: 1.1, specialized: 1.25 } as const;
export const FRANCHISE_OWNER_SPLIT_BPS = 6000;
export const UNDO_WINDOW_SECONDS = 10;
export const WAREHOUSE_MAX_TIER = 5;
export const CHUNK_SIZE = 12;
export const WORLD_SIZE = 48;
export const TRAIN_RETURN_SECONDS = 3600;

export type BuildingLevel = 1 | 2 | 3;
export type OrderDifficulty = keyof typeof ORDER_COEFFICIENTS;

const ORDER_COEFFICIENT_BPS: { readonly [Key in OrderDifficulty]: number } = {
  easy: 100,
  medium: 110,
  specialized: 125,
};

export function levelMultiplier(level: BuildingLevel): number {
  const multiplier = LEVEL_MULTIPLIERS[level - 1];
  if (multiplier === undefined) {
    throw new Error("building level must be 1, 2, or 3");
  }
  return multiplier;
}

export function populationTotal(residences: readonly { readonly population: number; readonly level: BuildingLevel }[]): number {
  return residences.reduce((sum, residence) => sum + residence.population * levelMultiplier(residence.level), 0);
}

export function populationCapTotal(civics: readonly { readonly populationCap: number; readonly level: BuildingLevel }[]): number {
  return civics.reduce((sum, civic) => sum + civic.populationCap * levelMultiplier(civic.level), 0);
}

export function rentCollectible(input: {
  readonly now: number;
  readonly lastCollectedAt: number;
  readonly cycleSeconds: number;
  readonly baseRent: number;
  readonly level: BuildingLevel;
}): number {
  if (input.cycleSeconds <= 0) {
    throw new Error("cycleSeconds must be positive");
  }
  const elapsedCycles = Math.floor((input.now - input.lastCollectedAt) / input.cycleSeconds);
  const cappedCycles = Math.floor(PASSIVE_CAP_SECONDS / input.cycleSeconds);
  const cycles = Math.max(0, Math.min(elapsedCycles, cappedCycles));
  return cycles * input.baseRent * levelMultiplier(input.level);
}

export type NearbyDecoration = FootprintRect & {
  readonly definitionId: string;
  readonly bonus: number;
  readonly radius: number;
};

export function decorationBoostFor(business: FootprintRect, decorations: readonly NearbyDecoration[]): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const decoration of decorations) {
    if (seen.has(decoration.definitionId)) {
      continue;
    }
    if (chebyshevFootprints(business, decoration) > decoration.radius) {
      continue;
    }
    seen.add(decoration.definitionId);
    sum += decoration.bonus;
  }
  return Math.min(DECORATION_BOOST_CAP, sum);
}

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function roadBonusFor(footprint: FootprintRect, roads: readonly { readonly x: number; readonly y: number }[]): number {
  const inside = new Set<string>();
  for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
    for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) {
      inside.add(`${x},${y}`);
    }
  }
  const roadKeys = new Set(roads.map((road) => `${road.x},${road.y}`));
  for (const cell of inside) {
    const [rawX, rawY] = cell.split(",");
    const x = Number(rawX);
    const y = Number(rawY);
    for (const [dx, dy] of ORTHOGONAL) {
      const neighbor = `${x + dx},${y + dy}`;
      if (!inside.has(neighbor) && roadKeys.has(neighbor)) {
        return ROAD_BONUS;
      }
    }
  }
  return 0;
}

const LEVEL_MULTIPLIER_BPS = [100, 125, 150] as const;

export function businessReward(input: {
  readonly baseCoins: number;
  readonly level: BuildingLevel;
  readonly decorationBoost: number;
  readonly roadBonus: number;
}): number {
  const levelBps = LEVEL_MULTIPLIER_BPS[input.level - 1];
  if (levelBps === undefined) {
    throw new Error("building level must be 1, 2, or 3");
  }
  const bonusBps = Math.round((input.decorationBoost + input.roadBonus) * 10_000);
  return Math.floor((input.baseCoins * levelBps * (10_000 + bonusBps)) / 1_000_000);
}

export function orderReward(
  lines: readonly { readonly qty: number; readonly value: number }[],
  difficulty: OrderDifficulty,
): { readonly coins: number; readonly xp: number; readonly civicStars: 1 } {
  const coefficient = ORDER_COEFFICIENT_BPS[difficulty];
  const weighted = lines.reduce((sum, line) => sum + line.qty * line.value * coefficient, 0);
  const coins = Math.round(weighted / 100);
  return { coins, xp: Math.max(5, Math.round(coins / 15)), civicStars: 1 };
}

export function franchiseTotal(branchCycleValue: number, streakDays: number): number {
  const bonusPercent = streakDays <= 1 ? 0 : Math.min(10, 2 * (streakDays - 1));
  return Math.floor((branchCycleValue * (100 + bonusPercent)) / 100);
}

export function franchiseSplit(total: number): { readonly owner: number; readonly host: number } {
  const owner = Math.floor((total * FRANCHISE_OWNER_SPLIT_BPS) / 10_000);
  return { owner, host: total - owner };
}

export function warehouseCapacity(tier: number): number {
  if (!Number.isInteger(tier) || tier < 0 || tier > WAREHOUSE_MAX_TIER) {
    throw new Error("warehouse tier must be an integer from 0 to 5");
  }
  return WAREHOUSE_UPGRADE.baseCapacity + WAREHOUSE_UPGRADE.capacityPerTier * tier;
}

export function warehouseUpgradeCost(nextTier: number): { readonly coins: number; readonly planks: number } {
  if (!Number.isInteger(nextTier) || nextTier < 1 || nextTier > WAREHOUSE_MAX_TIER) {
    throw new Error("warehouse upgrade tier must be an integer from 1 to 5");
  }
  if (nextTier === 1) {
    return { coins: WAREHOUSE_UPGRADE.baseCoinCost, planks: 0 };
  }
  return { coins: WAREHOUSE_UPGRADE.baseCoinCost * nextTier, planks: WAREHOUSE_UPGRADE.planksPerTier * nextTier };
}

export type UpgradeGoodId = "GOOD_PAINT" | "GOOD_PLANKS";

export type BuildingUpgrade =
  | {
      readonly ok: true;
      readonly coins: number;
      readonly seconds: number;
      readonly goods: readonly { readonly goodId: UpgradeGoodId; readonly qty: number }[];
    }
  | { readonly ok: false; readonly reason: "MAX_LEVEL" };

export function buildingUpgradeCost(input: {
  readonly coinCost: number;
  readonly buildSeconds: number;
  readonly currentLevel: BuildingLevel;
  readonly paintUnlocked: boolean;
}): BuildingUpgrade {
  if (input.currentLevel === 3) {
    return { ok: false, reason: "MAX_LEVEL" };
  }
  const goods =
    input.currentLevel === 2
      ? [{ goodId: input.paintUnlocked ? ("GOOD_PAINT" as const) : ("GOOD_PLANKS" as const), qty: 2 }]
      : [];
  return {
    ok: true,
    coins: Math.round(input.coinCost * 0.8 * input.currentLevel),
    seconds: input.buildSeconds * input.currentLevel,
    goods,
  };
}

export function removalRefund(coinCost: number): number {
  return Math.floor(coinCost * 0.5);
}

export function expansionCost(expansionIndex: number): number {
  if (!Number.isInteger(expansionIndex) || expansionIndex < 0) {
    throw new Error("expansionIndex must be a non-negative integer");
  }
  return Math.round(1000 * 1.6 ** expansionIndex);
}

export function trainWagonReward(qty: number, unitValue: number): number {
  if (!Number.isInteger(qty) || qty < 3 || qty > 8) {
    throw new Error("wagon quantity must be an integer from 3 to 8");
  }
  return Math.round((qty * unitValue * 12) / 10);
}

export function trainCompletionBonus(wagonRewards: readonly number[]): { readonly coins: number; readonly civicStars: 1 } {
  if (wagonRewards.length !== 3) {
    throw new Error("train bonus requires 3 wagon rewards");
  }
  const total = wagonRewards.reduce((sum, reward) => sum + reward, 0);
  return { coins: Math.round(total * 0.25), civicStars: 1 };
}

export function trainReturnsAt(departedAt: number): number {
  return departedAt + TRAIN_RETURN_SECONDS;
}

export function levelForXp(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) {
    throw new Error("xp must be a non-negative finite number");
  }
  let threshold = 0;
  for (const entry of LEVELS) {
    if (entry.xpToNext !== null) threshold += entry.xpToNext;
    if (entry.xpToNext === null || totalXp < threshold) {
      return entry.level;
    }
  }
  return 15;
}

export function effectivePlacementCost(coinCost: number, firstFree: boolean, owned: number): number {
  return firstFree && owned === 0 ? 0 : coinCost;
}

export function effectiveBuildSeconds(buildSeconds: number, firstInstant: boolean, owned: number): number {
  return firstInstant && owned === 0 ? 0 : buildSeconds;
}

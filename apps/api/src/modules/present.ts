import { GOOD_IDS, QUESTS, TERRAIN_KINDS, type GoodId } from "@nf/shared/content";
import { BUILDING_STATES, FRANCHISE_STATES, TRAIN_STATES, type TrainState } from "@nf/shared/rules";
import {
  deltaSchema,
  snapshotSchema,
  type BuildingInstance,
  type CityHeader,
  type Delta,
  type FranchiseInstance,
  type OrderInstance,
  type ProductionJob,
  type QuestProgress,
  type Snapshot,
  type TrainInstance,
} from "@nf/shared/schemas";

const ORDER_DIFFICULTIES = ["easy", "medium", "specialized", "story", "recovery"] as const;
const ORDER_STATUSES = ["OPEN", "FULFILLED", "REROLLED", "REPLACED"] as const;
const QUEST_STATUSES = ["ACTIVE", "COMPLETED", "CLAIMED"] as const;
const QUEST_TRACKS = ["story", "growth", "weekly"] as const;
const STORY_PERIOD = "-";

export type PresentedCity = {
  readonly id: string;
  readonly ownerId: string | null;
  readonly name: string;
  readonly isNpc: boolean;
  readonly level: number;
  readonly xp: number;
  readonly coins: number;
  readonly gems: number;
  readonly civicStars: number;
  readonly population: number;
  readonly populationCap: number;
  readonly warehouseTier: number;
  readonly warehouseCap: number;
  readonly contentVersion: number;
  readonly version: number;
};

export type PresentedCell = {
  readonly x: number;
  readonly y: number;
  readonly terrainId: string;
  readonly ownerClaimed: boolean;
};

export type PresentedBuilding = {
  readonly id: string;
  readonly definitionId: string;
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly state: string;
  readonly version: number;
};

export type PresentedBalance = {
  readonly goodId: string;
  readonly qty: number;
};

export type PresentedJob = {
  readonly id: string;
  readonly buildingId: string;
  readonly slot: number;
  readonly recipeId: string;
  readonly startedAt: Date;
  readonly completesAt: Date;
  readonly movedToOutputAt: Date | null;
  readonly cancelledAt: Date | null;
};

export type PresentedOrder = {
  readonly id: string;
  readonly slot: number;
  readonly templateId: string;
  readonly requirements: unknown;
  readonly difficulty: string;
  readonly status: string;
  readonly rewardCoins: number;
  readonly rewardXp: number;
  readonly civicStars: number;
  readonly version: number;
};

export type PresentedTrain = {
  readonly id: string;
  readonly status: string;
  readonly wagons: unknown;
  readonly departedAt: Date | null;
  readonly returnsAt: Date | null;
};

export type PresentedFranchise = {
  readonly id: string;
  readonly ownerCity: string;
  readonly hostCity: string;
  readonly businessDefinitionId: string;
  readonly state: string;
  readonly splitBps: number;
  readonly streakDays: number;
  readonly version: number;
};

export type PresentedQuest = {
  readonly questId: string;
  readonly status: string;
  readonly stepState: unknown;
  readonly version: number;
};

export function presentCityHeader(city: PresentedCity, version = city.version): CityHeader {
  return {
    cityId: city.id,
    ownerId: city.ownerId,
    name: city.name,
    isNpc: city.isNpc,
    level: cityLevel(city.level),
    xp: city.xp,
    coins: city.coins,
    gems: city.gems,
    civicStars: city.civicStars,
    population: city.population,
    populationCap: city.populationCap,
    warehouseTier: warehouseTier(city.warehouseTier),
    warehouseCap: city.warehouseCap,
    collectPriority: "QUEST_FIRST",
    contentVersion: city.contentVersion,
    version,
  };
}

export function presentInventory(balances: readonly PresentedBalance[]): Snapshot["inventory"] {
  const inventory: Snapshot["inventory"] = {};
  for (const balance of balances) {
    if (!isGoodId(balance.goodId) || !Number.isInteger(balance.qty) || balance.qty < 0) {
      continue;
    }
    inventory[balance.goodId] = balance.qty;
  }
  return inventory;
}

export function presentSnapshot(input: {
  readonly city: PresentedCity;
  readonly cells: readonly PresentedCell[];
  readonly buildings: readonly PresentedBuilding[];
  readonly inventory: readonly PresentedBalance[];
  readonly jobs: readonly PresentedJob[];
  readonly orders: readonly PresentedOrder[];
  readonly train: PresentedTrain | null;
  readonly franchises: readonly PresentedFranchise[];
  readonly quests: readonly PresentedQuest[];
  readonly serverNow: Date;
  readonly contentVersion: number;
}): Snapshot {
  return snapshotSchema.parse({
    city: presentCityHeader(input.city),
    cells: input.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      terrainId: oneOf(cell.terrainId, TERRAIN_KINDS),
      ownerClaimed: cell.ownerClaimed,
    })),
    buildings: input.buildings.map(presentBuilding),
    inventory: presentInventory(input.inventory),
    jobs: input.jobs.filter((job) => job.movedToOutputAt === null && job.cancelledAt === null).map(presentJob),
    orders: input.orders.map(presentOrder),
    train: presentTrain(input.train),
    franchises: input.franchises.map(presentFranchise),
    quests: input.quests.map(presentQuest),
    serverNow: input.serverNow.toISOString(),
    contentVersion: input.contentVersion,
    cityVersion: input.city.version,
  });
}

export function presentDelta(input: {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly inventory: Snapshot["inventory"];
  readonly city?: CityHeader;
}): Delta {
  return deltaSchema.parse({
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    ...(input.city === undefined ? {} : { city: input.city }),
    buildings: [],
    removedBuildingIds: [],
    inventory: input.inventory,
    jobs: [],
    orders: [],
    franchises: [],
    quests: [],
  });
}

function presentBuilding(building: PresentedBuilding): BuildingInstance {
  return {
    id: building.id,
    definitionId: building.definitionId,
    level: buildingLevel(building.level),
    x: building.x,
    y: building.y,
    rotation: rotation(building.rotation),
    state: oneOf(building.state, BUILDING_STATES),
    version: building.version,
  };
}

function presentJob(job: PresentedJob): ProductionJob {
  return {
    id: job.id,
    buildingId: job.buildingId,
    slot: job.slot,
    recipeId: job.recipeId,
    startedAt: job.startedAt.toISOString(),
    completesAt: job.completesAt.toISOString(),
    version: 0,
  };
}

function presentOrder(order: PresentedOrder): OrderInstance {
  return {
    id: order.id,
    slot: order.slot,
    templateId: order.templateId,
    difficulty: oneOf(order.difficulty, ORDER_DIFFICULTIES),
    requirements: requirementMap(order.requirements),
    reward: { coins: order.rewardCoins, xp: order.rewardXp, civicStars: order.civicStars },
    status: oneOf(order.status, ORDER_STATUSES),
    version: order.version,
  };
}

function presentTrain(train: PresentedTrain | null): TrainInstance | null {
  if (train === null || !isTrainState(train.status)) {
    return null;
  }
  const wagons = trainWagons(train.wagons);
  if (wagons === null) {
    return null;
  }
  return {
    id: train.id,
    state: train.status,
    wagons,
    departedAt: train.departedAt?.toISOString() ?? null,
    returnsAt: train.returnsAt?.toISOString() ?? null,
    version: 0,
  };
}

function presentFranchise(franchise: PresentedFranchise): FranchiseInstance {
  return {
    id: franchise.id,
    ownerCityId: franchise.ownerCity,
    hostCityId: franchise.hostCity,
    businessDefinitionId: franchise.businessDefinitionId,
    state: oneOf(franchise.state, FRANCHISE_STATES),
    splitBps: franchise.splitBps,
    streakDays: franchise.streakDays,
    version: franchise.version,
  };
}

function presentQuest(quest: PresentedQuest): QuestProgress {
  const defined = QUESTS.find((item) => item.id === quest.questId);
  const track = defined === undefined ? "story" : defined.track;
  return {
    questId: quest.questId,
    periodKey: STORY_PERIOD,
    track: oneOf(track, QUEST_TRACKS),
    status: oneOf(quest.status, QUEST_STATUSES),
    stepState: stepState(quest.stepState),
    version: quest.version,
  };
}

function requirementMap(value: unknown): OrderInstance["requirements"] {
  const requirements: Record<string, number> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry) || typeof entry.goodId !== "string" || typeof entry.qty !== "number") {
        continue;
      }
      if (isGoodId(entry.goodId) && Number.isInteger(entry.qty) && entry.qty > 0) {
        requirements[entry.goodId] = entry.qty;
      }
    }
  }
  return requirements as OrderInstance["requirements"];
}

function stepState(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return { "0": 0 };
  }
  const state: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isInteger(entry) && entry >= 0) {
      state[key] = entry;
    }
  }
  return Object.keys(state).length === 0 ? { "0": 0 } : state;
}

function trainWagons(value: unknown): TrainInstance["wagons"] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const wagons: {
    goodId: GoodId;
    qty: number;
    filled: boolean;
    reward: number;
    paid: boolean;
  }[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.goodId !== "string" ||
      !isGoodId(entry.goodId) ||
      typeof entry.qty !== "number" ||
      typeof entry.filled !== "boolean" ||
      typeof entry.reward !== "number" ||
      typeof entry.paid !== "boolean"
    ) {
      return null;
    }
    wagons.push({
      goodId: entry.goodId,
      qty: entry.qty,
      filled: entry.filled,
      reward: entry.reward,
      paid: entry.paid,
    });
  }
  return wagons as TrainInstance["wagons"];
}

function isTrainState(value: string): value is TrainState {
  return (TRAIN_STATES as readonly string[]).includes(value);
}

function isGoodId(value: string): value is GoodId {
  return (GOOD_IDS as readonly string[]).includes(value);
}

function cityLevel(value: number): CityHeader["level"] {
  if (!Number.isInteger(value) || value < 1 || value > 15) {
    throw new Error(`city level ${value} is outside 1..15`);
  }
  return value as CityHeader["level"];
}

function warehouseTier(value: number): CityHeader["warehouseTier"] {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error(`warehouse tier ${value} is outside 0..5`);
  }
  return value as CityHeader["warehouseTier"];
}

function buildingLevel(value: number): BuildingInstance["level"] {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(`building level ${value} is outside 1..3`);
}

function rotation(value: number): BuildingInstance["rotation"] {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(`rotation ${value} is outside 0..3`);
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T {
  for (const candidate of allowed) {
    if (candidate === value) {
      return candidate;
    }
  }
  throw new Error(`unexpected value ${value}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

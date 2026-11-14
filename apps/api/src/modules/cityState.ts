import { presentedOrder, presentedFranchise, presentedQuest } from "./snapshot";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { TERRAIN_KINDS, type TerrainKind } from "@nf/shared/content";
import { BUILDING_STATES, type BuildingState } from "@nf/shared/rules";
import type { Delta } from "@nf/shared/schemas";
import {
  parseOutput,
  parseStacks,
  parseStock,
  serializeOutput,
  serializeStacks,
  serializeStock,
} from "../economy/catalog";
import type { Plan } from "../economy/plan";
import { buildingLevel, resolveTimers } from "../economy/timers";
import type { World, WorldBuilding, WorldCell, WorldJob, WorldQuest } from "../economy/model";
import type { Database } from "../db/client";
import { buildingCells, buildingInstances, cities, cityCells, franchises, inventoryBalances, orderInstances, productionJobs, quests } from "../db/schema";
import { ApiError } from "../errors";
import {
  presentCityHeader,
  presentDelta,
  presentInventory,
  type PresentedBuilding,
  type PresentedCity,
  type PresentedJob,
} from "./present";

type CommandTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function resolveStoredTimers(tx: CommandTx, cityId: string, now: Date, version: number): Promise<void> {
  const world = await loadWorld(tx, cityId, now);
  const changes = resolveTimers(world);
  if (changes.buildings.length === 0 && changes.jobs.length === 0) {
    return;
  }
  await writeBuildings(tx, cityId, changes.buildings, [], version);
  await writeJobs(tx, cityId, changes.jobs, version);
}

export async function applyPlan(tx: CommandTx, cityId: string, plan: Extract<Plan, { ok: true }>, version: number): Promise<void> {
  try {
    await writeBuildings(tx, cityId, plan.buildings, plan.cellReplaces, version);
    await writeJobs(tx, cityId, plan.jobs, version);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "CELL_OCCUPIED", "Cell is occupied");
    }
    throw error;
  }
}

export async function loadWorld(tx: CommandTx, cityId: string, now: Date): Promise<World> {
  const found = await tx.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  const city = found[0];
  if (city === undefined) {
    throw new ApiError(404, "NOT_FOUND", "City not found");
  }
  const cells = await tx.select().from(cityCells).where(eq(cityCells.cityId, cityId));
  const buildings = await tx.select().from(buildingInstances).where(eq(buildingInstances.cityId, cityId));
  const occupied = await tx.select().from(buildingCells).where(eq(buildingCells.cityId, cityId));
  const balances = await tx.select().from(inventoryBalances).where(eq(inventoryBalances.cityId, cityId));
  const jobs = await tx.select().from(productionJobs).where(eq(productionJobs.cityId, cityId));
  const questRows = await tx.select().from(quests).where(eq(quests.cityId, cityId));
  const occupant = new Map(occupied.map((cell) => [`${cell.x},${cell.y}`, cell.buildingId]));
  let width = 0;
  let height = 0;
  const worldCells: WorldCell[] = [];
  for (const cell of cells) {
    width = Math.max(width, cell.x + 1);
    height = Math.max(height, cell.y + 1);
    const occupantId = occupant.get(`${cell.x},${cell.y}`);
    worldCells.push({
      x: cell.x,
      y: cell.y,
      terrain: terrainOf(cell.terrainId),
      ...(occupantId === undefined ? {} : { occupantId }),
    });
  }
  const balanceMap: Record<string, number> = {};
  for (const balance of balances) {
    balanceMap[balance.goodId] = balance.qty;
  }
  return {
    now: now.getTime(),
    city: {
      id: city.id,
      level: city.level,
      xp: Number(city.xp),
      coins: Number(city.coins),
      gems: city.gems,
      civicStars: city.civicStars,
      version: Number(city.version),
      population: city.population,
      populationCap: city.populationCap,
      warehouseCap: city.warehouseCap,
      collectPriority: city.collectPriority,
      tutorialState: readTutorial(city.tutorialState),
      unlockedChunks: readChunks(city.unlockedBounds),
      width,
      height,
    },
    cells: worldCells,
    buildings: buildings.map(toWorldBuilding),
    jobs: jobs.map(toWorldJob),
    balances: balanceMap,
    quests: questRows.map(toWorldQuest),
  };
}

export async function readChangedDelta(
  tx: CommandTx,
  city: PresentedCity,
  fromVersion: number,
  toVersion: number,
  inventory: ReturnType<typeof presentInventory>,
  includeCity: boolean,
): Promise<Delta> {
  const changedBuildings = await tx
    .select()
    .from(buildingInstances)
    .where(and(eq(buildingInstances.cityId, city.id), gt(buildingInstances.version, fromVersion)));
  const changedJobs = await tx
    .select()
    .from(productionJobs)
    .where(and(eq(productionJobs.cityId, city.id), gt(productionJobs.version, fromVersion), isNull(productionJobs.movedToOutputAt), isNull(productionJobs.cancelledAt)));
  const active: PresentedBuilding[] = [];
  const removedBuildingIds: string[] = [];
  for (const building of changedBuildings) {
    if (building.removedAt !== null) {
      removedBuildingIds.push(building.id);
      continue;
    }
    active.push(toPresentedBuilding(building));
  }
  const changedOrders = await tx.select().from(orderInstances).where(and(eq(orderInstances.cityId, city.id), gt(orderInstances.version, fromVersion)));
  const changedQuests = await tx.select().from(quests).where(and(eq(quests.cityId, city.id), gt(quests.version, fromVersion)));
  const changedFranchises = await tx.select().from(franchises).where(and(eq(franchises.ownerCity, city.id), gt(franchises.version, fromVersion)));
  const counts = includeCity ? await tx.select({ definitionId: buildingInstances.definitionId, count: count() }).from(buildingInstances).where(eq(buildingInstances.cityId, city.id)).groupBy(buildingInstances.definitionId) : [];
  return presentDelta({
    orders: changedOrders.map(presentedOrder),
    quests: changedQuests.map(presentedQuest),
    franchises: changedFranchises.map(presentedFranchise),
    fromVersion,
    toVersion,
    inventory,
    ...(includeCity ? { city: presentCityHeader(city, Object.fromEntries(counts.map(row => [row.definitionId, row.count])), toVersion) } : {}),
    buildings: active,
    removedBuildingIds,
    jobs: changedJobs.map(toPresentedJob),
  });
}

async function writeBuildings(
  tx: CommandTx,
  cityId: string,
  buildings: readonly WorldBuilding[],
  cellReplaces: readonly { readonly buildingId: string; readonly cells: readonly { readonly x: number; readonly y: number }[] }[],
  version: number,
): Promise<void> {
  if (buildings.length > 0) {
    const ids = buildings.map((building) => building.id);
    const existing = await tx
      .select({ id: buildingInstances.id })
      .from(buildingInstances)
      .where(inArray(buildingInstances.id, ids));
    const existingIds = new Set(existing.map((row) => row.id));
    for (const building of buildings) {
      const values = buildingValues(cityId, building, version);
      if (existingIds.has(building.id)) {
        await tx.update(buildingInstances).set(values).where(eq(buildingInstances.id, building.id));
      } else {
        await tx.insert(buildingInstances).values({ ...values, id: building.id, createdAt: new Date(building.createdAt) });
      }
    }
  }
  for (const replace of cellReplaces) {
    await tx.delete(buildingCells).where(and(eq(buildingCells.cityId, cityId), eq(buildingCells.buildingId, replace.buildingId)));
    if (replace.cells.length > 0) {
      await tx.insert(buildingCells).values(
        replace.cells.map((cell) => ({ cityId, x: cell.x, y: cell.y, buildingId: replace.buildingId })),
      );
    }
  }
}

async function writeJobs(tx: CommandTx, cityId: string, jobs: readonly WorldJob[], version: number): Promise<void> {
  const ordered = [...jobs].sort((left, right) => Number(left.cancelledAt === null) - Number(right.cancelledAt === null) || left.slot - right.slot);
  if (ordered.length === 0) {
    return;
  }
  const existing = await tx
    .select({ id: productionJobs.id })
    .from(productionJobs)
    .where(inArray(productionJobs.id, ordered.map((job) => job.id)));
  const existingIds = new Set(existing.map((row) => row.id));
  for (const job of ordered) {
    const values = {
      buildingId: job.buildingId,
      cityId,
      slot: job.slot,
      recipeId: job.recipeId,
      inputs: serializeStacks(job.inputs),
      outputs: serializeOutput(job.outputs),
      startedAt: new Date(job.startedAt),
      completesAt: new Date(job.completesAt),
      movedToOutputAt: job.movedToOutputAt === null ? null : new Date(job.movedToOutputAt),
      cancelledAt: job.cancelledAt === null ? null : new Date(job.cancelledAt),
      version,
    };
    if (existingIds.has(job.id)) {
      await tx.update(productionJobs).set(values).where(eq(productionJobs.id, job.id));
    } else {
      await tx.insert(productionJobs).values({ ...values, id: job.id });
    }
  }
}

function buildingValues(cityId: string, building: WorldBuilding, version: number) {
  return {
    cityId,
    definitionId: building.definitionId,
    x: building.x,
    y: building.y,
    rotation: building.rotation,
    state: building.state,
    level: building.level,
    constructionCompletesAt: millisDate(building.constructionCompletesAt),
    cycleStartedAt: millisDate(building.cycleStartedAt),
    lastCollectedAt: millisDate(building.lastCollectedAt),
    stock: serializeStock(building.stock),
    outputReady: serializeOutput(building.outputReady),
    removedAt: millisDate(building.removedAt),
    undoExpiresAt: millisDate(building.undoExpiresAt),
    version,
  };
}

function toWorldBuilding(row: typeof buildingInstances.$inferSelect): WorldBuilding {
  return {
    id: row.id,
    definitionId: row.definitionId,
    level: buildingLevel(row.level),
    x: row.x,
    y: row.y,
    rotation: rotationOf(row.rotation),
    state: stateOf(row.state),
    constructionCompletesAt: millis(row.constructionCompletesAt),
    cycleStartedAt: millis(row.cycleStartedAt),
    lastCollectedAt: millis(row.lastCollectedAt),
    stock: parseStock(row.stock),
    outputReady: parseOutput(row.outputReady),
    removedAt: millis(row.removedAt),
    undoExpiresAt: millis(row.undoExpiresAt),
    createdAt: row.createdAt.getTime(),
  };
}

function toWorldJob(row: typeof productionJobs.$inferSelect): WorldJob {
  return {
    id: row.id,
    buildingId: row.buildingId,
    slot: row.slot,
    recipeId: row.recipeId,
    inputs: parseStacks(row.inputs),
    outputs: parseOutput(row.outputs),
    startedAt: row.startedAt.getTime(),
    completesAt: row.completesAt.getTime(),
    movedToOutputAt: millis(row.movedToOutputAt),
    cancelledAt: millis(row.cancelledAt),
  };
}

function toWorldQuest(row: typeof quests.$inferSelect): WorldQuest {
  const status = row.status === "COMPLETED" || row.status === "CLAIMED" || row.status === "ACTIVE" ? row.status : "ACTIVE";
  return { questId: row.questId, status, stepIndex: row.stepIndex, stepState: row.stepState };
}

function toPresentedBuilding(row: typeof buildingInstances.$inferSelect): PresentedBuilding {
  return {
    id: row.id,
    definitionId: row.definitionId,
    level: row.level,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    state: row.state,
    version: Number(row.version),
  };
}

function toPresentedJob(row: typeof productionJobs.$inferSelect): PresentedJob {
  return {
    id: row.id,
    buildingId: row.buildingId,
    slot: row.slot,
    recipeId: row.recipeId,
    startedAt: row.startedAt,
    completesAt: row.completesAt,
    movedToOutputAt: row.movedToOutputAt,
    cancelledAt: row.cancelledAt,
    version: Number(row.version),
  };
}

function terrainOf(value: string): TerrainKind {
  for (const terrain of TERRAIN_KINDS) {
    if (terrain === value) {
      return terrain;
    }
  }
  return "grass";
}

function stateOf(value: string): BuildingState {
  for (const state of BUILDING_STATES) {
    if (state === value) {
      return state;
    }
  }
  throw new Error(`unexpected building state ${value}`);
}

function rotationOf(value: number): 0 | 1 | 2 | 3 {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }
  throw new Error(`rotation ${value} is outside 0..3`);
}

function readTutorial(value: { step: string; guideNpcId: string } | null): { step: string; guideNpcId: string } | null {
  if (value === null || typeof value.step !== "string" || typeof value.guideNpcId !== "string") {
    return null;
  }
  return { step: value.step, guideNpcId: value.guideNpcId };
}

function readChunks(value: readonly (readonly number[])[]): readonly (readonly [number, number])[] {
  const chunks: [number, number][] = [];
  for (const entry of value) {
    const x = entry[0];
    const y = entry[1];
    if (typeof x === "number" && typeof y === "number") {
      chunks.push([x, y]);
    }
  }
  return chunks;
}

function millis(value: Date | null): number | null {
  return value === null ? value : value.getTime();
}

function millisDate(value: number | null): Date | null {
  return value === null ? null : new Date(value);
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return true;
  }
  return typeof error === "object" && error !== null && "cause" in error && isUniqueViolation(error.cause);
}

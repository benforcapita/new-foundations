import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { deltaSchema, snapshotQuerySchema, type Delta, type Snapshot } from "@nf/shared/schemas";
import { wantsFullSnapshot } from "../economy/snapshotMode";
import type { Database } from "../db/client";
import {
  buildingInstances,
  cities,
  franchises,
  inventoryBalances,
  orderInstances,
  productionJobs,
  quests,
  trainShipments,
} from "../db/schema";
import { ApiError } from "../errors";
import { loadCurrentCity } from "./city";
import { presentCityHeader, presentDelta, presentInventory, type PresentedBuilding, type PresentedFranchise, type PresentedJob, type PresentedOrder, type PresentedQuest, type PresentedTrain } from "./present";

export async function loadCitySnapshot(
  db: Database,
  cityId: string,
  ownerId: string,
  sinceVersion: number | null,
  now: Date,
): Promise<Snapshot | Delta> {
  const found = await db.select().from(cities).where(and(eq(cities.id, cityId), eq(cities.ownerId, ownerId))).limit(1);
  const city = found[0];
  if (city === undefined) {
    throw new ApiError(404, "NOT_FOUND", "City not found");
  }
  if (sinceVersion !== null && sinceVersion > Number(city.version)) {
    throw new ApiError(400, "VALIDATION", "sinceVersion cannot exceed the city version");
  }
  if (wantsFullSnapshot({ sinceVersion, cityVersion: Number(city.version), updatedAtMs: city.updatedAt.getTime(), nowMs: now.getTime() })) {
    return loadCurrentCity(db, cityId, now);
  }
  const fromVersion = sinceVersion ?? 0;
  const [buildings, jobs, orders, trains, ownedFranchises, hostedFranchises, questRows, balances] = await Promise.all([
    db.select().from(buildingInstances).where(and(eq(buildingInstances.cityId, cityId), gt(buildingInstances.version, fromVersion))),
    db
      .select()
      .from(productionJobs)
      .where(and(eq(productionJobs.cityId, cityId), gt(productionJobs.version, fromVersion), isNull(productionJobs.movedToOutputAt), isNull(productionJobs.cancelledAt)))
      .orderBy(asc(productionJobs.slot)),
    db.select().from(orderInstances).where(and(eq(orderInstances.cityId, cityId), gt(orderInstances.version, fromVersion))),
    db
      .select()
      .from(trainShipments)
      .where(and(eq(trainShipments.cityId, cityId), ne(trainShipments.status, "ARRIVED"), gt(trainShipments.version, fromVersion)))
      .limit(1),
    db.select().from(franchises).where(and(eq(franchises.ownerCity, cityId), gt(franchises.version, fromVersion))),
    db.select().from(franchises).where(and(eq(franchises.hostCity, cityId), gt(franchises.version, fromVersion))),
    db.select().from(quests).where(and(eq(quests.cityId, cityId), gt(quests.version, fromVersion))),
    db.select().from(inventoryBalances).where(and(eq(inventoryBalances.cityId, cityId), gt(inventoryBalances.version, fromVersion))),
  ]);
  const active: PresentedBuilding[] = [];
  const removedBuildingIds: string[] = [];
  for (const building of buildings) {
    if (building.removedAt !== null) {
      removedBuildingIds.push(building.id);
    } else {
      active.push(presentedBuilding(building));
    }
  }
  const seen = new Set<string>();
  const franchiseRows = [...ownedFranchises, ...hostedFranchises].filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
  return deltaSchema.parse(
    presentDelta({
      fromVersion,
      toVersion: Number(city.version),
      inventory: presentInventory(balances),
      ...(fromVersion < Number(city.version) ? { city: presentCityHeader(city) } : {}),
      buildings: active,
      removedBuildingIds,
      jobs: jobs.map(presentedJob),
      orders: orders.map(presentedOrder),
      train: trains[0] === undefined ? undefined : presentedTrain(trains[0]),
      franchises: franchiseRows.map(presentedFranchise),
      quests: questRows.map(presentedQuest),
    }),
  );
}

export function readSinceVersion(cityId: string, query: unknown): number | null {
  const record = isRecord(query) ? query : {};
  const raw = record.sinceVersion;
  if (raw === undefined) {
    return null;
  }
  const sinceVersion = typeof raw === "string" || typeof raw === "number" ? Number(raw) : Number.NaN;
  const parsed = snapshotQuerySchema.safeParse({ cityId, sinceVersion });
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION", "sinceVersion must be a nonnegative integer");
  }
  return parsed.data.sinceVersion ?? null;
}

function presentedBuilding(row: typeof buildingInstances.$inferSelect): PresentedBuilding {
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

function presentedJob(row: typeof productionJobs.$inferSelect): PresentedJob {
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

export function presentedOrder(row: typeof orderInstances.$inferSelect): PresentedOrder {
  return {
    id: row.id,
    slot: row.slot,
    templateId: row.templateId,
    requirements: row.requirements,
    difficulty: row.difficulty,
    status: row.status,
    rewardCoins: row.rewardCoins,
    rewardXp: row.rewardXp,
    civicStars: row.civicStars,
    version: Number(row.version),
  };
}

function presentedTrain(row: typeof trainShipments.$inferSelect): PresentedTrain {
  return {
    id: row.id,
    status: row.status,
    wagons: row.wagons,
    departedAt: row.departedAt,
    returnsAt: row.returnsAt,
    version: Number(row.version),
  };
}

export function presentedFranchise(row: typeof franchises.$inferSelect): PresentedFranchise {
  return {
    id: row.id,
    ownerCity: row.ownerCity,
    hostCity: row.hostCity,
    businessDefinitionId: row.businessDefinitionId,
    state: row.state,
    splitBps: row.splitBps,
    streakDays: row.streakDays,
    version: Number(row.version),
  };
}

export function presentedQuest(row: typeof quests.$inferSelect): PresentedQuest {
  return {
    questId: row.questId,
    periodKey: row.periodKey,
    track: row.track,
    status: row.status,
    stepState: row.stepState,
    version: Number(row.version),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

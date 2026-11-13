import { and, asc, eq, ne } from "drizzle-orm";
import { CONTENT_VERSION } from "@nf/shared";
import type { Database } from "../db/client";
import {
  buildingInstances,
  cities,
  cityCells,
  franchises,
  inventoryBalances,
  orderInstances,
  productionJobs,
  quests,
  trainShipments,
} from "../db/schema";
import { ApiError } from "../errors";

export async function loadCurrentCity(db: Database, cityId: string, now: Date): Promise<Record<string, unknown>> {
  const found = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  const city = found[0];
  if (city === undefined) {
    throw new ApiError(404, "NOT_FOUND", "City not found");
  }
  const [cells, buildings, inventory, jobs, orders, trains, ownedFranchises, hostedFranchises, questRows] = await Promise.all([
    db.select().from(cityCells).where(eq(cityCells.cityId, cityId)).orderBy(asc(cityCells.y), asc(cityCells.x)),
    db.select().from(buildingInstances).where(eq(buildingInstances.cityId, cityId)).orderBy(asc(buildingInstances.id)),
    db.select().from(inventoryBalances).where(eq(inventoryBalances.cityId, cityId)).orderBy(asc(inventoryBalances.goodId)),
    db.select().from(productionJobs).where(eq(productionJobs.cityId, cityId)).orderBy(asc(productionJobs.slot)),
    db.select().from(orderInstances).where(eq(orderInstances.cityId, cityId)).orderBy(asc(orderInstances.slot)),
    db
      .select()
      .from(trainShipments)
      .where(and(eq(trainShipments.cityId, cityId), ne(trainShipments.status, "ARRIVED")))
      .limit(1),
    db.select().from(franchises).where(eq(franchises.ownerCity, cityId)),
    db.select().from(franchises).where(eq(franchises.hostCity, cityId)),
    db.select().from(quests).where(eq(quests.cityId, cityId)).orderBy(asc(quests.questId)),
  ]);
  const franchiseIds = new Set<string>();
  const franchiseRows = [...ownedFranchises, ...hostedFranchises].filter((row) => {
    if (franchiseIds.has(row.id)) {
      return false;
    }
    franchiseIds.add(row.id);
    return true;
  });
  const train = trains[0] ?? null;
  return {
    city: {
      id: city.id,
      ownerId: city.ownerId,
      name: city.name,
      level: city.level,
      xp: city.xp,
      coins: city.coins,
      gems: city.gems,
      civicStars: city.civicStars,
      version: city.version,
      population: city.population,
      populationCap: city.populationCap,
      warehouseTier: city.warehouseTier,
      warehouseCap: city.warehouseCap,
      isNpc: city.isNpc,
      catalogId: city.catalogId,
      tutorialState: city.tutorialState,
    },
    cells: cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      terrainId: cell.terrainId,
      ownerClaimed: cell.ownerClaimed,
      cellRole: cell.cellRole,
    })),
    buildings: buildings.map((building) => ({
      id: building.id,
      definitionId: building.definitionId,
      x: building.x,
      y: building.y,
      rotation: building.rotation,
      state: building.state,
      level: building.level,
      version: building.version,
      pendingOutput: building.pendingOutput,
    })),
    inventory: inventory.map((stack) => ({ goodId: stack.goodId, qty: stack.qty })),
    jobs: jobs.map((job) => ({
      id: job.id,
      buildingId: job.buildingId,
      slot: job.slot,
      recipeId: job.recipeId,
      startedAt: job.startedAt.toISOString(),
      completesAt: job.completesAt.toISOString(),
      claimedAt: job.claimedAt?.toISOString() ?? null,
      movedToOutputAt: job.movedToOutputAt?.toISOString() ?? null,
      cancelledAt: job.cancelledAt?.toISOString() ?? null,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      slot: order.slot,
      templateId: order.templateId,
      requirements: order.requirements,
      status: order.status,
      difficulty: order.difficulty,
      solvable: order.solvable,
      rewardCoins: order.rewardCoins,
      rewardXp: order.rewardXp,
      civicStars: order.civicStars,
    })),
    train:
      train === null
        ? null
        : {
            id: train.id,
            status: train.status,
            stationId: train.stationId,
            wagons: train.wagons,
            departedAt: train.departedAt?.toISOString() ?? null,
            returnsAt: train.returnsAt?.toISOString() ?? null,
          },
    franchises: franchiseRows.map((franchise) => ({
      id: franchise.id,
      ownerCity: franchise.ownerCity,
      hostCity: franchise.hostCity,
      businessDefinitionId: franchise.businessDefinitionId,
      state: franchise.state,
      splitBps: franchise.splitBps,
      streakDays: franchise.streakDays,
      version: franchise.version,
      plotX: franchise.plotX,
      plotY: franchise.plotY,
    })),
    quests: questRows.map((quest) => ({
      questId: quest.questId,
      status: quest.status,
      stepIndex: quest.stepIndex,
      stepState: quest.stepState,
      version: quest.version,
    })),
    serverNow: now.toISOString(),
    contentVersion: CONTENT_VERSION,
    cityVersion: city.version,
  };
}

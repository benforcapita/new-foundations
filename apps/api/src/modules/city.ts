import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import { CONTENT_VERSION } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
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
import { ensureTrain } from "./train";
import { presentSnapshot } from "./present";

export async function loadCurrentCity(db: Database, cityId: string, now: Date): Promise<Snapshot> {
  await ensureTrain(db, cityId, now);
  const found = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
  const city = found[0];
  if (city === undefined) {
    throw new ApiError(404, "NOT_FOUND", "City not found");
  }
  const [cells, buildings, counts, inventory, jobs, orders, trains, ownedFranchises, hostedFranchises, questRows] = await Promise.all([
    db.select().from(cityCells).where(eq(cityCells.cityId, cityId)).orderBy(asc(cityCells.y), asc(cityCells.x)),
    db
      .select()
      .from(buildingInstances)
      .where(and(eq(buildingInstances.cityId, cityId), isNull(buildingInstances.removedAt)))
      .orderBy(asc(buildingInstances.id)),
    db.select({ definitionId: buildingInstances.definitionId, count: count() }).from(buildingInstances).where(eq(buildingInstances.cityId, cityId)).groupBy(buildingInstances.definitionId),
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
  return presentSnapshot({
    city,
    placedCounts: Object.fromEntries(counts.map(row => [row.definitionId, row.count])),
    cells,
    buildings,
    inventory,
    jobs,
    orders,
    train: trains[0] ?? null,
    franchises: franchiseRows,
    quests: questRows,
    serverNow: now,
    contentVersion: CONTENT_VERSION,
  });
}

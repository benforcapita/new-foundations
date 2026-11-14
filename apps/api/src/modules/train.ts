import { and, eq, ne } from "drizzle-orm";
import { trainCompletionBonus, trainReturnsAt } from "@nf/shared";
import { trainWagonSchema } from "@nf/shared/schemas";
import { trainShipments } from "../db/schema";
import { ApiError } from "../errors";
import type { CommandContext, CommandEffects } from "../plugins/idempotency";
import { loadWorld } from "./cityState";

export async function trainCommand(ctx: CommandContext, cityId: string, action: "train-supply" | "train-dispatch", body: { wagonIndex: number; qty: number } | Record<string, never>): Promise<CommandEffects> {
  const world = await loadWorld(ctx.tx, cityId, ctx.now);
  if (!world.buildings.some(b => b.definitionId === "B-011" && b.removedAt === null)) throw new ApiError(409, "STATE_CHANGED", "Train Station is unavailable");
  const [train] = await ctx.tx.select().from(trainShipments).where(and(eq(trainShipments.cityId, cityId), ne(trainShipments.status, "ARRIVED"))).limit(1);
  if (!train || train.status !== "LOADING") throw new ApiError(409, "STATE_CHANGED", "Train is not loading");
  const wagons = train.wagons.map(w => trainWagonSchema.parse(w));
  if (action === "train-dispatch") {
    await ctx.tx.update(trainShipments).set({ status: "IN_TRANSIT", departedAt: ctx.now, returnsAt: new Date(trainReturnsAt(ctx.now.getTime() / 1000) * 1000), version: ctx.versionAfter }).where(eq(trainShipments.id, train.id));
    return { ledger: [], result: { trainId: train.id } };
  }
  const { wagonIndex, qty } = body as { wagonIndex: number; qty: number };
  const wagon = wagons[wagonIndex];
  if (!wagon || wagon.filled || qty !== wagon.qty) throw new ApiError(409, "STATE_CHANGED", "Wagon is unavailable");
  if ((world.balances[wagon.goodId] ?? 0) < qty) throw new ApiError(409, "INSUFFICIENT_GOODS", "Not enough goods");
  wagons[wagonIndex] = { ...wagon, filled: true, paid: true };
  const complete = wagons.every(w => w.filled) && !train.completionBonusPaid;
  const bonus = complete ? trainCompletionBonus(wagons.map(w => w.reward)) : null;
  await ctx.tx.update(trainShipments).set({ wagons, completionBonusPaid: train.completionBonusPaid || complete, version: ctx.versionAfter }).where(eq(trainShipments.id, train.id));
  return { ledger: [{ resource: wagon.goodId, delta: -qty, source: "train_supply" }, { resource: "COINS", delta: wagon.reward + (bonus?.coins ?? 0), source: "train_supply" }, ...(bonus ? [{ resource: "CIVIC_STARS", delta: bonus.civicStars, source: "train_completion" }] : [])], result: { wagonIndex, reward: wagon.reward, bonus }, telemetry: { name: "train_supplied", payload: { wagonIndex } } };
}

// A wheat plot is protected by the removal rules, so each shipment is producible
// even when the player has no inventory or other production buildings.
export async function ensureTrain(db: import("../db/client").Database, cityId: string, now: Date): Promise<void> {
  const { randomUUID } = await import("node:crypto");
  const { buildingInstances, cities, quests } = await import("../db/schema");
  const { isNull, sql } = await import("drizzle-orm");
  const { goodById, trainWagonReward } = await import("@nf/shared");
  const { TRAIN_BALANCE: balance } = await import("@nf/shared/content");
  await db.transaction(async tx => {
    const [city] = await tx.select().from(cities).where(eq(cities.id, cityId)).for("update");
    if (!city) return;
    if (city.level >= 3) {
      const inserted = await tx.insert(quests).values({ cityId, questId: "quest_tom_train", periodKey: "-", track: "story", status: "ACTIVE", stepIndex: 0, stepState: { "0": 0 }, startedAt: now, version: Number(city.version) + 1 }).onConflictDoNothing().returning();
      if (inserted.length) {
        city.version = Number(city.version) + 1;
        await tx.update(cities).set({ version: city.version, updatedAt: now }).where(eq(cities.id, cityId));
      }
    }
    const [station] = await tx.select().from(buildingInstances).where(and(eq(buildingInstances.cityId, cityId), eq(buildingInstances.definitionId, "B-011"), isNull(buildingInstances.removedAt))).limit(1);
    if (!station) return;
    const [active] = await tx.select().from(trainShipments).where(and(eq(trainShipments.cityId, cityId), ne(trainShipments.status, "ARRIVED"))).limit(1);
    if (active && (active.status !== "IN_TRANSIT" || !active.returnsAt || active.returnsAt > now)) return;
    const version = Number(city.version) + 1;
    if (active) await tx.update(trainShipments).set({ status: "ARRIVED", version }).where(eq(trainShipments.id, active.id));
    const qty = balance.wagonQuantity;
    const wagon = { goodId: "GOOD_WHEAT", qty, filled: false, paid: false, reward: trainWagonReward(qty, goodById("GOOD_WHEAT").value) };
    await tx.insert(trainShipments).values({ id: randomUUID(), cityId, stationId: station.id, status: "LOADING", wagons: [wagon, wagon, wagon], version });
    await tx.update(cities).set({ version, updatedAt: sql`${now}` }).where(eq(cities.id, cityId));
  });
}

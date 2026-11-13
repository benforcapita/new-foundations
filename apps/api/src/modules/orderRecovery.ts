import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { RECOVERY_ORDER, needsRecoveryOrder } from "@nf/shared";
import { orderInstances } from "../db/schema";
import { orderSolvable } from "../economy/orders";
import type { CommandContext } from "../plugins/idempotency";
import { loadWorld } from "./cityState";

export async function ensureRecoveryOrder(ctx: CommandContext, cityId: string): Promise<void> {
  const world = await loadWorld(ctx.tx, cityId, ctx.now);
  if (world.city.coins >= RECOVERY_ORDER.coinThreshold) return;
  const open = await ctx.tx.select().from(orderInstances).where(and(eq(orderInstances.cityId, cityId), eq(orderInstances.status, "OPEN")));
  if (!needsRecoveryOrder(world.city.coins, open.map((order) => ({ solvable: orderSolvable(world, order.requirements) })))) return;
  const slot = open.find((order) => order.slot === 0);
  if (slot === undefined || slot.templateId === RECOVERY_ORDER.id) return;
  await ctx.tx.update(orderInstances).set({ status: "REPLACED", version: ctx.versionAfter }).where(eq(orderInstances.id, slot.id));
  await ctx.tx.insert(orderInstances).values({ id: randomUUID(), cityId, slot: 0, templateId: RECOVERY_ORDER.id, requirements: RECOVERY_ORDER.requirements.map((line) => ({ ...line })), status: "OPEN", difficulty: "recovery", solvable: true, rewardCoins: RECOVERY_ORDER.coins, rewardXp: RECOVERY_ORDER.xp, civicStars: 0, version: ctx.versionAfter });
}

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cities, orderInstances } from "../db/schema";
import { generatedOrder } from "../economy/orders";
import { levelRewardEntries } from "../economy/ledger";
import { ApiError } from "../errors";
import type { CommandContext, CommandEffects } from "../plugins/idempotency";
import { loadWorld } from "./cityState";

export async function orderCommand(ctx: CommandContext, cityId: string, action: "fulfill-order" | "reroll-order", orderId: string): Promise<CommandEffects> {
  const world = await loadWorld(ctx.tx, cityId, ctx.now);
  const [city] = await ctx.tx.select().from(cities).where(eq(cities.id, cityId));
  const orders = await ctx.tx.select().from(orderInstances).where(and(eq(orderInstances.cityId, cityId), eq(orderInstances.status, "OPEN")));
  const order = orders.find((item) => item.id === orderId);
  if (order === undefined || city === undefined) throw new ApiError(404, "NOT_FOUND", "Order not found");
  if (action === "reroll-order" && city.lastFreeRerollAt !== null && ctx.now.getTime() - city.lastFreeRerollAt.getTime() < 900_000) throw new ApiError(422, "REROLL_COOLDOWN", "Free reroll is cooling down");
  if (action === "fulfill-order" && order.requirements.some((line) => (world.balances[line.goodId] ?? 0) < line.qty)) throw new ApiError(409, "INSUFFICIENT_GOODS", "Not enough goods");
  await ctx.tx.update(orderInstances).set({ status: action === "fulfill-order" ? "FULFILLED" : "REROLLED", fulfilledAt: action === "fulfill-order" ? ctx.now : null, version: ctx.versionAfter }).where(eq(orderInstances.id, order.id));
  if (action === "reroll-order") await ctx.tx.update(cities).set({ lastFreeRerollAt: ctx.now }).where(eq(cities.id, cityId));
  const others = orders.filter((item) => item.id !== order.id);
  const generated = generatedOrder(world, others.map((item) => item.requirements), action === "reroll-order" ? order.requirements.map((line) => line.goodId) : []);
  await ctx.tx.insert(orderInstances).values({ id: randomUUID(), cityId, slot: order.slot, ...generated, status: "OPEN", solvable: true, rewardCoins: generated.coins, rewardXp: generated.xp, civicStars: generated.civicStars, version: ctx.versionAfter });
  if (action === "reroll-order") return { ledger: [], result: { orderId }, telemetry: { name: "order_rerolled", payload: { orderId } } };
  return { ledger: [...order.requirements.map((line) => ({ resource: line.goodId, delta: -line.qty, source: "order_completed", refType: "order", refId: order.id })), { resource: "COINS", delta: order.rewardCoins, source: "order_completed" }, { resource: "XP", delta: order.rewardXp, source: "order_completed" }, ...(order.civicStars ? [{ resource: "CIVIC_STARS", delta: order.civicStars, source: "order_completed" }] : []), ...levelRewardEntries(world.city.xp, world.city.xp + order.rewardXp)], result: { orderId, coins: order.rewardCoins, xp: order.rewardXp, civicStars: order.civicStars }, telemetry: { name: "order_completed", payload: { orderId } } };
}

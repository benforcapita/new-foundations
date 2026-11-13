import { AGRICULTURE, GOODS, RECIPES, buildingById, generateOrderBoard, orderReward } from "@nf/shared";
import type { World } from "./model";

type Requirement = { readonly goodId: string; readonly qty: number };

/** Whether the currently owned production chain can eventually supply a card. */
export function orderSolvable(world: World, requirements: readonly Requirement[]): boolean {
  if (requirements.reduce((sum, line) => sum + line.qty, 0) > world.city.warehouseCap) return false;
  const available = { ...world.balances };
  const owned = new Set(world.buildings.filter((building) => building.removedAt === null).map((building) => building.definitionId));
  function consume(goodId: string, qty: number, visiting: ReadonlySet<string>): boolean {
    const held = Math.min(qty, available[goodId] ?? 0);
    available[goodId] = (available[goodId] ?? 0) - held;
    const remaining = qty - held;
    if (remaining === 0) return true;
    if (visiting.has(goodId)) return false;
    const plot = AGRICULTURE.find((item) => item.outputGoodId === goodId && item.unlockLevel <= world.city.level && owned.has(item.id));
    if (plot !== undefined) return true;
    const recipe = RECIPES.find((item) => item.unlockLevel <= world.city.level && owned.has(item.buildingId) && item.outputs.some((output) => output.goodId === goodId));
    const output = recipe?.outputs.find((item) => item.goodId === goodId);
    if (recipe === undefined || output === undefined || recipe.inputs.reduce((sum, item) => sum + item.qty, 0) > world.city.warehouseCap || output.qty > world.city.warehouseCap) return false;
    const batches = Math.ceil(remaining / output.qty);
    const next = new Set(visiting).add(goodId);
    for (const input of recipe.inputs) if (!consume(input.goodId, input.qty * batches, next)) return false;
    available[goodId] = (available[goodId] ?? 0) + batches * output.qty - remaining;
    return true;
  }
  return requirements.every((line) => consume(line.goodId, line.qty, new Set()));
}

export function generatedOrder(world: World, otherOrders: readonly (readonly Requirement[])[], avoidGoods: readonly string[] = []) {
  const available = new Set<string>();
  for (const plot of AGRICULTURE) if (plot.unlockLevel <= world.city.level && plot.outputQty <= world.city.warehouseCap) available.add(plot.outputGoodId);
  for (let pass = 0; pass < RECIPES.length; pass += 1) {
    for (const recipe of RECIPES) {
      if (recipe.unlockLevel <= world.city.level && buildingById(recipe.buildingId).unlockLevel <= world.city.level && recipe.inputs.reduce((sum, line) => sum + line.qty, 0) <= world.city.warehouseCap && recipe.outputs.reduce((sum, line) => sum + line.qty, 0) <= world.city.warehouseCap && recipe.inputs.every((line) => available.has(line.goodId))) {
        for (const output of recipe.outputs) available.add(output.goodId);
      }
    }
  }
  const unlocked = GOODS.filter((good) => good.unlockLevel <= world.city.level && world.city.warehouseCap >= 3 && available.has(good.id));
  const catalog = generateOrderBoard({ level: world.city.level, coins: world.city.coins, unlockedGoodIds: unlocked.map((good) => good.id), hasSolvableOpenOrder: true });
  const candidate = catalog.find((order) => !order.requirements.some((line) => avoidGoods.includes(line.goodId)) && order.requirements.reduce((sum, line) => sum + line.qty, 0) <= world.city.warehouseCap && !otherOrders.every((other) => order.requirements.some((line) => other.some((existing) => existing.goodId === line.goodId))));
  if (candidate !== undefined && candidate.coins !== undefined && candidate.xp !== undefined && candidate.difficulty !== "story" && candidate.difficulty !== "recovery") {
    return { templateId: candidate.id, requirements: candidate.requirements.map((line) => ({ ...line })), difficulty: candidate.difficulty, coins: candidate.coins, xp: candidate.xp, civicStars: 1 as const };
  }
  const valid = unlocked.filter((good) => !otherOrders.every((order) => order.some((line) => line.goodId === good.id)));
  const picked = valid.find((good) => !avoidGoods.includes(good.id)) ?? valid[0] ?? unlocked[0];
  if (picked === undefined) throw new Error("no unlocked good can fit in warehouse");
  const requirements = [{ goodId: picked.id, qty: 3 }];
  const reward = orderReward([{ qty: 3, value: picked.value }], "easy");
  return { templateId: `ORD-GEN-${picked.id}`, requirements, difficulty: "easy" as const, ...reward };
}

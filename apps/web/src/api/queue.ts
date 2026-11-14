import { QUESTS, RECIPES } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
import type { CommandBody } from "./client";
type Name = "upgrade-warehouse" | "upgrade-building" | "set-collect-priority" | "claim-quest" | "place-building" | "move-building" | "remove-building" | "collect" | "collect-all" | "start-production" | "cancel-production" | "supply-business" | "fulfill-order" | "reroll-order";
export type PendingCommand = { [N in Name]: { key: string; name: N; body: CommandBody<N> } }[Name];
export function composeSnapshot(snapshot: Snapshot, queue: readonly PendingCommand[]): Snapshot {
  let buildings = [...snapshot.buildings];
  let jobs = [...(snapshot.jobs ?? [])];
  let orders = [...(snapshot.orders ?? [])];
  let quests = [...(snapshot.quests ?? [])];
  const inventory = { ...snapshot.inventory };
  let city = snapshot.city;
  const removed = new Map<string, Snapshot["buildings"][number]>();
  for (const command of queue) {
    switch (command.name) {
      case "claim-quest": {
        const quest = quests.find(q => q.questId === command.body.questId && q.periodKey === command.body.periodKey && q.status === "COMPLETED");
        const definition = QUESTS.find(q => q.id === command.body.questId);
        if (!quest || !definition) break;
        city = { ...city, coins: city.coins + definition.reward.coins, xp: city.xp + definition.reward.xp };
        quests = quests.map(q => q === quest ? { ...q, status: "CLAIMED" } : q);
        break;
      }
      case "fulfill-order":
      case "reroll-order": {
        const order = orders.find(o => o.id === command.body.orderId && o.status === "OPEN");
        if (!order) break;
        if (command.name === "fulfill-order") {
          if (Object.entries(order.requirements).some(([id, qty]) => (inventory[id as keyof typeof inventory] ?? 0) < qty)) break;
          for (const [id, qty] of Object.entries(order.requirements)) { const key = id as keyof typeof inventory; inventory[key] = (inventory[key] ?? 0) - qty; }
          city = { ...city, coins: city.coins + order.reward.coins, xp: city.xp + order.reward.xp, civicStars: city.civicStars + order.reward.civicStars };
        }
        orders = orders.map(o => o.id === order.id ? { ...o, status: command.name === "fulfill-order" ? "FULFILLED" : "REROLLED" } : o);
        break;
      }
      case "place-building": buildings.push({ id: `pending:${command.key}`, definitionId: command.body.definitionId, x: command.body.x, y: command.body.y, rotation: command.body.rotation, state: "UNDER_CONSTRUCTION", level: 1, version: 0 }); break;
      case "move-building": buildings = buildings.map(b => b.id === command.body.instanceId ? { ...b, x: command.body.x, y: command.body.y, rotation: command.body.rotation } : b); break;
      case "remove-building": {
        const id = command.body.instanceId;
        if (command.body.undo) { const previous = removed.get(id); if (previous) buildings.push(previous); }
        else { const previous = buildings.find(b => b.id === id); if (previous) removed.set(id, previous); buildings = buildings.filter(b => b.id !== id); }
        break;
      }
      case "collect": buildings = buildings.map(b => b.id === command.body.instanceId && b.state === "READY_TO_COLLECT" ? { ...b, state: "ACTIVE" } : b); break;
      case "collect-all": buildings = buildings.map(b => b.state === "READY_TO_COLLECT" ? { ...b, state: "ACTIVE" } : b); break;
      case "supply-business": buildings = buildings.map(b => b.id === command.body.instanceId && b.state === "NEEDS_SUPPLY" ? { ...b, state: "ACTIVE" } : b); break;
      case "start-production": {
        const recipe = RECIPES.find(r => r.id === command.body.recipeId);
        const start = new Date(Math.max(Date.parse(snapshot.serverNow || new Date().toISOString()), ...jobs.filter(j => j.buildingId === command.body.instanceId).map(j => Date.parse(j.completesAt))));
        const slot = (snapshot.city?.level >= 5 ? [0, 1, 2] : [0, 1]).find(i => !jobs.some(j => j.buildingId === command.body.instanceId && j.slot === i));
        if (recipe && slot !== undefined) jobs.push({ id: `pending:${command.key}`, buildingId: command.body.instanceId, recipeId: recipe.id, slot, startedAt: start.toISOString(), completesAt: new Date(start.getTime() + recipe.seconds * 1000).toISOString(), version: 0 });
        buildings = buildings.map(b => b.id === command.body.instanceId ? { ...b, state: "PRODUCING" } : b); break;
      }
      case "cancel-production": jobs = jobs.filter(j => j.id !== command.body.jobId); buildings = buildings.map(b => b.id === command.body.instanceId && !jobs.some(j => j.buildingId === b.id) ? { ...b, state: "ACTIVE" } : b); break;
    }
  }
  return { ...snapshot, buildings, jobs, orders, quests, inventory, city };
}

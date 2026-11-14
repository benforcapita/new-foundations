import { AGRICULTURE, BUILDINGS, DECORATIONS, ROAD } from "@nf/shared";
import type { Snapshot } from "@nf/shared/schemas";
export const hasReady = (snapshot: Snapshot | null) => snapshot?.buildings.some(b => b.state === "READY_TO_COLLECT") ?? false;
export function canPlaceFlowerBench(snapshot: Snapshot) {
  const quest = snapshot.quests.find(q => q.questId === "quest_flower_street");
  return quest !== undefined && !snapshot.buildings.some(b => b.definitionId === "D-003")
    && (quest.status === "COMPLETED" || quest.status === "CLAIMED"
      || (quest.status === "ACTIVE" && ((quest.stepState["6"] ?? 0) >= 1
        || (quest.stepState["5"] === 1 && (quest.stepState["6"] ?? 0) === 0))));
}
export function catalogAvailability(snapshot: Snapshot, definition: typeof BUILDINGS[number] | typeof AGRICULTURE[number] | typeof DECORATIONS[number] | typeof ROAD) {
  const free = "firstFree" in definition && definition.firstFree && (snapshot.city.placedCounts?.[definition.id] ?? 0) === 0;
  return { locked: snapshot.city.level < definition.unlockLevel, affordable: free || snapshot.city.coins >= definition.cost.coins, cost: free ? 0 : definition.cost.coins };
}

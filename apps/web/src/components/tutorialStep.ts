import { buildingById, canPlace, placeableFromBuilding } from "@nf/shared";
import { livePlacementCity } from "../game/liveCity";
import type { Snapshot } from "@nf/shared/schemas";

export function tutorialStep(snapshot: Snapshot): string | null {
  const quest = (id: string) => snapshot.quests.find(q => q.questId === id);
  if (quest("quest_tutorial_bakery")?.status !== undefined && quest("quest_tutorial_bakery")?.status !== "ACTIVE") return null;
  if (!snapshot.buildings.some(b => b.definitionId === "B-001")) return "house";
  const wheat = snapshot.buildings.find(b => b.definitionId === "AG-001" && b.x === 0 && b.y === 0);
  if (wheat?.state === "READY_TO_COLLECT") return "wheat";
  const groceryQuest = quest("quest_tutorial_grocery");
  if (!groceryQuest || groceryQuest.status === "ACTIVE") return "supply";
  const grocery = snapshot.buildings.find(b => b.definitionId === "B-004");
  if (grocery?.state !== "NEEDS_SUPPLY") return "coins";
  return "bakery";
}


export function tutorialTarget(snapshot: Snapshot, step: string | null): { x: number; y: number } | undefined {
  if (step === "wheat") return snapshot.buildings.find(b => b.definitionId === "AG-001" && b.x === 0 && b.y === 0);
  if (step === "supply" || step === "coins") return snapshot.buildings.find(b => b.definitionId === "B-004");
  if (step !== "house" && step !== "bakery") return undefined;
  const definition = placeableFromBuilding(buildingById(step === "house" ? "B-001" : "B-007"));
  const city = livePlacementCity(snapshot);
  const preferred = step === "house" ? { x: 0, y: 6 } : { x: 2, y: 6 };
  return [preferred, ...snapshot.cells].find(c => canPlace(city, definition, c.x, c.y, 0).ok);
}

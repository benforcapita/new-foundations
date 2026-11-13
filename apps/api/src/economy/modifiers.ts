import { businessReward, decorationBoostFor, roadBonusFor, rotatedFootprint } from "@nf/shared";
import type { NearbyDecoration } from "@nf/shared/rules";
import { findPlaceable } from "./catalog";
import type { WorldBuilding } from "./model";

export function commercialYield(building: WorldBuilding, buildings: readonly WorldBuilding[]): number {
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null || placeable.kind !== "building" || placeable.definition.category !== "commercial") {
    return 0;
  }
  const { decorationBoost, roadBonus } = modifiersFor(building, buildings);
  return businessReward({
    baseCoins: placeable.definition.coinYield,
    level: building.level,
    decorationBoost,
    roadBonus,
  });
}

export function modifiersFor(
  building: WorldBuilding,
  buildings: readonly WorldBuilding[],
): { readonly decorationBoost: number; readonly roadBonus: number } {
  const placeable = findPlaceable(building.definitionId);
  if (placeable === null) {
    return { decorationBoost: 0, roadBonus: 0 };
  }
  const size = rotatedFootprint(placeable.placeable.footprint.width, placeable.placeable.footprint.height, building.rotation);
  const footprint = { x: building.x, y: building.y, width: size.width, height: size.height };
  const decorations: NearbyDecoration[] = [];
  const roads: { x: number; y: number }[] = [];
  for (const other of buildings) {
    if (other.removedAt !== null || other.id === building.id) {
      continue;
    }
    const otherPlaceable = findPlaceable(other.definitionId);
    if (otherPlaceable === null) {
      continue;
    }
    const otherSize = rotatedFootprint(
      otherPlaceable.placeable.footprint.width,
      otherPlaceable.placeable.footprint.height,
      other.rotation,
    );
    const tune = decorationTune(otherPlaceable);
    if (tune !== null) {
      decorations.push({
        definitionId: other.definitionId,
        bonus: tune.boost,
        radius: tune.radius,
        x: other.x,
        y: other.y,
        width: otherSize.width,
        height: otherSize.height,
      });
    }
    if (otherPlaceable.kind === "road") {
      for (let dy = 0; dy < otherSize.height; dy += 1) {
        for (let dx = 0; dx < otherSize.width; dx += 1) {
          roads.push({ x: other.x + dx, y: other.y + dy });
        }
      }
    }
  }
  return {
    decorationBoost: decorationBoostFor(footprint, decorations),
    roadBonus: roadBonusFor(footprint, roads),
  };
}

function decorationTune(
  placeable: NonNullable<ReturnType<typeof findPlaceable>>,
): { readonly boost: number; readonly radius: number } | null {
  switch (placeable.kind) {
    case "decoration":
      return { boost: placeable.definition.boost, radius: placeable.definition.radius };
    case "building":
      return placeable.definition.category === "decoration"
        ? { boost: placeable.definition.boost, radius: placeable.definition.boostRadius }
        : null;
    case "agriculture":
    case "road":
      return null;
    default: {
      const unreachable: never = placeable;
      throw new Error(`unknown placeable ${String(unreachable)}`);
    }
  }
}

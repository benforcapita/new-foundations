import { AGRICULTURE } from "./agriculture";
import { BUILDINGS } from "./buildings";
import { DECORATIONS } from "./decorations";
import { GOODS } from "./goods";
import { LEVELS } from "./levels";
import { TERRAIN_ASSETS } from "./maps";
import { NPC_CITIES, NPCS } from "./npcs";
import { ORDER_TEMPLATES, RECOVERY_ORDER } from "./orders";
import { QUESTS } from "./quests";
import { RECIPES } from "./recipes";
import { ROAD } from "./roads";

export type CatalogNameRef = {
  readonly nameKey: string;
  readonly assetId?: string;
};

export function catalogNameRefs(): readonly CatalogNameRef[] {
  const refs: CatalogNameRef[] = [];
  for (const building of BUILDINGS) {
    refs.push({ nameKey: building.nameKey, assetId: building.assetId });
  }
  for (const plot of AGRICULTURE) {
    refs.push({ nameKey: plot.nameKey, assetId: plot.overlayAssetId });
  }
  for (const good of GOODS) {
    refs.push({ nameKey: good.nameKey, assetId: good.iconAssetId });
  }
  for (const recipe of RECIPES) {
    refs.push({ nameKey: recipe.nameKey });
  }
  for (const decoration of DECORATIONS) {
    refs.push({ nameKey: decoration.nameKey, assetId: decoration.assetId });
  }
  refs.push({ nameKey: ROAD.nameKey });
  for (const level of LEVELS) {
    refs.push({ nameKey: level.nameKey });
  }
  for (const quest of QUESTS) {
    refs.push({ nameKey: quest.nameKey });
  }
  for (const template of ORDER_TEMPLATES) {
    refs.push({ nameKey: template.nameKey });
  }
  refs.push({ nameKey: RECOVERY_ORDER.nameKey });
  for (const npc of NPCS) {
    refs.push({ nameKey: npc.nameKey });
    refs.push({ nameKey: npc.summaryKey });
  }
  for (const city of NPC_CITIES) {
    refs.push({ nameKey: city.nameKey });
  }
  return refs;
}

export function phase01AssetIds(): readonly string[] {
  const ids = new Set<string>();
  for (const building of BUILDINGS) {
    if (building.contentPhase !== "later") {
      ids.add(building.assetId);
    }
  }
  for (const plot of AGRICULTURE) {
    if (plot.contentPhase === "later") {
      continue;
    }
    ids.add(plot.groundAssetId);
    ids.add(plot.overlayAssetId);
    if (plot.propAssetId !== undefined) {
      ids.add(plot.propAssetId);
    }
  }
  for (const good of GOODS) {
    if (good.contentPhase !== "later") {
      ids.add(good.iconAssetId);
    }
  }
  for (const decoration of DECORATIONS) {
    if (decoration.contentPhase !== "later" && decoration.assetId !== undefined) {
      ids.add(decoration.assetId);
    }
  }
  if (ROAD.contentPhase !== "later") {
    for (const assetId of Object.values(ROAD.tiles)) {
      ids.add(assetId);
    }
  }
  for (const assetId of Object.values(TERRAIN_ASSETS)) {
    ids.add(assetId);
  }
  return [...ids];
}

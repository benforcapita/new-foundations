import manifest from "../../../../assets/asset_manifest.json" with { type: "json" };
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

const MANIFEST_ASSET_IDS = new Set(manifest.assets.map((entry) => entry.name));

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

function collectManifestIds(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    if (MANIFEST_ASSET_IDS.has(value)) {
      into.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectManifestIds(item, into);
    }
    return;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (record.contentPhase === "later") {
      return;
    }
    for (const child of Object.values(record)) {
      collectManifestIds(child, into);
    }
  }
}

/** Every manifest asset id stored on a Phase 0/1 catalog value, including fields added later. */
export function phase01AssetIds(): readonly string[] {
  const ids = new Set<string>();
  for (const catalog of [BUILDINGS, AGRICULTURE, GOODS, RECIPES, DECORATIONS, ROAD, TERRAIN_ASSETS, NPCS, NPC_CITIES, QUESTS]) {
    collectManifestIds(catalog, ids);
  }
  return [...ids];
}

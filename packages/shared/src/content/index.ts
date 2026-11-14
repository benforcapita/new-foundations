import { assertPlayableAssets } from "../assets/assetMeta";
import { phase01AssetIds } from "./references";

export { phase01AssetIds };
export { AGRICULTURE, agricultureById, type AgriculturePlot } from "./agriculture";
export { LANDMARK_DECORATION, STREET_DECORATION, type DecorationTune } from "./boosts";
export {
  BUILDINGS,
  buildingById,
  commercialInputCapacity,
  type BuildingCategory,
  type BuildingDefinition,
  type CivicBuilding,
  type CommercialBuilding,
  type DecorationBuilding,
  type LogisticsBuilding,
  type ProductionBuilding,
  type ResidentialBuilding,
} from "./buildings";
export { DECORATIONS, decorationById, type DecorationDefinition } from "./decorations";
export { GOODS, goodById, type GoodDefinition, type GoodTier } from "./goods";
export {
  AGRICULTURE_IDS,
  BUILDING_IDS,
  DECORATION_IDS,
  GOOD_IDS,
  NPC_CITY_IDS,
  NPC_IDS,
  RECIPE_IDS,
  ROAD_ID,
  TERRAIN_KINDS,
  type AgricultureId,
  type BuildingId,
  type ContentPhase,
  type DecorationId,
  type Footprint,
  type GoodId,
  type GoodStack,
  type NpcCityId,
  type NpcId,
  type RecipeId,
  type RoadId,
  type TerrainKind,
} from "./ids";
export { LEVELS, type LevelDefinition } from "./levels";
export { STARTER_MAP, TERRAIN_ASSETS, parseStarterMap, type StarterMap } from "./maps";
export { NPC_CITIES, NPCS, npcById, type NpcCityDefinition, type NpcDefinition } from "./npcs";
export {
  ORDER_GENERATOR,
  ORDER_TEMPLATES,
  RECOVERY_ORDER,
  generateOrderBoard,
  type GeneratedOrder,
  type OrderBoardInput,
  type OrderDifficulty,
  type OrderTemplate,
} from "./orders";
export { QUESTS, type QuestDefinition, type QuestEvent } from "./quests";
export { RECIPES, recipeById, type RecipeDefinition } from "./recipes";
export { catalogNameRefs, type CatalogNameRef } from "./references";
export { ROAD, type RoadDefinition } from "./roads";
export { CONTENT_VERSION } from "./version";

assertPlayableAssets(phase01AssetIds());

export { BUILDING_UPGRADE } from "./upgrades";
export { default as TRAIN_BALANCE } from "./train.balance.json" with { type: "json" };

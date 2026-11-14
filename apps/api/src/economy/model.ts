import {
  populationCapTotal,
  populationTotal,
  type BuildingLevel,
  type BuildingState,
  type GoodId,
  type QuarterTurns,
} from "@nf/shared";
import { cloneStock, findPlaceable, type BuildingStock, type OutputReady } from "./catalog";

export const TUTORIAL_SALE_SECONDS = 10;

export type WorldCity = {
  readonly id: string;
  readonly level: number;
  readonly xp: number;
  readonly coins: number;
  readonly gems: number;
  readonly civicStars: number;
  readonly version: number;
  readonly population: number;
  readonly populationCap: number;
  readonly warehouseCap: number;
  readonly collectPriority: "QUEST_FIRST" | "OLDEST_FIRST";
  readonly tutorialState: { readonly step: string; readonly guideNpcId: string } | null;
  readonly unlockedChunks: readonly (readonly [number, number])[];
  readonly width: number;
  readonly height: number;
};

export type WorldCell = {
  readonly x: number;
  readonly y: number;
  readonly terrain: "grass" | "grass_flowers" | "plaza" | "water" | "shore";
  readonly occupantId?: string;
};

export type WorldBuilding = {
  readonly id: string;
  readonly definitionId: string;
  readonly level: BuildingLevel;
  readonly x: number;
  readonly y: number;
  readonly rotation: QuarterTurns;
  readonly state: BuildingState;
  readonly constructionCompletesAt: number | null;
  readonly upgradeCompletesAt?: number | null;
  readonly cycleStartedAt: number | null;
  readonly lastCollectedAt: number | null;
  readonly stock: BuildingStock;
  readonly outputReady: OutputReady | null;
  readonly removedAt: number | null;
  readonly undoExpiresAt: number | null;
  readonly createdAt: number;
};

export type WorldJob = {
  readonly id: string;
  readonly buildingId: string;
  readonly slot: number;
  readonly recipeId: string;
  readonly inputs: readonly { readonly goodId: GoodId; readonly qty: number }[];
  readonly outputs: OutputReady | null;
  readonly startedAt: number;
  readonly completesAt: number;
  readonly movedToOutputAt: number | null;
  readonly cancelledAt: number | null;
};

export type WorldQuest = {
  readonly questId: string;
  readonly status: "ACTIVE" | "COMPLETED" | "CLAIMED";
  readonly stepIndex: number;
  readonly stepState: Readonly<Record<string, number>>;
};

export type World = {
  readonly now: number;
  readonly city: WorldCity;
  readonly cells: readonly WorldCell[];
  readonly buildings: readonly WorldBuilding[];
  readonly jobs: readonly WorldJob[];
  readonly balances: Readonly<Record<string, number>>;
  readonly quests: readonly WorldQuest[];
  readonly orderGoods?: readonly string[];
};

export function cloneBuilding(building: WorldBuilding): WorldBuilding {
  return {
    ...building,
    stock: cloneStock(building.stock),
    outputReady: building.outputReady === null ? null : { ...building.outputReady },
  };
}

export function cloneJob(job: WorldJob): WorldJob {
  return { ...job, inputs: job.inputs.map((input) => ({ ...input })) };
}

export function projectPopulation(buildings: readonly WorldBuilding[]): { readonly population: number; readonly populationCap: number } {
  const residences: { population: number; level: BuildingLevel }[] = [];
  const civics: { populationCap: number; level: BuildingLevel }[] = [];
  for (const building of buildings) {
    if (building.removedAt !== null) {
      continue;
    }
    const placeable = findPlaceable(building.definitionId);
    if (placeable === null || placeable.kind !== "building") {
      continue;
    }
    if (placeable.definition.category === "residential") {
      residences.push({ population: placeable.definition.population, level: building.level });
    } else if (placeable.definition.category === "civic") {
      civics.push({ populationCap: placeable.definition.populationCap, level: building.level });
    }
  }
  return {
    population: Math.round(populationTotal(residences)),
    populationCap: Math.round(populationCapTotal(civics)),
  };
}

export function activeBuildings(buildings: readonly WorldBuilding[]): WorldBuilding[] {
  return buildings.filter((building) => building.removedAt === null);
}

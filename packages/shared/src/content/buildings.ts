import { LANDMARK_DECORATION } from "./boosts";
import {
  byId,
  type BuildingId,
  type ContentPhase,
  type Footprint,
  type GoodId,
  type GoodStack,
  type NpcId,
} from "./ids";

type BuildingBase = {
  readonly id: BuildingId;
  readonly nameKey: string;
  readonly footprint: Footprint;
  readonly cost: { readonly coins: number };
  readonly buildSeconds: number;
  readonly firstFree: boolean;
  readonly firstInstant: boolean;
  readonly prebuilt: boolean;
  readonly unlockLevel: number;
  readonly assetId: string;
  readonly contentPhase: ContentPhase;
};

export type ResidentialBuilding = BuildingBase & {
  readonly category: "residential";
  readonly population: number;
  readonly rent: { readonly coins: number; readonly seconds: number };
};

export type CommercialBuilding = BuildingBase & {
  readonly category: "commercial";
  readonly stockInput: readonly GoodStack[];
  readonly salesCycleSeconds: number;
  readonly coinYield: number;
  readonly stockedCycles: number;
};

export type ProductionBuilding = BuildingBase & {
  readonly category: "production";
  readonly produces: readonly GoodId[];
};

export type CivicBuilding = BuildingBase & {
  readonly category: "civic";
  readonly populationCap: number;
  readonly npcId?: NpcId;
};

export type LogisticsBuilding = BuildingBase & {
  readonly category: "logistics";
  readonly wagonCount: number;
  readonly npcId: NpcId;
};

export type DecorationBuilding = BuildingBase & {
  readonly category: "decoration";
  readonly boost: number;
  readonly boostRadius: number;
};

export type BuildingDefinition =
  | ResidentialBuilding
  | CommercialBuilding
  | ProductionBuilding
  | CivicBuilding
  | LogisticsBuilding
  | DecorationBuilding;

export type BuildingCategory = BuildingDefinition["category"];

const cottage: ResidentialBuilding = {
  id: "B-001",
  nameKey: "building.cottage.name",
  category: "residential",
  footprint: { width: 2, height: 2 },
  cost: { coins: 180 },
  buildSeconds: 30,
  firstFree: true,
  firstInstant: true,
  prebuilt: false,
  unlockLevel: 1,
  population: 8,
  rent: { coins: 32, seconds: 480 },
  assetId: "bld_res_cottage",
  contentPhase: "p0",
};

const rowhouse: ResidentialBuilding = {
  id: "B-002",
  nameKey: "building.rowhouse.name",
  category: "residential",
  footprint: { width: 2, height: 2 },
  cost: { coins: 430 },
  buildSeconds: 180,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 4,
  population: 18,
  rent: { coins: 60, seconds: 900 },
  assetId: "bld_res_rowhouse",
  contentPhase: "p1",
};

const apartments: ResidentialBuilding = {
  id: "B-003",
  nameKey: "building.apartments.name",
  category: "residential",
  footprint: { width: 3, height: 3 },
  cost: { coins: 1750 },
  buildSeconds: 2400,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 9,
  population: 50,
  rent: { coins: 140, seconds: 1800 },
  assetId: "bld_res_apartments",
  contentPhase: "p1",
};

const grocery: CommercialBuilding = {
  id: "B-004",
  nameKey: "building.grocery.name",
  category: "commercial",
  footprint: { width: 2, height: 2 },
  cost: { coins: 500 },
  buildSeconds: 120,
  firstFree: false,
  firstInstant: true,
  prebuilt: false,
  unlockLevel: 1,
  stockInput: [{ goodId: "GOOD_BREAD", qty: 3 }],
  salesCycleSeconds: 600,
  coinYield: 110,
  stockedCycles: 3,
  assetId: "bld_com_grocery",
  contentPhase: "p0",
};

const cafe: CommercialBuilding = {
  id: "B-005",
  nameKey: "building.cafe.name",
  category: "commercial",
  footprint: { width: 2, height: 2 },
  cost: { coins: 980 },
  buildSeconds: 720,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 5,
  stockInput: [
    { goodId: "GOOD_CHEESE", qty: 2 },
    { goodId: "GOOD_MILK", qty: 2 },
  ],
  salesCycleSeconds: 1200,
  coinYield: 185,
  stockedCycles: 3,
  assetId: "bld_com_cafe",
  contentPhase: "p1",
};

const bookstore: CommercialBuilding = {
  id: "B-006",
  nameKey: "building.bookstore.name",
  category: "commercial",
  footprint: { width: 2, height: 2 },
  cost: { coins: 1800 },
  buildSeconds: 2100,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 10,
  stockInput: [{ goodId: "GOOD_BOOKS", qty: 6 }],
  salesCycleSeconds: 2100,
  coinYield: 290,
  stockedCycles: 3,
  assetId: "bld_com_bookstore",
  contentPhase: "p1",
};

const bakery: ProductionBuilding = {
  id: "B-007",
  nameKey: "building.bakery.name",
  category: "production",
  footprint: { width: 2, height: 2 },
  cost: { coins: 350 },
  buildSeconds: 180,
  firstFree: true,
  firstInstant: true,
  prebuilt: false,
  unlockLevel: 1,
  produces: ["GOOD_BREAD", "GOOD_CHEESE"],
  assetId: "bld_prod_bakery",
  contentPhase: "p0",
};

const carpenter: ProductionBuilding = {
  id: "B-008",
  nameKey: "building.carpenter.name",
  category: "production",
  footprint: { width: 3, height: 3 },
  cost: { coins: 860 },
  buildSeconds: 600,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 4,
  produces: ["GOOD_PLANKS", "GOOD_PAINT", "GOOD_BOOKS"],
  assetId: "bld_prod_carpenter",
  contentPhase: "p1",
};

const townHall: CivicBuilding = {
  id: "B-009",
  nameKey: "building.townhall.name",
  category: "civic",
  footprint: { width: 4, height: 4 },
  cost: { coins: 0 },
  buildSeconds: 0,
  firstFree: false,
  firstInstant: false,
  prebuilt: true,
  unlockLevel: 1,
  populationCap: 50,
  npcId: "NPC-MIA",
  assetId: "bld_civic_townhall",
  contentPhase: "p0",
};

const school: CivicBuilding = {
  id: "B-010",
  nameKey: "building.school.name",
  category: "civic",
  footprint: { width: 3, height: 3 },
  cost: { coins: 1250 },
  buildSeconds: 1800,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 6,
  populationCap: 75,
  assetId: "bld_civic_school",
  contentPhase: "p1",
};

const trainStation: LogisticsBuilding = {
  id: "B-011",
  nameKey: "building.trainstation.name",
  category: "logistics",
  footprint: { width: 4, height: 3 },
  cost: { coins: 900 },
  buildSeconds: 480,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 3,
  wagonCount: 3,
  npcId: "NPC-TOM",
  assetId: "bld_log_trainstation",
  contentPhase: "p1",
};

const park: DecorationBuilding = {
  id: "B-012",
  nameKey: "building.park.name",
  category: "decoration",
  footprint: { width: 3, height: 3 },
  cost: { coins: 600 },
  buildSeconds: 300,
  firstFree: false,
  firstInstant: false,
  prebuilt: false,
  unlockLevel: 4,
  boost: LANDMARK_DECORATION.boost,
  boostRadius: LANDMARK_DECORATION.radius,
  assetId: "bld_deco_park",
  contentPhase: "p1",
};

export const BUILDINGS: readonly BuildingDefinition[] = [
  cottage,
  rowhouse,
  apartments,
  grocery,
  cafe,
  bookstore,
  bakery,
  carpenter,
  townHall,
  school,
  trainStation,
  park,
];

export function buildingById(id: BuildingId): BuildingDefinition {
  return byId(BUILDINGS, id, "building");
}

export function commercialInputCapacity(building: CommercialBuilding): number {
  const perCycle = building.stockInput.reduce((sum, line) => sum + line.qty, 0);
  return perCycle * building.stockedCycles;
}

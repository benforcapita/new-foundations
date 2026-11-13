import { z } from "zod";
import { GOOD_IDS } from "../content/ids";
import { BUILDING_STATES, FRANCHISE_STATES, TRAIN_STATES } from "../rules/stateMachines";

const goodQtySchema = z.object({
  goodId: z.enum(GOOD_IDS),
  qty: z.number().int().positive(),
});

const rotationSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const buildingLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const cityHeaderSchema = z.object({
  cityId: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(1).max(15),
  xp: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  civicStars: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  contentVersion: z.number().int().positive(),
  population: z.number().nonnegative(),
  populationCap: z.number().nonnegative(),
  warehouseTier: z.number().int().min(0).max(5),
  warehouseUsed: z.number().int().nonnegative(),
});

export const buildingInstanceSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  level: buildingLevelSchema,
  x: z.number().int(),
  y: z.number().int(),
  rotation: rotationSchema,
  state: z.enum(BUILDING_STATES),
  version: z.number().int().nonnegative(),
  lastCollectedAt: z.number().int().nonnegative().optional(),
  inventory: z.array(goodQtySchema).optional(),
});

export const plotInstanceSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  state: z.enum(["GROWING", "READY_TO_COLLECT"]),
  plantedAt: z.number().int().nonnegative(),
  readyAt: z.number().int().nonnegative(),
});

export const decorationInstanceSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  rotation: rotationSchema,
});

export const roadInstanceSchema = z.object({
  id: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
});

export const inventoryStackSchema = z.object({
  goodId: z.enum(GOOD_IDS),
  qty: z.number().int().nonnegative(),
});

export const orderInstanceSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "specialized"]),
  requirements: z.array(goodQtySchema),
  status: z.enum(["OPEN", "FULFILLED"]),
  solvable: z.boolean(),
  rewardCoins: z.number().int().nonnegative(),
  rewardXp: z.number().int().nonnegative(),
  civicStars: z.number().int().nonnegative(),
});

export const productionJobSchema = z.object({
  id: z.string().min(1),
  buildingId: z.string().min(1),
  recipeId: z.string().min(1),
  startedAt: z.number().int().nonnegative(),
  completesAt: z.number().int().nonnegative(),
  claimedAt: z.number().int().nonnegative().nullable(),
  state: z.enum(["PRODUCING", "READY_TO_COLLECT"]),
});

export const franchiseInstanceSchema = z.object({
  id: z.string().min(1),
  ownerCityId: z.string().min(1),
  hostCityId: z.string().min(1),
  businessDefinitionId: z.string().min(1),
  state: z.enum(FRANCHISE_STATES),
  splitBps: z.number().int().min(0).max(10_000),
  streakDays: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
});

export const trainWagonSchema = z.object({
  goodId: z.enum(GOOD_IDS),
  qty: z.number().int().min(3).max(8),
  filled: z.boolean(),
  rewardCoins: z.number().int().nonnegative(),
});

export const trainInstanceSchema = z.object({
  id: z.string().min(1),
  stationId: z.string().min(1),
  state: z.enum(TRAIN_STATES),
  departedAt: z.number().int().nonnegative().nullable(),
  returnsAt: z.number().int().nonnegative().nullable(),
  wagons: z.array(trainWagonSchema).length(3),
});

export const questProgressSchema = z.object({
  questId: z.string().min(1),
  status: z.enum(["ACTIVE", "COMPLETE"]),
  stepIndex: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
});

export const unlockedChunkSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export const snapshotSchema = z.object({
  header: cityHeaderSchema,
  buildings: z.array(buildingInstanceSchema),
  plots: z.array(plotInstanceSchema),
  decorations: z.array(decorationInstanceSchema),
  roads: z.array(roadInstanceSchema),
  inventory: z.array(inventoryStackSchema),
  orders: z.array(orderInstanceSchema),
  productionJobs: z.array(productionJobSchema),
  franchises: z.array(franchiseInstanceSchema),
  trains: z.array(trainInstanceSchema),
  quests: z.array(questProgressSchema),
  unlockedChunks: z.array(unlockedChunkSchema),
});

export const deltaSchema = z
  .object({
    cityId: z.string().min(1),
    baseVersion: z.number().int().nonnegative(),
    version: z.number().int().nonnegative(),
    header: cityHeaderSchema.partial().optional(),
    upserts: z.object({
      buildings: z.array(buildingInstanceSchema).optional(),
      plots: z.array(plotInstanceSchema).optional(),
      decorations: z.array(decorationInstanceSchema).optional(),
      roads: z.array(roadInstanceSchema).optional(),
      inventory: z.array(inventoryStackSchema).optional(),
      orders: z.array(orderInstanceSchema).optional(),
      productionJobs: z.array(productionJobSchema).optional(),
      franchises: z.array(franchiseInstanceSchema).optional(),
      trains: z.array(trainInstanceSchema).optional(),
      quests: z.array(questProgressSchema).optional(),
    }),
    removals: z.object({
      buildingIds: z.array(z.string()).optional(),
      plotIds: z.array(z.string()).optional(),
      decorationIds: z.array(z.string()).optional(),
      roadIds: z.array(z.string()).optional(),
      orderIds: z.array(z.string()).optional(),
      franchiseIds: z.array(z.string()).optional(),
      trainIds: z.array(z.string()).optional(),
      questIds: z.array(z.string()).optional(),
    }),
  })
  .refine((delta) => delta.version >= delta.baseVersion, {
    message: "version must not move backwards",
  });

export type CityHeader = z.infer<typeof cityHeaderSchema>;
export type BuildingInstance = z.infer<typeof buildingInstanceSchema>;
export type PlotInstance = z.infer<typeof plotInstanceSchema>;
export type DecorationInstance = z.infer<typeof decorationInstanceSchema>;
export type RoadInstance = z.infer<typeof roadInstanceSchema>;
export type InventoryStack = z.infer<typeof inventoryStackSchema>;
export type OrderInstance = z.infer<typeof orderInstanceSchema>;
export type ProductionJob = z.infer<typeof productionJobSchema>;
export type FranchiseInstance = z.infer<typeof franchiseInstanceSchema>;
export type TrainInstance = z.infer<typeof trainInstanceSchema>;
export type QuestProgress = z.infer<typeof questProgressSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Delta = z.infer<typeof deltaSchema>;

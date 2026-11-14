import { z } from "zod";
import { GOOD_IDS } from "../content/ids";
import { BUILDING_STATES, FRANCHISE_STATES, TRAIN_STATES } from "../rules/stateMachines";

const rotationSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const buildingLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const terrainSchema = z.enum(["grass", "grass_flowers", "plaza", "water", "shore"]);

export const cityHeaderSchema = z.object({
  placedCounts: z.record(z.string().min(1), z.number().int().nonnegative()).default({}),
  cityId: z.string().min(1),
  ownerId: z.string().min(1).nullable(),
  name: z.string().min(1),
  isNpc: z.boolean(),
  level: z.number().int().min(1).max(15),
  xp: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  civicStars: z.number().int().nonnegative(),
  population: z.number().nonnegative(),
  populationCap: z.number().nonnegative(),
  warehouseTier: z.number().int().min(0).max(5),
  warehouseCap: z.number().int().positive(),
  collectPriority: z.enum(["QUEST_FIRST", "OLDEST_FIRST"]),
  contentVersion: z.number().int().positive(),
  version: z.number().int().nonnegative(),
});

export const cellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  terrainId: terrainSchema,
  ownerClaimed: z.boolean(),
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
});

export const inventoryMapSchema = z.record(z.enum(GOOD_IDS), z.number().int().nonnegative());

export const orderInstanceSchema = z.object({
  id: z.string().min(1),
  slot: z.number().int().min(0).max(2),
  templateId: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "specialized", "story", "recovery"]),
  requirements: z.record(z.enum(GOOD_IDS), z.number().int().positive()),
  reward: z.object({
    coins: z.number().int().nonnegative(),
    xp: z.number().int().nonnegative(),
    civicStars: z.number().int().nonnegative(),
  }),
  status: z.enum(["OPEN", "FULFILLED", "REROLLED", "REPLACED"]),
  version: z.number().int().nonnegative(),
});

export const productionJobSchema = z.object({
  id: z.string().min(1),
  buildingId: z.string().min(1),
  slot: z.number().int().min(0).max(2),
  recipeId: z.string().min(1),
  startedAt: z.string().datetime(),
  completesAt: z.string().datetime(),
  version: z.number().int().nonnegative(),
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
  reward: z.number().int().nonnegative(),
  paid: z.boolean(),
});

export const trainInstanceSchema = z.object({
  id: z.string().min(1),
  state: z.enum(TRAIN_STATES),
  wagons: z.array(trainWagonSchema).length(3),
  departedAt: z.string().datetime().nullable(),
  returnsAt: z.string().datetime().nullable(),
  version: z.number().int().nonnegative(),
});

export const questProgressSchema = z.object({
  questId: z.string().min(1),
  periodKey: z.string().min(1),
  track: z.enum(["story", "growth", "weekly"]),
  status: z.enum(["ACTIVE", "COMPLETED", "CLAIMED"]),
  stepState: z.record(z.string(), z.number().int().nonnegative()),
  version: z.number().int().nonnegative(),
});

export const snapshotSchema = z.object({
  city: cityHeaderSchema,
  cells: z.array(cellSchema),
  buildings: z.array(buildingInstanceSchema),
  inventory: inventoryMapSchema,
  jobs: z.array(productionJobSchema),
  orders: z.array(orderInstanceSchema),
  train: trainInstanceSchema.nullable(),
  franchises: z.array(franchiseInstanceSchema),
  quests: z.array(questProgressSchema),
  serverNow: z.string().datetime(),
  contentVersion: z.number().int().positive(),
  cityVersion: z.number().int().nonnegative(),
});

export const deltaSchema = z
  .object({
    fromVersion: z.number().int().nonnegative(),
    toVersion: z.number().int().nonnegative(),
    city: cityHeaderSchema.optional(),
    buildings: z.array(buildingInstanceSchema),
    removedBuildingIds: z.array(z.string()),
    inventory: inventoryMapSchema,
    jobs: z.array(productionJobSchema),
    orders: z.array(orderInstanceSchema),
    train: trainInstanceSchema.optional(),
    franchises: z.array(franchiseInstanceSchema),
    quests: z.array(questProgressSchema),
  })
  .refine((delta) => delta.toVersion >= delta.fromVersion, {
    message: "toVersion must not move backwards",
  });

export type CityHeader = z.infer<typeof cityHeaderSchema>;
export type Cell = z.infer<typeof cellSchema>;
export type BuildingInstance = z.infer<typeof buildingInstanceSchema>;
export type OrderInstance = z.infer<typeof orderInstanceSchema>;
export type ProductionJob = z.infer<typeof productionJobSchema>;
export type FranchiseInstance = z.infer<typeof franchiseInstanceSchema>;
export type TrainInstance = z.infer<typeof trainInstanceSchema>;
export type QuestProgress = z.infer<typeof questProgressSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Delta = z.infer<typeof deltaSchema>;

import { z } from "zod";
import { AGRICULTURE_IDS, BUILDING_IDS, DECORATION_IDS, GOOD_IDS, RECIPE_IDS, ROAD_ID } from "../content/ids";
import { deltaSchema, snapshotSchema } from "./snapshot";

export const ERROR_CODES = [
  "OUT_OF_BOUNDS",
  "CHUNK_LOCKED",
  "OCCUPIED",
  "BAD_TERRAIN",
  "LOCKED_BY_LEVEL",
  "INSUFFICIENT_COINS",
  "POP_CAP",
  "INSUFFICIENT_GOODS",
  "ILLEGAL_TRANSITION",
  "LAST_WHEAT_PLOT",
  "TOWN_HALL",
  "WAREHOUSE_FULL",
  "VERSION_CONFLICT",
  "CONTENT_VERSION_MISMATCH",
  "NOT_FOUND",
  "VALIDATION",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: { readonly [Code in ErrorCode]: number } = {
  OUT_OF_BOUNDS: 422,
  CHUNK_LOCKED: 422,
  OCCUPIED: 422,
  BAD_TERRAIN: 422,
  LOCKED_BY_LEVEL: 422,
  INSUFFICIENT_COINS: 422,
  POP_CAP: 422,
  INSUFFICIENT_GOODS: 422,
  ILLEGAL_TRANSITION: 409,
  LAST_WHEAT_PLOT: 409,
  TOWN_HALL: 409,
  WAREHOUSE_FULL: 409,
  VERSION_CONFLICT: 409,
  CONTENT_VERSION_MISMATCH: 409,
  NOT_FOUND: 404,
  VALIDATION: 400,
};

const commandMeta = {
  idempotencyKey: z.string().min(1),
  cityVersion: z.number().int().nonnegative(),
  contentVersion: z.number().int().positive(),
};

const rotationSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const goodQtySchema = z.object({
  goodId: z.enum(GOOD_IDS),
  qty: z.number().int().positive(),
});

const placeableIdSchema = z.enum([...BUILDING_IDS, ...AGRICULTURE_IDS, ...DECORATION_IDS, ROAD_ID]);

export const placeBuildingCommandSchema = z.object({
  type: z.literal("place-building"),
  ...commandMeta,
  definitionId: placeableIdSchema,
  x: z.number().int(),
  y: z.number().int(),
  rotation: rotationSchema,
});

export const moveBuildingCommandSchema = z.object({
  type: z.literal("move-building"),
  ...commandMeta,
  instanceId: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  rotation: rotationSchema,
});

export const removeBuildingCommandSchema = z.object({
  type: z.literal("remove-building"),
  ...commandMeta,
  instanceId: z.string().min(1),
});

export const collectAllCommandSchema = z.object({
  type: z.literal("collect-all"),
  ...commandMeta,
  priority: z.enum(["quest-first", "oldest-first"]),
});

export const startProductionCommandSchema = z.object({
  type: z.literal("start-production"),
  ...commandMeta,
  buildingId: z.string().min(1),
  recipeId: z.enum(RECIPE_IDS),
});

export const supplyBusinessCommandSchema = z.object({
  type: z.literal("supply-business"),
  ...commandMeta,
  instanceId: z.string().min(1),
});

export const fulfillOrderCommandSchema = z.object({
  type: z.literal("fulfill-order"),
  ...commandMeta,
  orderId: z.string().min(1),
});

export const rerollOrderCommandSchema = z.object({
  type: z.literal("reroll-order"),
  ...commandMeta,
  orderId: z.string().min(1),
});

export const upgradeBuildingCommandSchema = z.object({
  type: z.literal("upgrade-building"),
  ...commandMeta,
  instanceId: z.string().min(1),
});

export const upgradeWarehouseCommandSchema = z.object({
  type: z.literal("upgrade-warehouse"),
  ...commandMeta,
});

export const expandChunkCommandSchema = z.object({
  type: z.literal("expand-chunk"),
  ...commandMeta,
  chunkX: z.number().int().nonnegative(),
  chunkY: z.number().int().nonnegative(),
});

export const franchiseRequestCommandSchema = z.object({
  type: z.literal("franchise-request"),
  ...commandMeta,
  hostCityId: z.string().min(1),
  businessDefinitionId: z.enum(BUILDING_IDS),
  plotX: z.number().int(),
  plotY: z.number().int(),
});

export const franchiseAcceptCommandSchema = z.object({
  type: z.literal("franchise-accept"),
  ...commandMeta,
  franchiseId: z.string().min(1),
});

export const franchiseSupplyCommandSchema = z.object({
  type: z.literal("franchise-supply"),
  ...commandMeta,
  franchiseId: z.string().min(1),
  goods: z.array(goodQtySchema).min(1),
});

export const trainFillCommandSchema = z.object({
  type: z.literal("train-fill"),
  ...commandMeta,
  trainId: z.string().min(1),
  wagonIndex: z.number().int().min(0).max(2),
  goodId: z.enum(GOOD_IDS),
  qty: z.number().int().min(3).max(8),
});

export const trainDepartCommandSchema = z.object({
  type: z.literal("train-depart"),
  ...commandMeta,
  trainId: z.string().min(1),
});

export const commandSchema = z.discriminatedUnion("type", [
  placeBuildingCommandSchema,
  moveBuildingCommandSchema,
  removeBuildingCommandSchema,
  collectAllCommandSchema,
  startProductionCommandSchema,
  supplyBusinessCommandSchema,
  fulfillOrderCommandSchema,
  rerollOrderCommandSchema,
  upgradeBuildingCommandSchema,
  upgradeWarehouseCommandSchema,
  expandChunkCommandSchema,
  franchiseRequestCommandSchema,
  franchiseAcceptCommandSchema,
  franchiseSupplyCommandSchema,
  trainFillCommandSchema,
  trainDepartCommandSchema,
]);

export const snapshotQuerySchema = z.object({
  cityId: z.string().min(1),
  sinceVersion: z.number().int().nonnegative().optional(),
});

export const catalogQuerySchema = z.object({
  version: z.number().int().positive(),
});

export const entitlementsQuerySchema = z.object({
  userId: z.string().min(1),
});

export const apiErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string().min(1),
  cityVersion: z.number().int().nonnegative().optional(),
  delta: deltaSchema.optional(),
});

export const commandSuccessSchema = z.object({
  ok: z.literal(true),
  cityVersion: z.number().int().nonnegative(),
  contentVersion: z.number().int().positive(),
  replayed: z.boolean(),
  delta: deltaSchema,
});

export const commandFailureSchema = z.object({
  ok: z.literal(false),
  error: apiErrorSchema,
});

export const commandResponseSchema = z.discriminatedUnion("ok", [commandSuccessSchema, commandFailureSchema]);

export const snapshotResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("snapshot"), snapshot: snapshotSchema }),
  z.object({ kind: z.literal("delta"), delta: deltaSchema }),
]);

export const catalogResponseSchema = z.object({
  contentVersion: z.number().int().positive(),
  buildingIds: z.array(z.enum(BUILDING_IDS)),
  agricultureIds: z.array(z.enum(AGRICULTURE_IDS)),
  goodIds: z.array(z.enum(GOOD_IDS)),
  recipeIds: z.array(z.enum(RECIPE_IDS)),
  decorationIds: z.array(z.enum(DECORATION_IDS)),
  roadIds: z.array(z.literal(ROAD_ID)),
  levelCount: z.number().int().min(1).max(15),
});

export const entitlementsResponseSchema = z.object({
  userId: z.string().min(1),
  entitlements: z.array(
    z.object({
      productId: z.string().min(1),
      storeTransactionId: z.string().min(1),
    }),
  ),
});

export type Command = z.infer<typeof commandSchema>;
export type CommandResponse = z.infer<typeof commandResponseSchema>;
export type SnapshotQuery = z.infer<typeof snapshotQuerySchema>;
export type SnapshotResponse = z.infer<typeof snapshotResponseSchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
export type EntitlementsQuery = z.infer<typeof entitlementsQuerySchema>;
export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

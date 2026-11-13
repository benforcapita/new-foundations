import { z } from "zod";
import { BUILDING_IDS, RECIPE_IDS } from "../content/ids";
import { type PlaceReason } from "../rules/canPlace";
import { deltaSchema } from "./snapshot";

export const ERROR_CODES = [
  "CELL_OCCUPIED",
  "INSUFFICIENT_GOODS",
  "INSUFFICIENT_COINS",
  "STATE_CHANGED",
  "CONTENT_VERSION_MISMATCH",
  "LOCKED_BY_LEVEL",
  "OUT_OF_BOUNDS",
  "CHUNK_LOCKED",
  "BAD_TERRAIN",
  "POP_CAP_REACHED",
  "IDEMPOTENCY_KEY_REUSED",
  "REROLL_COOLDOWN",
  "LAST_WHEAT_PLOT",
  "TOWN_HALL",
  "VALIDATION",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "RATE_LIMITED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: { readonly [Code in ErrorCode]: number } = {
  CELL_OCCUPIED: 409,
  INSUFFICIENT_GOODS: 409,
  INSUFFICIENT_COINS: 409,
  STATE_CHANGED: 409,
  CONTENT_VERSION_MISMATCH: 412,
  LOCKED_BY_LEVEL: 422,
  OUT_OF_BOUNDS: 422,
  CHUNK_LOCKED: 422,
  BAD_TERRAIN: 422,
  POP_CAP_REACHED: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  REROLL_COOLDOWN: 422,
  LAST_WHEAT_PLOT: 422,
  TOWN_HALL: 422,
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
};

const PLACE_REASON_ERROR: { readonly [Reason in PlaceReason]: ErrorCode } = {
  OCCUPIED: "CELL_OCCUPIED",
  INSUFFICIENT_COINS: "INSUFFICIENT_COINS",
  POP_CAP: "POP_CAP_REACHED",
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
  CHUNK_LOCKED: "CHUNK_LOCKED",
  BAD_TERRAIN: "BAD_TERRAIN",
  LOCKED_BY_LEVEL: "LOCKED_BY_LEVEL",
};

export function apiErrorForPlaceReason(reason: PlaceReason): { readonly code: ErrorCode; readonly status: number } {
  const code = PLACE_REASON_ERROR[reason];
  return { code, status: ERROR_HTTP_STATUS[code] };
}

const rotationSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const commandHeadersSchema = z.object({
  authorization: z.string().regex(/^Bearer \S+$/),
  idempotencyKey: z.string().uuid(),
  cityVersion: z.number().int().nonnegative(),
  contentVersion: z.number().int().positive(),
});

export const placeBuildingCommandSchema = z
  .object({
    definitionId: z.enum(BUILDING_IDS),
    x: z.number().int(),
    y: z.number().int(),
    rotation: rotationSchema,
  })
  .strict();

export const moveBuildingCommandSchema = z
  .object({
    instanceId: z.string().min(1),
    x: z.number().int(),
    y: z.number().int(),
    rotation: rotationSchema,
    undoOf: z.string().min(1).optional(),
  })
  .strict();

export const removeBuildingCommandSchema = z
  .object({
    instanceId: z.string().min(1),
    undo: z.literal(true).optional(),
  })
  .strict();

export const collectAllCommandSchema = z.object({}).strict();

export const collectCommandSchema = z.object({ instanceId: z.string().min(1) }).strict();

export const startProductionCommandSchema = z
  .object({
    instanceId: z.string().min(1),
    recipeId: z.enum(RECIPE_IDS),
  })
  .strict();

export const cancelProductionCommandSchema = z
  .object({
    instanceId: z.string().min(1),
    jobId: z.string().min(1),
  })
  .strict();

export const supplyBusinessCommandSchema = z.object({ instanceId: z.string().min(1) }).strict();

export const fulfillOrderCommandSchema = z.object({ orderId: z.string().min(1) }).strict();

export const rerollOrderCommandSchema = z.object({ orderId: z.string().min(1) }).strict();

export const expandLandCommandSchema = z
  .object({
    chunkX: z.number().int().nonnegative(),
    chunkY: z.number().int().nonnegative(),
  })
  .strict();

export const upgradeWarehouseCommandSchema = z.object({}).strict();

export const upgradeBuildingCommandSchema = z.object({ instanceId: z.string().min(1) }).strict();

export const trainSupplyCommandSchema = z
  .object({
    wagonIndex: z.number().int().min(0).max(2),
    qty: z.number().int().min(3).max(8),
  })
  .strict();

export const trainDispatchCommandSchema = z.object({}).strict();

export const trainHelpRequestCommandSchema = z.object({ wagonIndex: z.number().int().min(0).max(2) }).strict();

export const npcVisitActionCommandSchema = z
  .object({
    npcCityId: z.string().min(1),
    action: z.enum(["harvest", "cleanup", "decorate", "supply"]),
    targetId: z.string().min(1),
  })
  .strict();

export const setCollectPriorityCommandSchema = z
  .object({
    priority: z.enum(["QUEST_FIRST", "OLDEST_FIRST"]),
  })
  .strict();

export const claimQuestCommandSchema = z
  .object({
    questId: z.string().min(1),
    periodKey: z.string().min(1),
  })
  .strict();

export const franchiseRequestCommandSchema = z
  .object({
    hostCityId: z.string().min(1),
    plotId: z.string().min(1),
    businessDefinitionId: z.enum(BUILDING_IDS),
  })
  .strict();

export const franchiseSupplyCommandSchema = z
  .object({
    cycles: z.union([z.literal(1), z.literal(2)]),
  })
  .strict();

export const franchiseCollectCommandSchema = z.object({}).strict();

export const authSessionCommandSchema = z
  .object({
    token: z.string().min(1).optional(),
    recoveryCode: z.string().min(1).optional(),
  })
  .strict();

export const telemetryCommandSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            name: z.string().min(1),
            props: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export const commandBodySchemas = {
  "place-building": placeBuildingCommandSchema,
  "move-building": moveBuildingCommandSchema,
  "remove-building": removeBuildingCommandSchema,
  "collect-all": collectAllCommandSchema,
  collect: collectCommandSchema,
  "start-production": startProductionCommandSchema,
  "cancel-production": cancelProductionCommandSchema,
  "supply-business": supplyBusinessCommandSchema,
  "fulfill-order": fulfillOrderCommandSchema,
  "reroll-order": rerollOrderCommandSchema,
  "expand-land": expandLandCommandSchema,
  "upgrade-warehouse": upgradeWarehouseCommandSchema,
  "upgrade-building": upgradeBuildingCommandSchema,
  "train-supply": trainSupplyCommandSchema,
  "train-dispatch": trainDispatchCommandSchema,
  "train-help-request": trainHelpRequestCommandSchema,
  "npc-visit-action": npcVisitActionCommandSchema,
  "set-collect-priority": setCollectPriorityCommandSchema,
  "claim-quest": claimQuestCommandSchema,
  "franchise-request": franchiseRequestCommandSchema,
  "franchise-supply": franchiseSupplyCommandSchema,
  "franchise-collect": franchiseCollectCommandSchema,
  "auth-session": authSessionCommandSchema,
  telemetry: telemetryCommandSchema,
} as const;

export type CommandName = keyof typeof commandBodySchemas;

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.enum(ERROR_CODES),
        message: z.string().min(1),
        details: z.unknown().optional(),
      })
      .strict(),
    delta: deltaSchema.optional(),
    cityVersion: z.number().int().nonnegative(),
  })
  .strict();

export const commandSuccessSchema = z
  .object({
    result: z.unknown(),
    delta: deltaSchema,
    cityVersion: z.number().int().nonnegative(),
  })
  .strict();

export const snapshotQuerySchema = z
  .object({
    cityId: z.string().min(1),
    sinceVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const catalogQuerySchema = z
  .object({
    version: z.number().int().positive().optional(),
  })
  .strict();

export const catalogResponseSchema = z
  .object({
    contentVersion: z.number().int().positive(),
    catalog: z.unknown(),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    ok: z.literal(true),
    db: z.literal("up"),
    version: z.string().min(1),
  })
  .strict();

export type CommandHeaders = z.infer<typeof commandHeadersSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type CommandSuccess = z.infer<typeof commandSuccessSchema>;
export type SnapshotQuery = z.infer<typeof snapshotQuerySchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

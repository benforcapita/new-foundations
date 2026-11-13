import { randomUUID } from "node:crypto";
import { commandBodySchemas, placeBuildingCommandSchema } from "@nf/shared/schemas";
import { findPlaceable } from "../economy/catalog";
import {
  planCancelProduction,
  planCollect,
  planMove,
  planPlace,
  planRemove,
  planStartProduction,
  planSupply,
  type Plan,
} from "../economy/plan";
import { ApiError } from "../errors";
import type { CommandContext, CommandEffects } from "../plugins/idempotency";
import { applyPlan, loadWorld } from "./cityState";
import type { World } from "../economy/model";

const CITY_COMMANDS = [
  "place-building",
  "move-building",
  "remove-building",
  "collect",
  "collect-all",
  "start-production",
  "cancel-production",
  "supply-business",
] as const;

export type CityCommandName = (typeof CITY_COMMANDS)[number];

export function isCityCommand(name: string): name is CityCommandName {
  return (CITY_COMMANDS as readonly string[]).includes(name);
}

export function assertCityCommand(name: string): CityCommandName {
  if (!isCityCommand(name)) {
    throw new ApiError(404, "NOT_FOUND", "Command not found");
  }
  return name;
}

export function assertCityCommandBody(name: CityCommandName, body: unknown): void {
  switch (name) {
    case "place-building":
      parsePlace(body);
      return;
    case "move-building":
      parseCommand(commandBodySchemas["move-building"], body);
      return;
    case "remove-building":
      parseCommand(commandBodySchemas["remove-building"], body);
      return;
    case "collect":
      parseCommand(commandBodySchemas.collect, body);
      return;
    case "collect-all":
      parseCommand(commandBodySchemas["collect-all"], body);
      return;
    case "start-production":
      parseCommand(commandBodySchemas["start-production"], body);
      return;
    case "cancel-production":
      parseCommand(commandBodySchemas["cancel-production"], body);
      return;
    case "supply-business":
      parseCommand(commandBodySchemas["supply-business"], body);
      return;
    default: {
      const unreachable: never = name;
      throw new Error(`unknown command ${String(unreachable)}`);
    }
  }
}

export async function runCityCommand(ctx: CommandContext, cityId: string, name: CityCommandName, body: unknown): Promise<CommandEffects> {
  const plan = planCityCommand(await loadWorld(ctx.tx, cityId, ctx.now), name, body);
  if (!plan.ok) {
    throw new ApiError(plan.status, plan.code, plan.message, { cityVersion: ctx.cityVersion, delta: ctx.failureDelta });
  }
  try {
    await applyPlan(ctx.tx, cityId, plan, ctx.versionAfter);
  } catch (error) {
    if (error instanceof ApiError && error.delta === undefined) {
      throw new ApiError(error.statusCode, error.code, error.message, { cityVersion: ctx.cityVersion, delta: ctx.failureDelta });
    }
    throw error;
  }
  return {
    ledger: plan.ledger,
    result: plan.result,
    ...(plan.telemetry === undefined ? {} : { telemetry: plan.telemetry }),
    ...(plan.cityPatch === undefined ? {} : { cityPatch: plan.cityPatch }),
  };
}

export function planCityCommand(world: World, name: CityCommandName, body: unknown): Plan {
  const ids = { instanceId: randomUUID(), jobId: randomUUID(), undoToken: randomUUID() };
  switch (name) {
    case "place-building":
      return planPlace(world, parsePlace(body), ids);
    case "move-building":
      return planMove(world, parseCommand(commandBodySchemas["move-building"], body), ids);
    case "remove-building":
      return planRemove(world, parseCommand(commandBodySchemas["remove-building"], body));
    case "collect":
      return planCollect(world, parseCommand(commandBodySchemas.collect, body));
    case "collect-all":
      parseCommand(commandBodySchemas["collect-all"], body);
      return planCollect(world, {});
    case "start-production":
      return planStartProduction(world, parseCommand(commandBodySchemas["start-production"], body), ids);
    case "cancel-production":
      return planCancelProduction(world, parseCommand(commandBodySchemas["cancel-production"], body));
    case "supply-business":
      return planSupply(world, parseCommand(commandBodySchemas["supply-business"], body));
    default: {
      const unreachable: never = name;
      throw new Error(`unknown command ${String(unreachable)}`);
    }
  }
}

function parseCommand<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION", "Command body is invalid");
  }
  return parsed.data;
}

function parsePlace(body: unknown): { definitionId: string; x: number; y: number; rotation: 0 | 1 | 2 | 3 } {
  const parsed = placeBuildingCommandSchema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }
  if (!isRecord(body) || typeof body.definitionId !== "string" || findPlaceable(body.definitionId) === null) {
    throw new ApiError(400, "VALIDATION", "Command body is invalid");
  }
  const shape = placeBuildingCommandSchema.safeParse({ ...body, definitionId: "B-001" });
  if (!shape.success) {
    throw new ApiError(400, "VALIDATION", "Command body is invalid");
  }
  return { definitionId: body.definitionId, x: shape.data.x, y: shape.data.y, rotation: shape.data.rotation };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

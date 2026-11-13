import type { FastifyReply, FastifyRequest } from "fastify";
import { CONTENT_VERSION } from "@nf/shared";
import { readCityVersion, readContentVersion, readIdempotencyKey } from "../commands/headers";
import type { Database } from "../db/client";
import { ApiError } from "../errors";
import { runCommand } from "../plugins/idempotency";
import type { Actor } from "../plugins/auth";
import { rawBodyOf } from "../plugins/rawBody";
import { sha256Hex } from "../crypto";
import type { RateLimiter } from "../plugins/rateLimit";
import { assertCityCommand, assertCityCommandBody, runCityCommand } from "./gameCommands";

export async function acknowledgeCommand(
  db: Database,
  limiter: RateLimiter,
  actor: Actor,
  request: FastifyRequest,
  reply: FastifyReply,
  now: Date,
): Promise<void> {
  const decision = limiter.consume(actor.sessionId);
  reply.header("X-RateLimit-Limit", String(decision.limit));
  reply.header("X-RateLimit-Remaining", String(decision.remaining));
  reply.header("X-RateLimit-Burst", String(decision.burst));
  reply.header("X-RateLimit-Burst-Remaining", String(decision.burstRemaining));
  if (!decision.ok) {
    reply.header("Retry-After", String(decision.retryAfterSeconds));
    throw new ApiError(429, "RATE_LIMITED", "Too many commands");
  }

  const commandId = readIdempotencyKey(request.headers["idempotency-key"]);
  const note = readNote(request.body);
  const raw = rawBodyOf(request);
  if (raw === undefined) {
    throw new ApiError(400, "VALIDATION", "Request body must be JSON");
  }
  const contentVersion = readContentVersion(request.headers["x-content-version"]);
  if (contentVersion !== null && contentVersion !== CONTENT_VERSION) {
    throw new ApiError(412, "CONTENT_VERSION_MISMATCH", "Content version does not match the server catalog");
  }
  const fromVersion = readCityVersion(request.headers["x-city-version"]);
  const outcome = await runCommand(db, {
    actorId: actor.userId,
    sessionId: actor.sessionId,
    cityId: actor.cityId,
    cityIds: [actor.cityId],
    commandId,
    requestHash: sha256Hex(raw),
    fromVersion,
    now,
    cityLevel: actor.level,
    apply: () =>
      Promise.resolve({
        ledger: [],
        telemetry: { name: "command_acknowledged", payload: { note } },
        result: fromVersion === null ? { note } : { note, requestedCityVersion: fromVersion },
      }),
  });
  reply.header("X-City-Version", String(outcome.body.cityVersion));
  if (outcome.replayed) {
    reply.header("Idempotent-Replay", "true");
  }
  void reply.status(outcome.statusCode).send(outcome.body);
}

export async function cityCommand(
  db: Database,
  limiter: RateLimiter,
  actor: Actor,
  cityId: string,
  commandName: string,
  request: FastifyRequest,
  reply: FastifyReply,
  now: Date,
): Promise<void> {
  if (cityId !== actor.cityId) {
    throw new ApiError(404, "NOT_FOUND", "City not found");
  }
  const name = assertCityCommand(commandName);
  const prepared = prepareCommand(limiter, actor, request, reply);
  assertCityCommandBody(name, request.body);
  const outcome = await runCommand(db, {
    actorId: actor.userId,
    sessionId: actor.sessionId,
    cityId: actor.cityId,
    cityIds: [actor.cityId],
    commandId: prepared.commandId,
    requestHash: sha256Hex(`${name}:${prepared.requestHash}`),
    fromVersion: prepared.fromVersion,
    now,
    cityLevel: actor.level,
    apply: (ctx) => runCityCommand(ctx, actor.cityId, name, request.body),
  });
  reply.header("X-City-Version", String(outcome.body.cityVersion));
  if (outcome.replayed) {
    reply.header("Idempotent-Replay", "true");
  }
  void reply.status(outcome.statusCode).send(outcome.body);
}

export function prepareCommand(
  limiter: RateLimiter,
  actor: Actor,
  request: FastifyRequest,
  reply: FastifyReply,
): { readonly commandId: string; readonly requestHash: string; readonly fromVersion: number | null } {
  const decision = limiter.consume(actor.sessionId);
  reply.header("X-RateLimit-Limit", String(decision.limit));
  reply.header("X-RateLimit-Remaining", String(decision.remaining));
  reply.header("X-RateLimit-Burst", String(decision.burst));
  reply.header("X-RateLimit-Burst-Remaining", String(decision.burstRemaining));
  if (!decision.ok) {
    reply.header("Retry-After", String(decision.retryAfterSeconds));
    throw new ApiError(429, "RATE_LIMITED", "Too many commands");
  }
  const commandId = readIdempotencyKey(request.headers["idempotency-key"]);
  const raw = rawBodyOf(request);
  if (raw === undefined) {
    throw new ApiError(400, "VALIDATION", "Request body must be JSON");
  }
  const contentVersion = readContentVersion(request.headers["x-content-version"]);
  if (contentVersion !== null && contentVersion !== CONTENT_VERSION) {
    throw new ApiError(412, "CONTENT_VERSION_MISMATCH", "Content version does not match the server catalog");
  }
  return { commandId, requestHash: sha256Hex(raw), fromVersion: readCityVersion(request.headers["x-city-version"]) };
}

function readNote(body: unknown): string {
  if (!isRecord(body) || body.type !== "acknowledge" || typeof body.note !== "string") {
    throw new ApiError(400, "VALIDATION", 'Command body must be { type: "acknowledge", note: string }');
  }
  if (body.note.length < 1 || body.note.length > 80) {
    throw new ApiError(400, "VALIDATION", "note must be 1 to 80 characters");
  }
  return body.note;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

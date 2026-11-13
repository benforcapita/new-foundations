import type { FastifyReply, FastifyRequest } from "fastify";
import { readCityVersion, readIdempotencyKey } from "../commands/headers";
import type { Database } from "../db/client";
import { ApiError } from "../errors";
import { runCommand } from "../plugins/idempotency";
import type { Actor } from "../plugins/auth";
import { rawBodyOf } from "../plugins/rawBody";
import { sha256Hex } from "../crypto";
import type { RateLimiter } from "../plugins/rateLimit";

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
        ledger: [{ goodId: "GOOD_BREAD", delta: 0, source: "acknowledge" }],
        telemetry: { name: "command_acknowledged", payload: { note } },
      }),
  });
  const version = outcome.body.cityVersion;
  if (typeof version === "number") {
    reply.header("X-City-Version", String(version));
  }
  if (outcome.replayed) {
    reply.header("Idempotent-Replay", "true");
  }
  void reply.status(outcome.statusCode).send(outcome.body);
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

import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { cities, sessions, users } from "../db/schema";
import { createGuest } from "../db/seed/starterCity";
import { randomSecret, sha256Hex } from "../crypto";
import { ApiError } from "../errors";

export type Actor = {
  readonly userId: string;
  readonly cityId: string;
  readonly sessionId: string;
  readonly level: number;
};

export type SessionResponse = {
  readonly token: string;
  readonly userId: string;
  readonly cityId: string;
  readonly isNew: boolean;
  readonly recoveryCode?: string;
};

export async function openSession(db: Database, body: unknown): Promise<SessionResponse> {
  const request = readSessionBody(body);
  if (request.token !== undefined) {
    const resumed = await resumeSession(db, request.token);
    if (resumed === null) {
      throw new ApiError(401, "UNAUTHORIZED", "Session token is not valid");
    }
    return resumed;
  }
  if (request.recoveryCode !== undefined) {
    const recovered = await recoverSession(db, request.recoveryCode);
    if (recovered === null) {
      throw new ApiError(401, "UNAUTHORIZED", "Recovery code is not valid");
    }
    return recovered;
  }
  return createGuest(db);
}

export async function authenticate(db: Database, authorization: string | undefined): Promise<Actor> {
  if (authorization === undefined || !authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "Bearer session token is required");
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (token.length === 0) {
    throw new ApiError(401, "UNAUTHORIZED", "Bearer session token is required");
  }
  const actor = await findActor(db, token);
  if (actor === null) {
    throw new ApiError(401, "UNAUTHORIZED", "Session token is not valid");
  }
  return actor;
}

async function resumeSession(db: Database, token: string): Promise<SessionResponse | null> {
  const actor = await findActor(db, token);
  if (actor === null) {
    return null;
  }
  return { token, userId: actor.userId, cityId: actor.cityId, isNew: false };
}

async function recoverSession(db: Database, recoveryCode: string): Promise<SessionResponse | null> {
  const hash = sha256Hex(recoveryCode);
  const found = await db.select({ id: users.id }).from(users).where(eq(users.recoveryCodeHash, hash)).limit(1);
  const user = found[0];
  if (user === undefined) {
    return null;
  }
  const owned = await db
    .select({ id: cities.id })
    .from(cities)
    .where(and(eq(cities.ownerId, user.id), eq(cities.isNpc, false)))
    .limit(1);
  const city = owned[0];
  if (city === undefined) {
    return null;
  }
  const token = randomSecret();
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.insert(sessions).values({ userId: user.id, tokenHash: sha256Hex(token) });
  });
  return { token, userId: user.id, cityId: city.id, isNew: false };
}

async function findActor(db: Database, token: string): Promise<Actor | null> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      cityId: cities.id,
      level: cities.level,
    })
    .from(sessions)
    .innerJoin(cities, eq(cities.ownerId, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256Hex(token)), eq(cities.isNpc, false)))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return row;
}

function readSessionBody(body: unknown): { readonly token?: string; readonly recoveryCode?: string } {
  if (!isRecord(body)) {
    throw new ApiError(400, "VALIDATION", "Request body must be an object");
  }
  return {
    token: optionalString(body.token, "token"),
    recoveryCode: optionalString(body.recoveryCode, "recoveryCode"),
  };
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION", `${field} must be a string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

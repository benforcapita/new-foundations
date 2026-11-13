import { franchiseCommand, franchiseHosts } from "./modules/franchise";
import { healthReport } from "@nf/shared";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { DatabaseHandle } from "./db/client";
import { registerErrors } from "./plugins/errors";
import { registerCors } from "./plugins/cors";
import { registerRawBody } from "./plugins/rawBody";
import { createRateLimiter, type RateLimiter } from "./plugins/rateLimit";
import { registerHealth } from "./modules/health";
import { registerAuth } from "./modules/auth";
import { registerCatalog } from "./modules/catalog";
import { loadCurrentCity } from "./modules/city";
import { acknowledgeCommand, cityCommand } from "./modules/commands";
import { loadCitySnapshot, readSinceVersion } from "./modules/snapshot";
import { authenticate } from "./plugins/auth";
import { ApiError } from "./errors";

export type AppOptions = {
  readonly logger: boolean;
  readonly database?: DatabaseHandle;
  readonly clock?: () => Date;
  readonly corsOrigin?: string;
  readonly rateLimit?: { readonly burst: number; readonly perMinute: number };
};

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger });
  const clock = options.clock ?? (() => new Date());
  const limiter: RateLimiter = createRateLimiter({
    now: () => clock().getTime(),
    burst: options.rateLimit?.burst,
    perMinute: options.rateLimit?.perMinute,
  });

  const requestNow = (request: FastifyRequest) => {
    if (process.env.NODE_ENV === "test") {
      const header = request.headers["x-test-now"];
      if (typeof header === "string" && header.trim()) {
        const date = new Date(/^-?\d+$/.test(header) ? Number(header) : header);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    return clock();
  };

  registerErrors(app);
  registerCors(app, options.corsOrigin);
  registerRawBody(app);
  registerHealth(app, options.database);
  registerCatalog(app);

  app.get("/health", () => {
    return healthReport("api");
  });

  const database = options.database?.db;
  if (database !== undefined) {
    registerAuth(app, database);
    app.get("/v1/franchises/hosts", async (request) => {
      await authenticate(database, request.headers.authorization);
      return franchiseHosts(database);
    });
    app.post("/v1/franchises/request", async (request, reply) => {
      const actor = await authenticate(database, request.headers.authorization);
      await franchiseCommand(database, limiter, actor, request, reply, requestNow(request), "request");
    });
    app.post("/v1/franchises/:id/supply", async (request, reply) => {
      const actor = await authenticate(database, request.headers.authorization);
      await franchiseCommand(database, limiter, actor, request, reply, requestNow(request), "supply", routeParam(request.params, "id"));
    });
    app.post("/v1/franchises/:id/collect", async (request, reply) => {
      const actor = await authenticate(database, request.headers.authorization);
      await franchiseCommand(database, limiter, actor, request, reply, requestNow(request), "collect", routeParam(request.params, "id"));
    });
    app.get("/v1/cities/current", async (request) => {
      const actor = await authenticate(database, request.headers.authorization);
      return loadCurrentCity(database, actor.cityId, requestNow(request));
    });
    app.post("/v1/cities/current/commands/acknowledge", async (request, reply) => {
      const actor = await authenticate(database, request.headers.authorization);
      await acknowledgeCommand(database, limiter, actor, request, reply, requestNow(request));
    });
    app.get("/v1/cities/:cityId/snapshot", async (request) => {
      const actor = await authenticate(database, request.headers.authorization);
      const cityId = routeParam(request.params, "cityId");
      if (cityId !== actor.cityId) {
        throw new ApiError(404, "NOT_FOUND", "City not found");
      }
      return loadCitySnapshot(database, cityId, actor.userId, readSinceVersion(cityId, request.query), requestNow(request));
    });
    app.post("/v1/cities/:cityId/commands/:commandName", async (request, reply) => {
      const actor = await authenticate(database, request.headers.authorization);
      await cityCommand(
        database,
        limiter,
        actor,
        routeParam(request.params, "cityId"),
        routeParam(request.params, "commandName"),
        request,
        reply,
        requestNow(request),
      );
    });
  }

  return app;
}

function routeParam(params: unknown, name: string): string {
  if (typeof params !== "object" || params === null) {
    throw new ApiError(400, "VALIDATION", "Route parameter is missing");
  }
  const value = Object.entries(params).find(([key]) => key === name)?.[1];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new ApiError(400, "VALIDATION", "Route parameter is missing");
}

import type { FastifyInstance } from "fastify";
import { AGRICULTURE, BUILDINGS, CONTENT_VERSION, DECORATIONS, GOODS, LEVELS, RECIPES, ROAD } from "@nf/shared";
import { catalogResponseSchema, type CatalogResponse } from "@nf/shared/schemas";
import { ApiError } from "../errors";

const CATALOG: CatalogResponse = catalogResponseSchema.parse({
  contentVersion: CONTENT_VERSION,
  catalog: {
    buildings: BUILDINGS,
    agriculture: AGRICULTURE,
    goods: GOODS,
    recipes: RECIPES,
    decorations: DECORATIONS,
    road: ROAD,
    levels: LEVELS,
  },
});

const ETAG = `"content-${CONTENT_VERSION}"`;

export function registerCatalog(app: FastifyInstance): void {
  app.get("/v1/content/catalog", (request, reply) => {
    const version = request.query;
    if (isRecord(version) && version.version !== undefined && !/^[1-9]\d*$/.test(String(version.version))) {
      throw new ApiError(400, "VALIDATION", "version must be a positive integer");
    }
    reply.header("ETag", ETAG);
    reply.header("Cache-Control", "public, max-age=3600");
    const offered = request.headers["if-none-match"];
    if (offered === ETAG) {
      reply.status(304).send();
      return;
    }
    reply.send(CATALOG);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

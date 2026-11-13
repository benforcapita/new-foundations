import type { FastifyInstance } from "fastify";
import { AGRICULTURE, BUILDINGS, CONTENT_VERSION, DECORATIONS, GOODS, LEVELS, RECIPES, ROAD } from "@nf/shared";
import type { CatalogResponse } from "@nf/shared/schemas";

const CATALOG: CatalogResponse = {
  contentVersion: CONTENT_VERSION,
  buildingIds: BUILDINGS.map((building) => building.id),
  agricultureIds: AGRICULTURE.map((plot) => plot.id),
  goodIds: GOODS.map((good) => good.id),
  recipeIds: RECIPES.map((recipe) => recipe.id),
  decorationIds: DECORATIONS.map((decoration) => decoration.id),
  roadIds: [ROAD.id],
  levelCount: LEVELS.length,
};

const ETAG = `"content-${CONTENT_VERSION}"`;

export function registerCatalog(app: FastifyInstance): void {
  app.get("/v1/content/catalog", (request, reply) => {
    reply.header("ETag", ETAG);
    reply.header("Cache-Control", "public, max-age=3600");
    const version = request.query;
    if (isRecord(version) && version.version !== undefined && !/^[1-9]\d*$/.test(String(version.version))) {
      reply.status(400).send({
        error: { code: "VALIDATION", message: "version must be a positive integer" },
      });
      return;
    }
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

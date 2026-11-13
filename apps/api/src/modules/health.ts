import type { FastifyInstance } from "fastify";
import { CONTENT_VERSION } from "@nf/shared";
import { healthResponseSchema } from "@nf/shared/schemas";
import type { DatabaseHandle } from "../db/client";

const VERSION = String(CONTENT_VERSION);

export function registerHealth(app: FastifyInstance, database: DatabaseHandle | undefined): void {
  app.get("/healthz", async (_request, reply) => {
    if (database === undefined) {
      return reply.code(503).send({ ok: false, db: "down", version: VERSION });
    }
    try {
      await database.pool.query("select 1");
    } catch {
      return reply.code(503).send({ ok: false, db: "down", version: VERSION });
    }
    return healthResponseSchema.parse({ ok: true, db: "up", version: VERSION });
  });
}

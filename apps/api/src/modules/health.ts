import type { FastifyInstance } from "fastify";
import { CONTENT_VERSION } from "@nf/shared";
import type { DatabaseHandle } from "../db/client";

export function registerHealth(app: FastifyInstance, database: DatabaseHandle | undefined): void {
  app.get("/healthz", async (_request, reply) => {
    if (database === undefined) {
      return reply.code(503).send({ ok: false, db: "down", version: CONTENT_VERSION });
    }
    try {
      await database.pool.query("select 1");
    } catch {
      return reply.code(503).send({ ok: false, db: "down", version: CONTENT_VERSION });
    }
    return { ok: true, db: "up", version: CONTENT_VERSION };
  });
}

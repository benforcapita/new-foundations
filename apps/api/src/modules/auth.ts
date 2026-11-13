import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import { openSession } from "../plugins/auth";

export function registerAuth(app: FastifyInstance, db: Database): void {
  app.post("/v1/auth/session", async (request) => openSession(db, request.body));
}

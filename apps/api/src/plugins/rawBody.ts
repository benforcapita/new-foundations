import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "../errors";

const rawBodies = new WeakMap<FastifyRequest, string>();

export function rawBodyOf(request: FastifyRequest): string | undefined {
  return rawBodies.get(request);
}

export function registerRawBody(app: FastifyInstance): void {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    const text = typeof body === "string" ? body : body.toString("utf8");
    rawBodies.set(request, text);
    if (text.trim() === "") {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(text) as unknown);
    } catch {
      done(new ApiError(400, "VALIDATION", "Request body must be JSON"), undefined);
    }
  });
}

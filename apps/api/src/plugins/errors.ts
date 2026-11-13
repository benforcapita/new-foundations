import type { FastifyInstance } from "fastify";
import { ApiError, apiErrorBody } from "../errors";

export function registerErrors(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) {
      void reply.status(error.statusCode).send(apiErrorBody(error));
      return;
    }
    const statusCode = readStatusCode(error);
    if (statusCode >= 500) {
      request.log.error(error);
    }
    const code = statusCode === 404 ? "NOT_FOUND" : statusCode === 400 ? "VALIDATION" : "INTERNAL";
    const message = statusCode < 500 && error instanceof Error ? error.message : "Internal server error";
    void reply.status(statusCode).send({ error: { code, message } });
  });
}

function readStatusCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = error.statusCode;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode <= 599) {
      return statusCode;
    }
  }
  return 500;
}

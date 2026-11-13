import type { FastifyInstance } from "fastify";
import { ApiError, apiErrorBody } from "../errors";

export function registerErrors(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send(apiErrorBody(new ApiError(404, "NOT_FOUND", `Route ${request.method} ${request.url} not found`)));
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ApiError) {
      void reply.status(error.statusCode).send(apiErrorBody(error));
      return;
    }
    const statusCode = readStatusCode(error);
    if (statusCode >= 500) {
      request.log.error(error);
    }
    const code = codeForStatus(statusCode);
    const message = statusCode < 500 && error instanceof Error ? error.message : "Internal server error";
    void reply.status(statusCode).send(apiErrorBody(new ApiError(statusCode, code, message)));
  });
}

function codeForStatus(statusCode: number): "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "STATE_CHANGED" | "CONTENT_VERSION_MISMATCH" | "RATE_LIMITED" {
  switch (statusCode) {
    case 401:
      return "UNAUTHORIZED";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "STATE_CHANGED";
    case 412:
      return "CONTENT_VERSION_MISMATCH";
    case 429:
      return "RATE_LIMITED";
    case 400:
    case 422:
      return "VALIDATION";
    default:
      return "STATE_CHANGED";
  }
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

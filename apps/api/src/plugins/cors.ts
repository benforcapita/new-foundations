import type { FastifyInstance } from "fastify";

const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const VERCEL_ORIGIN = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/;

export function originAllowed(origin: string, configured: readonly string[]): boolean {
  if (LOCAL_ORIGIN.test(origin) || VERCEL_ORIGIN.test(origin)) {
    return true;
  }
  return configured.some((allowed) => matchConfiguredOrigin(origin, allowed));
}

export function parseCorsOrigin(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function registerCors(app: FastifyInstance, corsOrigin: string | undefined): void {
  const configured = parseCorsOrigin(corsOrigin);
  app.addHook("onRequest", (request, reply, done) => {
    const origin = request.headers.origin;
    if (typeof origin === "string" && originAllowed(origin, configured)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header(
        "Access-Control-Expose-Headers",
        "ETag, Idempotent-Replay, X-City-Version, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Burst, X-RateLimit-Burst-Remaining",
      );
    }
    if (request.method === "OPTIONS") {
      reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      reply.header(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, Idempotency-Key, X-City-Version, X-Content-Version, If-None-Match",
      );
      reply.header("Access-Control-Max-Age", "600");
      reply.code(204).send();
      return;
    }
    done();
  });
}

function matchConfiguredOrigin(origin: string, allowed: string): boolean {
  if (!allowed.includes("*")) {
    return origin === allowed;
  }
  const pattern = `^${allowed.split("*").map(escapeRegExp).join(".*")}$`;
  return new RegExp(pattern).test(origin);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

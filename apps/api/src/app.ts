import { healthReport } from "@nf/shared";
import Fastify, { type FastifyInstance } from "fastify";

export type AppOptions = {
  readonly logger: boolean;
};

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger });

  app.get("/health", () => {
    return healthReport("api");
  });

  return app;
}

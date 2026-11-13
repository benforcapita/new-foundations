import { buildApp } from "./app";
import { createDatabase } from "./db/client";
import { migrate } from "./db/migrate";
import { seedNpcCities } from "./db/seed/npcCities";

const port = readPort(process.env.PORT);
const host = process.env.HOST ?? "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL is required");
}

const handle = createDatabase(databaseUrl);
await migrate(handle.pool);
await seedNpcCities(handle.db);
const app = buildApp({ logger: true, database: handle, corsOrigin: process.env.CORS_ORIGIN });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  await handle.pool.end();
  process.exit(1);
}

function readPort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 3001;
  }
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`PORT must be an integer from 1 to 65535, received ${value}`);
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535, received ${value}`);
  }
  return parsed;
}

import { buildApp } from "./app";

const port = readPort(process.env.PORT);
const host = process.env.HOST ?? "0.0.0.0";
const app = buildApp({ logger: true });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
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

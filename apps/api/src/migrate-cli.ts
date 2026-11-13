import { createDatabase } from "./db/client";
import { migrate } from "./db/migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const handle = createDatabase(url);
try {
  await migrate(handle.pool);
} finally {
  await handle.pool.end();
}

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schemaMeta } from "./schema";

export const databaseSchema = { schemaMeta };

export type Database = NodePgDatabase<typeof databaseSchema>;

export type DatabaseHandle = {
  readonly db: Database;
  readonly pool: Pool;
};

export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema: databaseSchema });
  return { db, pool };
}

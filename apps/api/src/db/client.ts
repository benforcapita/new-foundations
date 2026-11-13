import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  buildingCells,
  buildingInstances,
  cities,
  cityCells,
  commandDedup,
  franchiseShipments,
  franchises,
  inventoryBalances,
  inventoryLedger,
  npcVisits,
  orderInstances,
  productionJobs,
  quests,
  schemaMeta,
  schemaMigrations,
  sessions,
  telemetryEvents,
  trainShipments,
  users,
} from "./schema";

export const databaseSchema = {
  schemaMeta,
  schemaMigrations,
  users,
  sessions,
  cities,
  cityCells,
  buildingInstances,
  buildingCells,
  inventoryBalances,
  inventoryLedger,
  productionJobs,
  orderInstances,
  trainShipments,
  franchises,
  franchiseShipments,
  quests,
  npcVisits,
  commandDedup,
  telemetryEvents,
};

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

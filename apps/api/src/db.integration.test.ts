import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createDatabase, type DatabaseHandle } from "./db/client";
import { schemaMeta } from "./db/schema";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error(
    "DATABASE_URL is required for API integration tests. Start PostgreSQL 16 with `docker compose up db` and export DATABASE_URL=postgres://nf:nf@127.0.0.1:5432/new_foundations.",
  );
}

const connectionString = databaseUrl;
let handle: DatabaseHandle | undefined;

beforeAll(async () => {
  handle = createDatabase(connectionString);
  await handle.db.execute(sql`
    create table if not exists schema_meta (
      id text primary key,
      note text not null,
      recorded_at timestamptz not null
    )
  `);
});

afterAll(async () => {
  if (handle === undefined) {
    return;
  }
  try {
    await handle.db.delete(schemaMeta).where(eq(schemaMeta.id, "nf-1"));
  } finally {
    await handle.pool.end();
  }
});

test("postgres 16 stores a schema_meta row through drizzle", async () => {
  if (handle === undefined) {
    throw new Error("database handle was not created");
  }

  const versionResult = await handle.db.execute(sql`select version() as version`);
  const version = readVersion(versionResult.rows[0]);
  expect(version).toContain("PostgreSQL 16");

  const recordedAt = new Date();
  await handle.db
    .insert(schemaMeta)
    .values({ id: "nf-1", note: "integration", recordedAt })
    .onConflictDoUpdate({
      target: schemaMeta.id,
      set: { note: "integration", recordedAt },
    });

  const rows = await handle.db.select().from(schemaMeta).where(eq(schemaMeta.id, "nf-1"));
  const row = rows[0];
  expect(row?.note).toBe("integration");
});

function readVersion(row: Record<string, unknown> | undefined): string {
  const version = row?.version;
  if (typeof version !== "string") {
    throw new Error("PostgreSQL did not return a version string");
  }
  return version;
}

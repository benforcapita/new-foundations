import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export async function migrate(pool: Pool): Promise<readonly string[]> {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

  const applied: string[] = [];
  for (const file of files) {
    const existing = await pool.query<{ id: string }>("select id from schema_migrations where id = $1", [file]);
    if (existing.rowCount !== null && existing.rowCount > 0) {
      continue;
    }
    const sqlText = await readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sqlText);
      await client.query("insert into schema_migrations (id) values ($1)", [file]);
      await client.query("commit");
      applied.push(file);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  return applied;
}

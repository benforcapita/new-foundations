import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const schemaMeta = pgTable("schema_meta", {
  id: text("id").primaryKey(),
  note: text("note").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
});

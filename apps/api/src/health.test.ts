import { healthReport } from "@nf/shared";
import { getTableName } from "drizzle-orm";
import { expect, test } from "vitest";
import { buildApp } from "./app";
import { schemaMeta } from "./db/schema";

test("GET /health reports the api service", async () => {
  const app = buildApp({ logger: false });
  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(healthReport("api"));
  } finally {
    await app.close();
  }
});

test("schema_meta is the drizzle table used for integration", () => {
  expect(getTableName(schemaMeta)).toBe("schema_meta");
});

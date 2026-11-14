import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This grant exists only in the test runner; the API exposes no grant endpoint.
test("level 1 to 4 unlocks catalog items and displays a dismissible level-up card", async ({ page, request }) => {
  const apiPort = process.env.NF_E2E_API_PORT ?? "3002";
  const response = await request.post(`http://127.0.0.1:${apiPort}/v1/auth/session`, { data: {} });
  const session = await response.json() as { token: string; cityId: string };
  await page.addInitScript(token => localStorage.setItem("nf_session_token", token), session.token);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await page.getByTestId("build-catalog-open").click();
  await expect(page.getByTestId("catalog-item-B-002").getByRole("button")).toBeDisabled();
  await expect(page.getByTestId("catalog-item-B-009").getByRole("button")).toBeEnabled();
  await page.getByRole("button", { name: "Close" }).click();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `update cities set xp = 384 where id = '${session.cityId}'; insert into inventory_ledger (city_id, resource, delta, balance_after, source) values ('${session.cityId}', 'XP', 384, 384, 'e2e_grant')`]);
  await page.getByTestId("collect-all").click();
  await expect(page.getByRole("dialog", { name: "Level up" })).toContainText("Level 4!");
  await expect(page.getByRole("dialog", { name: "Level up" })).toContainText("Rowhouse");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByTestId("build-catalog-open").click();
  for (const id of ["B-002", "B-008", "B-011", "B-012"]) {
    await expect(page.getByTestId(`catalog-lock-${id}`)).toHaveCount(0);
  }
});

test("the XP HUD displays MAX at level 15", async ({ page, request }) => {
  const apiPort = process.env.NF_E2E_API_PORT ?? "3002";
  const response = await request.post(`http://127.0.0.1:${apiPort}/v1/auth/session`, { data: {} });
  const session = await response.json() as { token: string; cityId: string };
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `update cities set level = 15, xp = 20000 where id = '${session.cityId}'`]);
  await page.addInitScript(token => localStorage.setItem("nf_session_token", token), session.token);
  await page.goto("/");
  await expect(page.getByTestId("hud-xp")).toHaveText("XP: MAX");
});

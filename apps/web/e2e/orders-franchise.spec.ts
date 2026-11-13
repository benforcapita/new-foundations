import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("fulfills the starter order once and replaces it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await expect(page.getByTestId("hud-coins")).toHaveText("Coins: 750");
  await page.getByTestId("order-board-open").click();
  const starter = page.getByTestId("order-card").filter({ hasText: "ORD-T-001" });
  await starter.getByTestId("order-fulfill").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("hud-coins")).toHaveText("Coins: 930");
  await expect(page.getByTestId("hud-xp")).toContainText("XP: 12");
  await expect(page.getByTestId("order-card")).toHaveCount(3);
  await expect(starter).toHaveCount(0);
});

test("requests, supplies and settles Dana's branch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  try {
  await page.getByTestId("franchise-board-open").click();
  await page.getByTestId("franchise-request").click();
  await expect(page.getByTestId("franchise-board").getByTestId("franchise-branch")).toContainText("ACTIVE");
  await expect(page.getByTestId("hq-badge")).toBeVisible();
  await page.getByTestId("franchise-supply-cycles").selectOption("1");
  const supplied = page.waitForResponse(response => response.url().endsWith("/supply") && response.request().method() === "POST");
  await page.getByTestId("franchise-supply").click();
  expect((await supplied).ok()).toBe(true);
  await expect(page.getByTestId("franchise-supply")).toBeEnabled();
  await page.evaluate(() => sessionStorage.setItem("nf_test_now", new Date(Date.now() + 46 * 60_000).toISOString()));
  await page.getByTestId("franchise-collect").click();
  await expect(page.getByTestId("franchise-split")).toHaveText("You: 66 / Dana: 44 / Total: 110");
  } finally {
    const ids = await page.evaluate(async () => {
      const token = localStorage.getItem("nf_session_token");
      if (!token) return [];
      const response = await fetch("/v1/cities/current", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json() as { franchises: { id: string }[] };
      return data.franchises.map(f => f.id);
    });
    for (const id of ids.filter(value => /^[0-9a-f-]{36}$/i.test(value))) {
      execFileSync("psql", [process.env.DATABASE_URL ?? "", "-v", "ON_ERROR_STOP=1", "-c", `delete from franchises where id = '${id}'`]);
    }
  }
});

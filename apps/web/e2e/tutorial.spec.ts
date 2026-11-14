import { expect, test, type Page } from "@playwright/test";

async function clickTarget(page: Page) {
  const target = page.getByTestId("tutorial-target");
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const chrome = await page.getByTestId("tutorial-root").boundingBox();
  if (!box || !chrome) throw new Error("Tutorial target or instructions missing");
  expect(box.x + box.width <= chrome.x || chrome.x + chrome.width <= box.x || box.y + box.height <= chrome.y || chrome.y + chrome.height <= box.y).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test("Mia guides a new city through the core loop and resumes after reload", async ({ page }) => {
  test.setTimeout(90_000);
  const started = Date.now();
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await expect(page.getByTestId("tutorial-step")).toContainText("Cottage");
  await page.getByTestId("place-cottage").click();
  await clickTarget(page);
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-step")).toContainText("Wheat");
  await page.reload();
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await expect(page.getByTestId("tutorial-step")).toContainText("Wheat");
  await clickTarget(page);
  await page.getByTestId("details-collect").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-step")).toContainText("Grocery");
  await clickTarget(page);
  await page.getByTestId("details-supply").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-step")).toContainText("selling");
  await clickTarget(page);
  await page.waitForTimeout(10_500);
  await expect(page.getByTestId("details-collect")).toBeVisible();
  await page.getByTestId("details-collect").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("place-bakery")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(90_000);
  await page.getByTestId("place-bakery").click();
  await clickTarget(page);
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("tutorial-root")).toHaveCount(0);
});

test("quest claims pay once and update the HUD", async ({ page, request }) => {
  const apiPort = process.env.NF_E2E_API_PORT ?? "3002";
  const response = await request.post(`http://127.0.0.1:${apiPort}/v1/auth/session`, { data: {} });
  const session = await response.json() as { token: string; cityId: string };
  const { execFileSync } = await import("node:child_process");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `insert into quests (city_id, quest_id, period_key, track, status, step_index, step_state, started_at, completed_at, version) values ('${session.cityId}', 'quest_early_bakery_01', '-', 'story', 'COMPLETED', 2, '{}', now(), now(), 1), ('${session.cityId}', 'quest_flower_street', '-', 'story', 'COMPLETED', 7, '{}', now(), now(), 1)`]);
  await page.addInitScript(token => localStorage.setItem("nf_session_token", token), session.token);
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await page.getByTestId("quest-tracker-open").click();
  await page.getByTestId("quest-claim-quest_early_bakery_01").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("hud-coins")).toHaveText("Coins: 900");
  await expect(page.getByTestId("hud-xp")).toContainText("XP: 25");
  await page.getByTestId("quest-claim-quest_flower_street").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("hud-xp")).toContainText("XP: 35");
  const coins = await page.getByTestId("hud-coins").textContent();
  const duplicate = await request.post(`http://127.0.0.1:${apiPort}/v1/cities/${session.cityId}/commands/claim-quest`, { headers: { authorization: `Bearer ${session.token}`, "idempotency-key": crypto.randomUUID() }, data: { questId: "quest_flower_street", periodKey: "-" } });
  expect(duplicate.status()).toBe(409);
  await page.reload();
  if (coins === null) throw new Error("Coin balance missing");
  await expect(page.getByTestId("hud-coins")).toHaveText(coins);
  await expect(page.getByTestId("hud-xp")).toContainText("XP: 35");
});

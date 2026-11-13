import { expect, test, type Page } from "@playwright/test";
import { gridToScreen } from "@nf/shared";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../src/game/layout";

async function placeCottage(page: Page) {
  await page.getByTestId("place-cottage").click();
  const world = gridToScreen(0.5, 6.5, MAP_ORIGIN_X, MAP_ORIGIN_Y);
  await page.getByTestId("aim-x").fill(String(world.x));
  await page.getByTestId("aim-y").fill(String(world.y));
  await page.getByTestId("aim-zoom").fill("1");
  await page.getByTestId("aim-go").click();
  const canvas = page.getByTestId("game-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing canvas");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("ghost-cell")).toHaveText("0,6");
  await expect(page.getByTestId("ghost-tone")).toHaveText("valid");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test("placed building survives reload from the server", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await placeCottage(page);
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("city-building").filter({ hasText: "B-001 0,6" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("city-building").filter({ hasText: "B-001 0,6" })).toHaveCount(1);
});

test("offline command retries with the same idempotency key", async ({ page }) => {
  const keys: string[] = [];
  let attempt = 0;
  await page.route("**/v1/cities/*/commands/place-building", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    attempt += 1;
    if (attempt === 1) await route.abort();
    else if (attempt === 2) { await route.fetch(); await route.abort(); }
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await placeCottage(page);
  await expect(page.getByTestId("sync-status")).toContainText("Pending Sync (1)");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => keys.length).toBe(2);
  await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(1);
  await page.reload();
  await expect(page.getByTestId("city-building").filter({ hasText: "B-001 0,6" })).toHaveCount(1);
});

test("pending command survives reload and syncs on reconnect", async ({ page }) => {
  let offline = true;
  let attempts = 0;
  await page.route("**/v1/cities/*/commands/place-building", async (route) => {
    attempts += 1;
    if (offline) await route.abort();
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  await placeCottage(page);
  await expect(page.getByTestId("sync-status")).toContainText("Pending Sync (1)");
  await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId("sync-status")).toContainText("Pending Sync (1)");
  await expect.poll(() => attempts).toBe(2);
  await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();
  offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  await expect(page.getByTestId("city-building").filter({ hasText: "B-001 0,6" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("city-building").filter({ hasText: "B-001 0,6" })).toHaveCount(1);
});

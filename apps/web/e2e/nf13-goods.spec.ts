import { expect, test } from "@playwright/test";
import { gridToScreen } from "@nf/shared";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../src/game/layout";

test("carpenter shows three slots and its unlocked recipes", async ({ page }) => {
  let x = 0;
  let y = 0;
  await page.route(/\/v1\/cities\/(current|[^/]+\/snapshot)(\?.*)?$/, async route => {
    const response = await route.fetch();
    const snapshot = await response.json();
    const building = snapshot.buildings.find((b: { definitionId: string }) => b.definitionId === "AG-001");
    x = building.x;
    y = building.y;
    building.definitionId = "B-008";
    building.state = "ACTIVE";
    snapshot.city.level = 10;
    snapshot.inventory.GOOD_TIMBER = 10;
    snapshot.inventory.GOOD_FLOWERS = 10;
    snapshot.inventory.GOOD_PAINT = 10;
    snapshot.jobs = [];
    await route.fulfill({ response, json: snapshot });
  });
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  const world = gridToScreen(x + 1, y + 1, MAP_ORIGIN_X, MAP_ORIGIN_Y);
  await page.getByTestId("aim-x").fill(String(world.x));
  await page.getByTestId("aim-y").fill(String(world.y));
  await page.getByTestId("aim-go").click();
  const box = await page.getByTestId("game-canvas").locator("canvas").boundingBox();
  if (!box) throw new Error("Missing canvas");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const queue = page.getByTestId("production-queue");
  await expect(queue).toContainText("Slots: 0/3");
  await expect(queue).toContainText("GOOD_PLANKS");
  await expect(queue).toContainText("GOOD_PAINT");
  await expect(queue).toContainText("GOOD_BOOKS");
  await expect(queue.getByTestId("start-production")).toHaveCount(3);
  for (const button of await queue.getByTestId("start-production").all()) await expect(button).toBeEnabled();
});

import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { gridToScreen } from "@nf/shared";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../src/game/layout";

test("decoration preview, business breakdown and live road auto-tiling", async ({ page, request }) => {
  const response = await request.post(`http://127.0.0.1:${process.env.NF_E2E_API_PORT ?? "3002"}/v1/auth/session`, { data: {} });
  const session = await response.json() as { token: string; cityId: string };
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  execFileSync("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c", `update cities set level = 4, xp = 390, coins = 10000 where id = '${session.cityId}'`]);
  await page.addInitScript(token => localStorage.setItem("nf_session_token", token), session.token);
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20000 });
  const aim = async (x: number, y: number) => {
    const point = gridToScreen(x + 0.5, y + 0.5, MAP_ORIGIN_X, MAP_ORIGIN_Y);
    await page.getByTestId("aim-x").fill(String(point.x));
    await page.getByTestId("aim-y").fill(String(point.y));
    await page.getByTestId("aim-go").click();
    const box = await page.getByTestId("game-canvas").locator("canvas").boundingBox();
    if (!box) throw new Error("Missing canvas");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    return box;
  };
  await page.getByTestId("build-catalog-open").click();
  await page.getByTestId("catalog-item-D-001").getByRole("button").click();
  let box = await aim(11, 4);
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-preview-radius", "2");
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-preview-boosts", "+1%");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("city-building").filter({ hasText: "D-001 11,4" })).toHaveCount(1);
  await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  for (const y of [6, 7]) {
    await page.getByTestId("build-catalog-open").click();
    await page.getByTestId("catalog-item-R-001").getByRole("button").click();
    box = await aim(9, y);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId("city-building").filter({ hasText: `R-001 9,${y}` })).toHaveCount(1);
    await expect(page.getByTestId("sync-status")).toHaveText("Synced");
  }
  await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-road-tiles", /tile_road_straight_ns.*tile_road_straight_ns/);
  box = await aim(9, 4);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("boost-breakdown")).toContainText("Decoration boost: +1%");
  await expect(page.getByTestId("boost-breakdown")).toContainText("Road bonus: +5%");
  await expect(page.getByTestId("boost-breakdown")).toContainText("Reward: 116 coins");
});

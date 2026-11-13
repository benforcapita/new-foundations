import { expect, test, type Page } from "@playwright/test";
import {
  GHOST_BLOCKED_CELL,
  GHOST_HINT_CLEAR_CELL,
  GHOST_OCCUPIED_CELL,
  GHOST_VALID_CELL,
} from "../src/game/demoCity";
import "../src/game/debug";

async function openCity(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(undefined);
        });
      }),
  );
}

async function aim(page: Page, cell: { readonly x: number; readonly y: number }): Promise<void> {
  await page.evaluate(({ x, y }) => {
    const debug = window.__nfDebug;
    if (debug === undefined) {
      throw new Error("missing __nfDebug");
    }
    debug.focusCell(x, y);
  }, cell);
  const point = await page.evaluate(({ x, y }) => {
    const debug = window.__nfDebug;
    if (debug === undefined) {
      throw new Error("missing __nfDebug");
    }
    return debug.cellClient(x, y);
  }, cell);
  const box = await page.getByTestId("game-canvas").locator("canvas").boundingBox();
  if (box === null) {
    throw new Error("canvas missing");
  }
  expect(point.x).toBeGreaterThanOrEqual(box.x);
  expect(point.x).toBeLessThanOrEqual(box.x + box.width);
  expect(point.y).toBeGreaterThanOrEqual(box.y);
  expect(point.y).toBeLessThanOrEqual(box.y + box.height);
  await page.mouse.move(point.x, point.y);
}

test("renders the 24x24 starter map with depth-sorted buildings", async ({ page }) => {
  await openCity(page);
  await expect(page.getByRole("heading", { name: "New Foundations" })).toBeVisible();
  await expect(page.getByTestId("map-size")).toHaveText("24x24");
  const order = (await page.getByTestId("depth-order").textContent()) ?? "";
  const ids = order.split(",").map((entry) => entry.split(":")[0]);
  expect(ids.indexOf("cottage-build")).toBeGreaterThanOrEqual(0);
  expect(ids.indexOf("cottage-build")).toBeLessThan(ids.indexOf("town-hall"));
  expect(ids.indexOf("town-hall")).toBeLessThan(ids.indexOf("grocery"));

  const painted = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return 0;
    }
    const context = canvas.getContext("2d");
    if (context === null) {
      return 0;
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let index = 0; index < data.length; index += 16) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      if (Math.abs(red - 143) > 18 || Math.abs(green - 180) > 18 || Math.abs(blue - 212) > 18) {
        count += 1;
      }
    }
    return count;
  });
  expect(painted).toBeGreaterThan(200);

  const shot = await page.getByTestId("game-canvas").locator("canvas").screenshot();
  await test.info().attach("iso-occlusion", { body: shot, contentType: "image/png" });
  expect(shot.byteLength).toBeGreaterThan(5_000);
});

test("placement ghost tracks the pointer, explains blocks, and rotates the station", async ({ page }) => {
  await openCity(page);
  await page.getByTestId("place-cottage").click();

  await aim(page, GHOST_VALID_CELL);
  await expect(page.getByTestId("ghost-cell")).toHaveText(`${GHOST_VALID_CELL.x},${GHOST_VALID_CELL.y}`);
  await expect(page.getByTestId("ghost-tone")).toHaveText("valid");
  await expect(page.getByTestId("ghost-text")).toHaveText("Valid");
  await expect(page.getByTestId("ghost-icon")).toHaveText("ico_ui_check");
  await expect(page.getByTestId("ghost-road-hint")).toHaveText("yes");
  const validLatency = Number(await page.getByTestId("ghost-latency").textContent());
  expect(validLatency).toBeGreaterThanOrEqual(0);
  expect(validLatency).toBeLessThanOrEqual(100);

  await aim(page, GHOST_HINT_CLEAR_CELL);
  await expect(page.getByTestId("ghost-tone")).toHaveText("valid");
  await expect(page.getByTestId("ghost-road-hint")).toHaveText("no");
  expect(Number(await page.getByTestId("ghost-latency").textContent())).toBeLessThanOrEqual(100);

  await aim(page, GHOST_BLOCKED_CELL);
  await expect(page.getByTestId("ghost-tone")).toHaveText("blocked");
  await expect(page.getByTestId("ghost-text")).toHaveText("BAD_TERRAIN");
  await expect(page.getByTestId("ghost-icon")).toHaveText("ico_ui_alert");
  expect(Number(await page.getByTestId("ghost-latency").textContent())).toBeLessThanOrEqual(100);

  await aim(page, GHOST_OCCUPIED_CELL);
  await expect(page.getByTestId("ghost-text")).toContainText("OCCUPIED");

  await page.getByTestId("place-station").click();
  await aim(page, GHOST_VALID_CELL);
  await expect(page.getByTestId("ghost-footprint")).toHaveText("4x3");
  await expect(page.getByTestId("ghost-flip")).toHaveText("false");
  await page.keyboard.press("r");
  await expect(page.getByTestId("ghost-rotation")).toHaveText("1");
  await expect(page.getByTestId("ghost-footprint")).toHaveText("3x4");
  await expect(page.getByTestId("ghost-flip")).toHaveText("true");
  await page.keyboard.press("r");
  await expect(page.getByTestId("ghost-rotation")).toHaveText("2");
  await expect(page.getByTestId("ghost-footprint")).toHaveText("4x3");
  await expect(page.getByTestId("ghost-flip")).toHaveText("false");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ghost-tone")).toHaveText("idle");
});

test("state overlays collapse to status dots below zoom 0.9", async ({ page }) => {
  await openCity(page);
  await expect(page.getByTestId("overlay-cottage-build")).toHaveText("Under Construction");
  await expect(page.getByTestId("overlay-grocery")).toHaveText("Needs Supply");
  await expect(page.getByTestId("overlay-bakery")).toHaveText("3:00");
  await expect(page.getByTestId("overlay-cottage-ready")).toHaveText("Ready");
  await expect(page.getByTestId("overlay-wheat-ready")).toHaveText("Ready");
  await expect(page.getByTestId("district-list-hook")).toHaveCount(0);

  const before = await page.getByTestId("camera-scroll").textContent();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("camera-scroll")).not.toHaveText(before ?? "");

  const canvas = page.getByTestId("game-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("canvas missing");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await page.mouse.wheel(0, 120);
  await expect(page.getByTestId("zoom")).toHaveText("0.81");
  await expect(page.getByTestId("lod-mode")).toHaveText("collapsed");
  await expect(page.getByTestId("district-list-hook")).toBeVisible();
  await expect(page.getByTestId("overlay-grocery")).toHaveAttribute("data-kind", "dot");
  await expect(page.getByTestId("overlay-grocery")).toHaveAttribute("data-label", "Needs Supply");
  await expect(page.getByTestId("overlay-bakery")).toHaveAttribute("data-kind", "dot");
  await expect(page.getByTestId("overlay-cottage-build")).toHaveText("●");

  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, -120);
  await expect(page.getByTestId("lod-mode")).toHaveText("detailed");
  await expect(page.getByTestId("overlay-grocery")).toHaveText("Needs Supply");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a ready crop stays still", async ({ page }) => {
    await openCity(page);
    await expect(page.getByTestId("reduced-motion")).toHaveText("reduce");
    const first = await page.evaluate(() => window.__nfDebug?.cropOffset() ?? 0);
    await page.waitForTimeout(400);
    const second = await page.evaluate(() => window.__nfDebug?.cropOffset() ?? 0);
    expect(first).toBe(0);
    expect(second).toBe(0);
  });
});

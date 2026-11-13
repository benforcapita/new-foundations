import { gridToScreen } from "@nf/shared";
import { expect, test, type Page } from "@playwright/test";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../src/game/layout";
import { visibleArtTop } from "../src/game/spriteArt";
import {
  GHOST_BLOCKED_CELL,
  GHOST_HINT_CLEAR_CELL,
  GHOST_OCCUPIED_CELL,
  GHOST_VALID_CELL,
} from "../src/game/demoCity";

type Rgb = { readonly r: number; readonly g: number; readonly b: number };

declare global {
  interface Window {
    __nfPaintLatency?: Promise<number>;
  }
}

const LABEL_DISPLAY = 256;
const LABEL_SOURCE = 512;

async function openCity(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("scene-ready")).toHaveText("yes", { timeout: 20_000 });
  await nextFrame(page);
}

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(undefined);
          });
        });
      }),
  );
}

async function aimWorld(page: Page, x: number, y: number, zoom: number): Promise<void> {
  await page.getByTestId("aim-x").fill(String(x));
  await page.getByTestId("aim-y").fill(String(y));
  await page.getByTestId("aim-zoom").fill(String(zoom));
  await page.getByTestId("aim-go").click();
  await expect(page.getByTestId("zoom")).toHaveText(zoom.toFixed(2));
  await nextFrame(page);
}

function cellWorld(x: number, y: number): { x: number; y: number } {
  return gridToScreen(x + 0.5, y + 0.5, MAP_ORIGIN_X, MAP_ORIGIN_Y);
}

async function aim(page: Page, cell: { readonly x: number; readonly y: number }): Promise<void> {
  const world = cellWorld(cell.x, cell.y);
  await aimWorld(page, world.x, world.y, 1);
  const box = await page.getByTestId("game-canvas").locator("canvas").boundingBox();
  if (box === null) {
    throw new Error("canvas missing");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

test("renders the 24x24 starter map with depth-sorted buildings", async ({ page }) => {
  await openCity(page);
  await expect(page.getByRole("heading", { name: "New Foundations" })).toBeVisible();
  await expect(page.getByTestId("map-size")).toHaveText("24x24");
  const order = (await page.getByTestId("depth-order").textContent()) ?? "";
  const depths = new Map(
    order.split(",").map((entry) => {
      const [id, depth] = entry.split(":");
      return [id ?? "", Number(depth)] as const;
    }),
  );
  expect(depths.get("cottage-build")).toBe(4002);
  expect(depths.get("town-hall")).toBe(14007);
  expect(depths.get("grocery")).toBe(17010);
  expect(depths.get("cottage-build") ?? 0).toBeLessThan(depths.get("town-hall") ?? 0);
  expect(depths.get("town-hall") ?? 0).toBeLessThan(depths.get("grocery") ?? 0);

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

  const townHall: Rgb = { r: 103, g: 119, b: 131 };
  const cottage: Rgb = { r: 244, g: 217, b: 168 };
  await aimWorld(page, 1526, 204, 2);
  const frontPixels = await page.evaluate(
    ({ front, back }) => {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("canvas missing");
      }
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("canvas has no 2d context");
      }
      const originX = Math.round(canvas.width / 2) - 6;
      const originY = Math.round(canvas.height / 2) - 20;
      const { data } = context.getImageData(originX, originY, 13, 41);
      let closerToFront = 0;
      for (let index = 0; index < data.length; index += 4) {
        const pixel = { r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0 };
        const frontDistance =
          Math.abs(pixel.r - front.r) + Math.abs(pixel.g - front.g) + Math.abs(pixel.b - front.b);
        const backDistance = Math.abs(pixel.r - back.r) + Math.abs(pixel.g - back.g) + Math.abs(pixel.b - back.b);
        if (frontDistance + 50 < backDistance) {
          closerToFront += 1;
        }
      }
      return closerToFront;
    },
    { front: townHall, back: cottage },
  );
  expect(frontPixels).toBeGreaterThanOrEqual(10);
});

async function pointerToPixelMs(page: Page, cell: { readonly x: number; readonly y: number }): Promise<number> {
  const world = cellWorld(cell.x, cell.y);
  await aimWorld(page, world.x, world.y, 1);
  const box = await page.getByTestId("game-canvas").locator("canvas").boundingBox();
  if (box === null) {
    throw new Error("canvas missing");
  }
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("canvas missing");
    }
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("canvas has no 2d context");
    }
    const centerX = Math.round(canvas.width / 2);
    const centerY = Math.round(canvas.height / 2) + 32;
    const painted = (): boolean => {
      const data = context.getImageData(centerX - 3, centerY - 3, 7, 7).data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        if (red > 180 && green > 180 && blue < 90) {
          return true;
        }
      }
      return false;
    };
    window.__nfPaintLatency = new Promise((resolve) => {
      const onMove = (): void => {
        canvas.removeEventListener("pointermove", onMove, true);
        const started = performance.now();
        const tick = (): void => {
          if (painted() || performance.now() - started > 400) {
            resolve(Math.round(performance.now() - started));
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      canvas.addEventListener("pointermove", onMove, true);
    });
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  return page.evaluate(() => window.__nfPaintLatency ?? Promise.resolve(500));
}

test("placement ghost tracks the pointer, explains blocks, and rotates the station", async ({ page }) => {
  await openCity(page);
  await page.getByTestId("place-cottage").click();

  const validLatency = await pointerToPixelMs(page, GHOST_VALID_CELL);
  expect(validLatency).toBeGreaterThanOrEqual(0);
  expect(validLatency).toBeLessThanOrEqual(100);
  await expect(page.getByTestId("ghost-cell")).toHaveText(`${GHOST_VALID_CELL.x},${GHOST_VALID_CELL.y}`);
  await expect(page.getByTestId("ghost-tone")).toHaveText("valid");
  await expect(page.getByTestId("ghost-text")).toHaveText("Valid");
  await expect(page.getByTestId("ghost-icon")).toHaveText("ico_ui_check");
  await expect(page.getByTestId("ghost-road-hint")).toHaveText("yes");

  await aim(page, GHOST_HINT_CLEAR_CELL);
  await expect(page.getByTestId("ghost-tone")).toHaveText("valid");
  await expect(page.getByTestId("ghost-road-hint")).toHaveText("no");

  await aim(page, GHOST_BLOCKED_CELL);
  await expect(page.getByTestId("ghost-tone")).toHaveText("blocked");
  await expect(page.getByTestId("ghost-text")).toHaveText("Bad terrain");
  await expect(page.getByTestId("ghost-icon")).toHaveText("ico_ui_alert");

  await aim(page, GHOST_OCCUPIED_CELL);
  await expect(page.getByTestId("ghost-text")).toContainText("Occupied");

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

function labelSample(x: number, y: number, opaqueRow: number): { readonly roof: { x: number; y: number }; readonly frame: { x: number; y: number } } {
  const anchor = gridToScreen(x + 2, y + 2, MAP_ORIGIN_X, MAP_ORIGIN_Y);
  const artTop = visibleArtTop(anchor.y, LABEL_DISPLAY, 1, LABEL_SOURCE, opaqueRow);
  return {
    roof: { x: anchor.x + 8, y: artTop - 12 },
    frame: { x: anchor.x + 8, y: anchor.y - LABEL_DISPLAY - 24 },
  };
}

async function creamPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("canvas missing");
    }
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("canvas has no 2d context");
    }
    const originX = Math.round(canvas.width / 2) - 6;
    const originY = Math.round(canvas.height / 2) - 6;
    const { data } = context.getImageData(originX, originY, 13, 13);
    let matches = 0;
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      if (Math.abs(red - 244) < 12 && Math.abs(green - 241) < 12 && Math.abs(blue - 234) < 12) {
        matches += 1;
      }
    }
    return matches;
  });
}

test("state overlays collapse to status dots below zoom 0.9", async ({ page }) => {
  await openCity(page);
  await expect(page.getByTestId("overlay-cottage-build")).toHaveText("Under Construction");
  const labels = [
    { id: "cottage-build", x: 1, y: 1, opaqueRow: 199 },
    { id: "grocery", x: 9, y: 6, opaqueRow: 199 },
    { id: "bakery", x: 9, y: 9, opaqueRow: 41 },
    { id: "cottage-ready", x: 12, y: 12, opaqueRow: 199 },
  ];
  for (const label of labels) {
    const sample = labelSample(label.x, label.y, label.opaqueRow);
    await aimWorld(page, sample.roof.x, sample.roof.y, 2);
    expect(await creamPixels(page), `${label.id} roof`).toBeGreaterThanOrEqual(8);
    await aimWorld(page, sample.frame.x, sample.frame.y, 2);
    expect(await creamPixels(page), `${label.id} frame`).toBe(0);
  }
  await aimWorld(page, 1536, 624, 1);
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
    await expect(page.getByTestId("crop-offset")).toHaveText("0");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("crop-offset")).toHaveText("0");
  });
});

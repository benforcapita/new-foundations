import { getAssetMeta, gridToScreen } from "@nf/shared";
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import {
  GHOST_BLOCKED_CELL,
  GHOST_HINT_CLEAR_CELL,
  GHOST_OCCUPIED_CELL,
  GHOST_VALID_CELL,
} from "../src/game/demoCity";
import {
  decodePng,
  foreignOpaqueTexels,
  repoRoot,
  type RgbaImage,
  type SpriteFrame,
  type WorldRect,
} from "../src/game/labelOcclusion";
import { MAP_ORIGIN_X, MAP_ORIGIN_Y } from "../src/game/layout";

type Rgb = { readonly r: number; readonly g: number; readonly b: number };

declare global {
  interface Window {
    __nfPaintLatency?: Promise<number>;
  }
}

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

function parseBox(value: string | null): WorldRect | null {
  if (value === null || value === "") {
    return null;
  }
  const parts = value.split(",").map(Number);
  const x = parts[0];
  const y = parts[1];
  const width = parts[2];
  const height = parts[3];
  if (x === undefined || y === undefined || width === undefined || height === undefined || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`bad overlay box ${value}`);
  }
  return { x, y, width, height };
}

function buildingImages(frames: readonly SpriteFrame[]): Map<string, RgbaImage> {
  const root = repoRoot();
  const images = new Map<string, RgbaImage>();
  for (const frame of frames) {
    if (images.has(frame.assetId)) {
      continue;
    }
    images.set(frame.assetId, decodePng(resolve(root, getAssetMeta(frame.assetId).path)));
  }
  return images;
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
  const frames = JSON.parse(await page.getByTestId("sprite-frames").innerText()) as SpriteFrame[];
  const images = buildingImages(frames);
  const labeled = ["cottage-build", "grocery", "bakery", "cottage-ready"];
  for (const id of labeled) {
    const frame = frames.find((entry) => entry.id === id);
    if (frame === undefined) {
      throw new Error(`missing sprite ${id}`);
    }
    const labelBox = parseBox(await page.getByTestId(`overlay-${id}`).getAttribute("data-label-box"));
    const iconBox = parseBox(await page.getByTestId(`overlay-${id}`).getAttribute("data-icon-box"));
    if (labelBox === null) {
      throw new Error(`${id} has no label box`);
    }
    expect(foreignOpaqueTexels(labelBox, frames, images, id), `${id} label`).toBe(0);
    if (iconBox !== null) {
      expect(foreignOpaqueTexels(iconBox, frames, images, id), `${id} icon`).toBe(0);
    }
    await aimWorld(page, labelBox.x + 6, labelBox.y + 6, 2);
    expect(await creamPixels(page), `${id} roof`).toBeGreaterThanOrEqual(8);
    const frameTop = frame.y - frame.displayHeight * frame.originY;
    await aimWorld(page, frame.x + 8, frameTop - 24, 2);
    expect(await creamPixels(page), `${id} frame`).toBe(0);
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

test("building label rectangles do not cover other buildings' opaque texels", async ({ page }) => {
  await openCity(page);
  const buildings = [
    { id: "cottage-build", asset: "bld_res_cottage", x: 1, y: 1, size: 2 },
    { id: "town-hall", asset: "bld_civic_townhall", x: 4, y: 4, size: 4 },
    { id: "grocery", asset: "bld_com_grocery", x: 9, y: 6, size: 2 },
    { id: "bakery", asset: "bld_prod_bakery", x: 9, y: 9, size: 2 },
    { id: "cottage-ready", asset: "bld_res_cottage", x: 12, y: 12, size: 2 },
  ].map((building) => ({ ...building, anchor: gridToScreen(building.x + building.size, building.y + building.size, MAP_ORIGIN_X, MAP_ORIGIN_Y) }));

  for (const building of buildings.filter((item) => item.id !== "town-hall")) {
    const center = { x: building.anchor.x, y: building.anchor.y - 150 };
    await aimWorld(page, center.x, center.y, 1);
    const overlaps = await page.evaluate(async ({ building, buildings, center }) => {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas missing");
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("canvas context missing");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const cream = (x: number, y: number): boolean => {
        const i = (y * canvas.width + x) * 4;
        return pixels[i] === 244 && pixels[i + 1] === 241 && pixels[i + 2] === 234;
      };
      const left = Math.round(canvas.width / 2);
      const scanX = left + 1;
      const runs: { top: number; bottom: number }[] = [];
      for (let y = Math.round(canvas.height / 2 - 110); y < Math.round(canvas.height / 2 + 100); y += 1) {
        if (!cream(scanX, y)) continue;
        const top = y;
        while (cream(scanX, y + 1)) y += 1;
        if (y - top >= 10) runs.push({ top, bottom: y + 1 });
      }
      if (runs.length !== 1) throw new Error(`${building.id}: expected one label, found ${runs.length}`);
      const run = runs[0];
      if (run === undefined) throw new Error("label missing");
      let right = left;
      while (cream(right, run.top + 1)) right += 1;
      if (right - left < 10) throw new Error(`${building.id}: label width missing`);
      const result: string[] = [];
      for (const other of buildings.filter((item) => item.id !== building.id)) {
        const resource = performance.getEntriesByType("resource").find((entry) => entry.name.includes(other.asset));
        if (resource === undefined) throw new Error(`asset missing: ${other.asset}`);
        const image = new Image();
        image.src = resource.name;
        await image.decode();
        const mask = document.createElement("canvas");
        mask.width = image.width;
        mask.height = image.height;
        const maskContext = mask.getContext("2d");
        if (maskContext === null) throw new Error("mask context missing");
        maskContext.drawImage(image, 0, 0);
        const alpha = maskContext.getImageData(0, 0, image.width, image.height).data;
        for (let y = run.top; y < run.bottom; y += 1) {
          for (let x = left; x < right; x += 1) {
            const worldX = center.x + x - canvas.width / 2;
            const worldY = center.y + y - canvas.height / 2;
            const display = other.size * 128;
            const sourceX = Math.floor((worldX - (other.anchor.x - display / 2)) * image.width / display);
            const sourceY = Math.floor((worldY - (other.anchor.y - display)) * image.height / display);
            if (sourceX >= 0 && sourceX < image.width && sourceY >= 0 && sourceY < image.height &&
                (alpha[(sourceY * image.width + sourceX) * 4 + 3] ?? 0) > 16) {
              result.push(`${building.id} covers ${other.id}`);
              break;
            }
          }
          if (result.at(-1) === `${building.id} covers ${other.id}`) break;
        }
      }
      return result;
    }, { building, buildings, center });
    expect(overlaps).toEqual([]);
  }
});

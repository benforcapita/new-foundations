import { buildingById, getAssetMeta } from "@nf/shared";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { demoBuildings } from "./demoCity";
import { anchorScreen, displaySize } from "./layout";
import { decodePng, foreignOpaqueTexels, repoRoot, type RgbaImage, type SpriteFrame, type WorldRect } from "./labelOcclusion";
import { overlayForState } from "./overlays";
import { firstOpaqueRow, roofBodyRow, visibleArtTop } from "./spriteArt";

const LABEL_HEIGHT = 22;

function loadBuildings(): { frames: SpriteFrame[]; images: Map<string, RgbaImage> } {
  const root = repoRoot();
  const images = new Map<string, RgbaImage>();
  const frames: SpriteFrame[] = [];
  for (const building of demoBuildings()) {
    const definition = buildingById(building.buildingId);
    const meta = getAssetMeta(definition.assetId);
    const image = images.get(definition.assetId) ?? decodePng(resolve(root, meta.path));
    images.set(definition.assetId, image);
    const size = displaySize(definition.footprint.width, definition.footprint.height, meta.displayScale, image.height / image.width);
    const anchor = anchorScreen(building.x, building.y, definition.footprint.width, definition.footprint.height);
    frames.push({
      id: building.instanceId,
      assetId: definition.assetId,
      x: anchor.x,
      y: anchor.y,
      displayWidth: size.width,
      displayHeight: size.height,
      originX: 0.5,
      originY: meta.pivotY,
    });
  }
  return { frames, images };
}

function labelRect(anchorX: number, artTop: number, text: string): WorldRect {
  return {
    x: anchorX,
    y: artTop - 2 - LABEL_HEIGHT,
    width: text.length * 9 + 8,
    height: LABEL_HEIGHT,
  };
}

test("the bakery timer stays off the town hall when the label uses the roof body", () => {
  const { frames, images } = loadBuildings();
  const bakery = frames.find((frame) => frame.id === "bakery");
  const image = bakery === undefined ? undefined : images.get(bakery.assetId);
  if (bakery === undefined || image === undefined) {
    throw new Error("bakery sprite missing");
  }
  const alphaAt = image.alphaAt;
  const smokeRow = firstOpaqueRow(image.width, image.height, alphaAt);
  const roofRow = roofBodyRow(image.width, image.height, alphaAt);
  expect(smokeRow).toBe(41);
  expect(roofRow).toBeGreaterThan(200);

  const placed = demoBuildings().find((building) => building.instanceId === "bakery");
  if (placed === undefined) {
    throw new Error("bakery missing");
  }
  const overlay = overlayForState(placed.state, placed.timerLabel);
  if (overlay === null) {
    throw new Error("bakery has no label");
  }
  const smokeTop = visibleArtTop(bakery.y, bakery.displayHeight, bakery.originY, image.height, smokeRow);
  const roofTop = visibleArtTop(bakery.y, bakery.displayHeight, bakery.originY, image.height, roofRow);
  expect(foreignOpaqueTexels(labelRect(bakery.x, smokeTop, overlay.text), frames, images, "bakery")).toBeGreaterThan(0);
  expect(foreignOpaqueTexels(labelRect(bakery.x, roofTop, overlay.text), frames, images, "bakery")).toBe(0);

  for (const building of demoBuildings()) {
    const spec = overlayForState(building.state, building.timerLabel);
    const frame = frames.find((entry) => entry.id === building.instanceId);
    const art = frame === undefined ? undefined : images.get(frame.assetId);
    if (spec === null || frame === undefined || art === undefined) {
      continue;
    }
    const artTop = visibleArtTop(
      frame.y,
      frame.displayHeight,
      frame.originY,
      art.height,
      roofBodyRow(art.width, art.height, art.alphaAt),
    );
    expect(foreignOpaqueTexels(labelRect(frame.x, artTop, spec.text), frames, images, frame.id), building.instanceId).toBe(0);
    if (spec.icon !== null) {
      expect(
        foreignOpaqueTexels(
          { x: frame.x - 34, y: artTop - 30, width: 28, height: 28 },
          frames,
          images,
          frame.id,
        ),
        `${building.instanceId} icon`,
      ).toBe(0);
    }
  }
});

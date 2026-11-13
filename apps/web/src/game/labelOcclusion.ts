import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const OPAQUE_ALPHA = 16;

export type RgbaImage = {
  readonly width: number;
  readonly height: number;
  readonly alphaAt: (x: number, y: number) => number;
};

export type SpriteFrame = {
  readonly id: string;
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly originX: number;
  readonly originY: number;
};

export type WorldRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let hop = 0; hop < 8; hop += 1) {
    if (existsSync(resolve(dir, "assets/asset_manifest.json"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  throw new Error("repo root not found");
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }
  if (distanceUp <= distanceUpLeft) {
    return up;
  }
  return upLeft;
}

/** Decode an 8-bit RGBA PNG. Building art is stored that way, and tests read it without a canvas. */
export function decodePng(filePath: string): RgbaImage {
  const bytes = readFileSync(filePath);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      throw new Error(`not a png: ${filePath}`);
    }
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const chunks: Buffer[] = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      chunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`unsupported png ${filePath}`);
  }
  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  const previous = new Uint8Array(stride);
  const current = new Uint8Array(stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source] ?? 0;
    source += 1;
    for (let index = 0; index < stride; index += 1) {
      const raw = inflated[source + index] ?? 0;
      const left = index >= 4 ? (current[index - 4] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const upLeft = index >= 4 ? (previous[index - 4] ?? 0) : 0;
      let value = raw;
      if (filter === 1) {
        value = (raw + left) & 255;
      } else if (filter === 2) {
        value = (raw + up) & 255;
      } else if (filter === 3) {
        value = (raw + Math.floor((left + up) / 2)) & 255;
      } else if (filter === 4) {
        value = (raw + paeth(left, up, upLeft)) & 255;
      } else if (filter !== 0) {
        throw new Error(`bad png filter ${filter}`);
      }
      current[index] = value;
    }
    source += stride;
    rgba.set(current, y * stride);
    previous.set(current);
  }
  return {
    width,
    height,
    alphaAt: (x, y) => rgba[(y * width + x) * 4 + 3] ?? 0,
  };
}

/** Opaque texels of every sprite except `ignoreId` whose centers fall inside `rect`. */
export function foreignOpaqueTexels(
  rect: WorldRect,
  frames: readonly SpriteFrame[],
  images: ReadonlyMap<string, RgbaImage>,
  ignoreId: string,
): number {
  let hits = 0;
  for (const frame of frames) {
    if (frame.id === ignoreId) {
      continue;
    }
    const image = images.get(frame.assetId);
    if (image === undefined) {
      throw new Error(`missing image for ${frame.assetId}`);
    }
    const left = frame.x - frame.displayWidth * frame.originX;
    const top = frame.y - frame.displayHeight * frame.originY;
    const yStart = Math.max(0, Math.floor(((rect.y - top) / frame.displayHeight) * image.height) - 1);
    const yEnd = Math.min(image.height, Math.ceil(((rect.y + rect.height - top) / frame.displayHeight) * image.height) + 1);
    const xStart = Math.max(0, Math.floor(((rect.x - left) / frame.displayWidth) * image.width) - 1);
    const xEnd = Math.min(image.width, Math.ceil(((rect.x + rect.width - left) / frame.displayWidth) * image.width) + 1);
    for (let sy = yStart; sy < yEnd; sy += 1) {
      const worldY = top + ((sy + 0.5) / image.height) * frame.displayHeight;
      if (worldY < rect.y || worldY >= rect.y + rect.height) {
        continue;
      }
      for (let sx = xStart; sx < xEnd; sx += 1) {
        if (image.alphaAt(sx, sy) <= OPAQUE_ALPHA) {
          continue;
        }
        const worldX = left + ((sx + 0.5) / image.width) * frame.displayWidth;
        if (worldX >= rect.x && worldX < rect.x + rect.width) {
          hits += 1;
        }
      }
    }
  }
  return hits;
}

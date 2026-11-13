/// <reference types="vite/client" />
import { getAssetMeta, listAssetMeta } from "@nf/shared";

const pngModules: unknown = import.meta.glob(
  [
    "../../../../assets/buildings/**/*.png",
    "../../../../assets/decorations/**/*.png",
    "../../../../assets/resources/**/*.png",
    "../../../../assets/terrain/**/*.png",
    "../../../../assets/ui/**/*.png",
  ],
  {
    eager: true,
    import: "default",
    query: "?url",
  },
);

function isUrlMap(value: unknown): value is Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

export function pngUrlMap(): Readonly<Record<string, string>> {
  if (!isUrlMap(pngModules)) {
    throw new Error("asset png glob did not return urls");
  }
  return pngModules;
}

export function resolveAssetUrl(assetId: string, urls: Readonly<Record<string, string>> = pngUrlMap()): string {
  const meta = getAssetMeta(assetId);
  if (!meta.path.endsWith(".png")) {
    throw new Error(`${assetId} has no png at ${meta.path}`);
  }
  const match = Object.entries(urls).find(([key]) => key.endsWith(meta.path));
  if (match === undefined) {
    throw new Error(`png not bundled for ${assetId} (${meta.path})`);
  }
  return match[1];
}

export function bundledPngIds(): readonly string[] {
  return listAssetMeta()
    .filter((asset) => asset.path.endsWith(".png"))
    .map((asset) => asset.assetId);
}

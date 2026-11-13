import manifest from "../../../../assets/asset_manifest.json" with { type: "json" };

export const ASSET_STATUSES = ["PLACEHOLDER", "BRIEF_READY", "IN_PRODUCTION", "APPROVED", "INTEGRATED"] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export type AssetMeta = {
  readonly assetId: string;
  readonly manifestId: string;
  readonly category: string;
  readonly path: string;
  readonly pivotY: number;
  readonly displayScale: number;
  readonly status: AssetStatus;
  readonly phase: string;
  readonly priority: string;
};

const PRESENTATION: Readonly<Record<string, { readonly pivotY: number; readonly displayScale: number }>> = {
  buildings: { pivotY: 1, displayScale: 1 },
  decorations: { pivotY: 0.95, displayScale: 1 },
  terrain: { pivotY: 1, displayScale: 1 },
  resources: { pivotY: 0.85, displayScale: 0.5 },
  ui: { pivotY: 0.85, displayScale: 0.5 },
  npc: { pivotY: 0.9, displayScale: 1 },
  vfx: { pivotY: 0.9, displayScale: 1 },
  audio: { pivotY: 0.85, displayScale: 1 },
  promo: { pivotY: 0.85, displayScale: 1 },
};

export class BriefReadyAssetError extends Error {
  readonly assetId: string;

  constructor(assetId: string) {
    super(`${assetId} is BRIEF_READY and cannot be referenced by Phase 0/1 content`);
    this.name = "BriefReadyAssetError";
    this.assetId = assetId;
  }
}

function isStatus(value: string): value is AssetStatus {
  return (ASSET_STATUSES as readonly string[]).includes(value);
}

function presentationFor(category: string): { readonly pivotY: number; readonly displayScale: number } {
  const presentation = PRESENTATION[category];
  if (presentation === undefined) {
    throw new Error(`no pivot or scale for asset category ${category}`);
  }
  if (presentation.pivotY < 0.85 || presentation.pivotY > 1) {
    throw new Error(`pivotY for ${category} must stay between 0.85 and 1`);
  }
  return presentation;
}

function readManifest(): readonly AssetMeta[] {
  return manifest.assets.map((entry) => {
    if (!isStatus(entry.status)) {
      throw new Error(`asset ${entry.name} has unknown status ${entry.status}`);
    }
    const presentation = presentationFor(entry.category);
    const path = entry.export_png.length > 0 ? entry.export_png : entry.source_svg;
    return {
      assetId: entry.name,
      manifestId: entry.id,
      category: entry.category,
      path,
      pivotY: presentation.pivotY,
      displayScale: presentation.displayScale,
      status: entry.status,
      phase: entry.phase,
      priority: entry.priority,
    };
  });
}

const ASSETS = readManifest();
const BY_ID = new Map(ASSETS.map((asset) => [asset.assetId, asset]));

export function listAssetMeta(): readonly AssetMeta[] {
  return ASSETS;
}

export function getAssetMeta(assetId: string): AssetMeta {
  const meta = BY_ID.get(assetId);
  if (meta === undefined) {
    throw new Error(`unknown asset ${assetId}`);
  }
  return meta;
}

export function assertPlayableAsset(assetId: string): AssetMeta {
  const meta = getAssetMeta(assetId);
  if (meta.status === "BRIEF_READY") {
    throw new BriefReadyAssetError(assetId);
  }
  return meta;
}

export function assertPlayableAssets(assetIds: readonly string[]): void {
  for (const assetId of assetIds) {
    assertPlayableAsset(assetId);
  }
}

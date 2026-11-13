import { agricultureById, type AgricultureId } from "@nf/shared";

export type PlotPresentation = {
  readonly groundAssetId: string;
  readonly groundTileCount: number;
  readonly propAssetId: string | null;
  readonly overlayAssetId: string;
  readonly overlayScale: number;
};

export function plotPresentation(id: AgricultureId): PlotPresentation {
  const plot = agricultureById(id);
  return {
    groundAssetId: plot.groundAssetId,
    groundTileCount: plot.groundTileCount,
    propAssetId: plot.propAssetId ?? null,
    overlayAssetId: plot.overlayAssetId,
    overlayScale: 0.5,
  };
}

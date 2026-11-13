import { expect, test } from "vitest";
import { phase01AssetIds } from "../content/references";
import { BriefReadyAssetError, assertPlayableAsset, getAssetMeta, listAssetMeta } from "./assetMeta";

test("phase 0 and 1 catalog entities never reference a BRIEF_READY asset", () => {
  const ids = phase01AssetIds();
  expect(ids.length).toBeGreaterThan(0);
  for (const assetId of ids) {
    const meta = getAssetMeta(assetId);
    expect(meta.status).not.toBe("BRIEF_READY");
    expect(meta.path.length).toBeGreaterThan(0);
    expect(assertPlayableAsset(assetId).assetId).toBe(assetId);
  }
  expect(() => assertPlayableAsset("bld_log_harbor")).toThrow(BriefReadyAssetError);
  expect(getAssetMeta("bld_log_harbor").status).toBe("BRIEF_READY");
});

test("every manifest asset has a pivot inside 0.85 to 1", () => {
  const assets = listAssetMeta();
  expect(assets.length).toBeGreaterThan(0);
  for (const asset of assets) {
    expect(asset.pivotY).toBeGreaterThanOrEqual(0.85);
    expect(asset.pivotY).toBeLessThanOrEqual(1);
    expect(asset.displayScale).toBeGreaterThan(0);
  }
  expect(() => getAssetMeta("missing-asset")).toThrow(/unknown asset/);
});

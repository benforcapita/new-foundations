# Starter asset bundle

TODO for the engineering lead: this directory is the landing place for the New Foundations starter bundle. Do not generate stand-in art. Push the real files onto the `nf-1-monorepo-assets-ci` branch, byte-identical to the bundle:

- 59 asset entries, which are 118 SVG/PNG files
- 3 preview PNGs
- `asset_manifest.json`
- `asset_manifest.csv`
- `content_seed.json`
- `localization_en.json`
- `CHECKSUMS.sha256` (this file is the manifest the CI test reads; do not list the manifest inside itself)

Also copy the GDD to `docs/GDD_New_Foundations_EN.md`.

`CHECKSUMS.sha256` uses the `sha256sum` text format (`<64 hex digits><two spaces><path>`). Paths are relative to the repository root. From the repository root, after the bundle files are in place:

```bash
find assets docs/GDD_New_Foundations_EN.md -type f \
  ! -name CHECKSUMS.sha256 \
  ! -name README.md \
  -print0 | sort -z | xargs -0 sha256sum > assets/CHECKSUMS.sha256
```

`tests/asset-checksums.test.ts` verifies every listed path. That test skips with an explanation only when `assets/CHECKSUMS.sha256` is absent. Once the manifest is committed, a missing file, a mismatched byte, an empty manifest, or a path that escapes the repo fails CI.

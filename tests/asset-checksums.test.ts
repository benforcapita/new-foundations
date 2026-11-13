import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { verifyChecksumManifest } from "./asset-checksums";

const HELLO_SHA256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "assets", "CHECKSUMS.sha256");

const MISSING_MANIFEST_MESSAGE =
  "assets/CHECKSUMS.sha256 is absent. The engineering lead still needs to commit the starter bundle (118 SVG/PNG files, 3 preview PNGs, asset_manifest.json, asset_manifest.csv, content_seed.json, localization_en.json, and docs/GDD_New_Foundations_EN.md) and a sha256sum manifest at assets/CHECKSUMS.sha256. Paths in that manifest are relative to the repository root and use the sha256sum format. This check does not verify bytes until that manifest exists.";

test("checksum manifest accepts a matching file", () => {
  const root = makeRepo({ "assets/hello.txt": "hello" });
  verifyChecksumManifest({
    repoRoot: root,
    manifestText: `${HELLO_SHA256}  assets/hello.txt\n`,
  });
});

test("checksum manifest reports a byte mismatch", () => {
  const root = makeRepo({ "assets/hello.txt": "goodbye" });
  expect(() =>
    verifyChecksumManifest({
      repoRoot: root,
      manifestText: `${HELLO_SHA256}  assets/hello.txt\n`,
    }),
  ).toThrow(/assets\/hello\.txt: sha256 .+ does not match manifest/);
});

test("checksum manifest reports a missing file", () => {
  const root = makeRepo({});
  expect(() =>
    verifyChecksumManifest({
      repoRoot: root,
      manifestText: `${HELLO_SHA256}  assets/hello.txt\n`,
    }),
  ).toThrow("assets/hello.txt: file is missing");
});

test("checksum manifest rejects paths that escape the repository", () => {
  const root = makeRepo({});
  expect(() =>
    verifyChecksumManifest({
      repoRoot: root,
      manifestText: `${HELLO_SHA256}  ../hello.txt\n`,
    }),
  ).toThrow("../hello.txt: path must be a normalized repo-relative path");
});

test("checksum manifest rejects an empty file", () => {
  expect(() => verifyChecksumManifest({ repoRoot: repoRoot, manifestText: "\n# none\n" })).toThrow(
    "checksum manifest is present but lists no files",
  );
});

test("checksum manifest rejects a repeated path", () => {
  const root = makeRepo({ "assets/hello.txt": "hello" });
  const line = `${HELLO_SHA256}  assets/hello.txt`;
  expect(() =>
    verifyChecksumManifest({
      repoRoot: root,
      manifestText: `${line}\n${line}\n`,
    }),
  ).toThrow("assets/hello.txt: listed more than once");
});

test("checksum manifest rejects a malformed line", () => {
  expect(() =>
    verifyChecksumManifest({ repoRoot: repoRoot, manifestText: "not-a-digest  assets/a.txt\n" }),
  ).toThrow("checksum manifest line 1 must look like");
});

test("starter bundle matches assets/CHECKSUMS.sha256", (ctx) => {
  if (!existsSync(manifestPath)) {
    ctx.skip(MISSING_MANIFEST_MESSAGE);
    return;
  }
  verifyChecksumManifest({
    repoRoot,
    manifestText: readFileSync(manifestPath, "utf8"),
  });
});

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "nf-checksums-"));
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = path.join(root, relativePath);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  return root;
}

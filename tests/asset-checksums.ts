import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type ChecksumEntry = {
  readonly digest: string;
  readonly path: string;
};

const LINE = /^([a-fA-F0-9]{64}) [ *](.+)$/;

export function verifyChecksumManifest(input: {
  readonly repoRoot: string;
  readonly manifestText: string;
}): void {
  const entries = parseManifest(input.manifestText);
  if (entries.length === 0) {
    throw new Error("checksum manifest is present but lists no files");
  }

  const seen = new Set<string>();
  const problems: string[] = [];
  for (const entry of entries) {
    if (seen.has(entry.path)) {
      problems.push(`${entry.path}: listed more than once`);
      continue;
    }
    seen.add(entry.path);

    let absolute: string;
    try {
      absolute = resolveInsideRepo(input.repoRoot, entry.path);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (!existsSync(absolute)) {
      problems.push(`${entry.path}: file is missing`);
      continue;
    }

    const actual = sha256File(absolute);
    if (actual !== entry.digest) {
      problems.push(
        `${entry.path}: sha256 ${actual} does not match manifest ${entry.digest}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Asset checksum verification failed:\n${problems.join("\n")}`);
  }
}

function parseManifest(manifestText: string): readonly ChecksumEntry[] {
  const entries: ChecksumEntry[] = [];
  const lines = manifestText.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    if (raw === undefined || raw.trim().length === 0 || raw.trimStart().startsWith("#")) {
      continue;
    }
    const match = LINE.exec(raw);
    if (match === null) {
      throw new Error(
        `checksum manifest line ${index + 1} must look like "<64 hex digits><two spaces, or a space and an asterisk><repo-relative path>"`,
      );
    }
    const digest = match[1];
    const filePath = match[2];
    if (digest === undefined || filePath === undefined || filePath.length === 0) {
      throw new Error(`checksum manifest line ${index + 1} is incomplete`);
    }
    entries.push({ digest: digest.toLowerCase(), path: filePath });
  }
  return entries;
}

function resolveInsideRepo(repoRoot: string, relativePath: string): string {
  const segments = relativePath.split("/");
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("/") ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`${relativePath}: path must be a normalized repo-relative path`);
  }

  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, relativePath);
  const fromRoot = path.relative(root, absolute);
  const escapes =
    fromRoot === "" ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${path.sep}`) ||
    fromRoot.startsWith("../");
  if (escapes) {
    throw new Error(`${relativePath}: path escapes the repository`);
  }
  return absolute;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

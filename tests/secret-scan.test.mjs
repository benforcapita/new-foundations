import { test } from "node:test";
import { URL } from "node:url";
import process from "node:process";
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function scan(content, filename = "fixture.txt") {
  const dir = mkdtempSync(join(tmpdir(), "secret-scan-"));
  try {
    mkdirSync(join(dir, "tests"));
    copyFileSync(new URL("./secret-scan.mjs", import.meta.url), join(dir, "tests/secret-scan.mjs"));
    writeFileSync(join(dir, filename), content);
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", filename], { cwd: dir });
    return spawnSync(process.execPath, ["tests/secret-scan.mjs"], { cwd: dir, encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("detects secrets in uppercase snake-case identifiers", () => {
  for (const key of ["SESSION_PEPPER", "API_TOKEN", "DB_PASSWORD"]) {
    const result = scan(`${key}${key === "API_TOKEN" ? ":" : "="}${"abcdefghijklmnopqrstuvwxyz012345"}\n`);
    assert.equal(result.status, 1, key);
    assert.match(result.stderr, /possible secret assignment/);
  }
});

test("accepts clean values and example placeholders", () => {
  assert.equal(scan("SESSION_PEPPER=\nAPI_TOKEN=placeholder\nDB_PASSWORD=short\n").status, 0);
  assert.equal(scan("SESSION_PEPPER=\nDATABASE_URL=postgres://nf:nf@localhost:5432/new_foundations\n", ".env.example").status, 0);
});

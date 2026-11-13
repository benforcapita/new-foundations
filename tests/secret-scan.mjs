import { URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings = [];
const keyPattern = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\bBearer\s+[A-Za-z0-9_.~+/-]{20,}/i;
const assignment = /\b(?:[A-Za-z_][A-Za-z0-9_-]*)?(?:secret|password|passwd|token|api[_-]?key|pepper)[A-Za-z0-9_-]*\s*[:=]\s*["']?([^\s"'`,;]+)/i;
for (const file of files) {
  if (/(^|\/)\.env(?:\..*)?$/.test(file) && !file.endsWith(".example")) findings.push(`${file}: tracked environment file`);
  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue;
  const lines = buffer.toString("utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (keyPattern.test(line)) findings.push(`${file}:${index + 1}: credential pattern`);
    for (const match of line.matchAll(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'`<>]+/gi)) {
      try {
        const url = new URL(match[0]);
        if (url.password && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) findings.push(`${file}:${index + 1}: non-local database credentials`);
      } catch { findings.push(`${file}:${index + 1}: invalid database URL`); }
    }
    const candidate = line.match(assignment)?.[1] ?? "";
    if (candidate.length >= 24 && /^[A-Za-z0-9_+/=-]+$/.test(candidate) && new Set(candidate).size >= 12) findings.push(`${file}:${index + 1}: possible secret assignment`);
    if (basename(file) === ".env.example" && !/^\s*(?:#|$)/.test(line)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) findings.push(`${file}:${index + 1}: invalid example entry`);
      else if (match[2]) {
        const safe = {
          PORT: /^\d{1,5}$/,
          HOST: /^(?:0\.0\.0\.0|127\.0\.0\.1|localhost)$/,
          DATABASE_URL: /^postgres(?:ql)?:\/\/nf:nf@(?:127\.0\.0\.1|localhost)(?::\d+)?\/new_foundations$/,
          VITE_API_URL: /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
        };
        if (!safe[match[1]]?.test(match[2])) findings.push(`${file}:${index + 1}: unsafe example value`);
      }
    }
  }
}
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else console.log(`Secret scan passed (${files.length} tracked files).`);

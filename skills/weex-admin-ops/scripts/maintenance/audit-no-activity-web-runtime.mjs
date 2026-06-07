#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function listFiles(dirPath) {
  const out = [];
  const walk = current => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(abs);
        continue;
      }
      out.push(abs);
    }
  };
  walk(dirPath);
  return out;
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function isExcluded(absPath, repoRoot) {
  const rel = path.relative(repoRoot, absPath).replaceAll("\\", "/");
  if (!rel.startsWith("skills/weex-admin-ops/scripts/")) return true;
  if (rel.includes("/__tests__/")) return true;
  if (rel.startsWith("skills/weex-admin-ops/scripts/maintenance/audit-no-activity-web-runtime.mjs")) return true;
  if (rel.startsWith("skills/weex-admin-ops/scripts/maintenance/update-admin-catalogs-from-activity-web.mjs")) return true;
  if (rel.startsWith("skills/weex-admin-ops/scripts/lib/activity-web-mappings.mjs")) return true;
  if (rel.startsWith("skills/weex-admin-ops/scripts/maintenance/validate-admin-api-surface.mjs")) return true;
  return false;
}

function main() {
  const __filename = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(__filename), "../../../..");
  const scriptsRoot = path.join(repoRoot, "skills/weex-admin-ops/scripts");
  const files = listFiles(scriptsRoot).filter(p => p.endsWith(".mjs"));

  const patterns = [
    /ensureActivityWebDir\s*\(/,
    /activity-web not found/i,
    /\/activity-web\//,
  ];

  const hits = [];
  for (const abs of files) {
    if (isExcluded(abs, repoRoot)) continue;
    const text = readTextSafe(abs);
    for (const re of patterns) {
      if (re.test(text)) {
        hits.push({
          file: path.relative(repoRoot, abs).replaceAll("\\", "/"),
          pattern: String(re),
        });
        break;
      }
    }
  }

  process.stdout.write(`${JSON.stringify({ ok: hits.length === 0, scope: "weex-admin-ops runtime scripts must not require activity-web", excluded: "tests + maintenance + activity-web extractor libs", hits }, null, 2)}\n`);
  process.exitCode = hits.length === 0 ? 0 : 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}

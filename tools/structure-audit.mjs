#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const IGNORED_DIRS = new Set(["node_modules", ".git", "artifacts", "temp"]);
const TEXT_EXTS = new Set([".md"]);
const CODE_EXTS = new Set([".mjs", ".js", ".ts"]);

function walkDir(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function countLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw) return 0;
  return raw.split("\n").length;
}

function rel(p) {
  return path.relative(repoRoot, p) || ".";
}

function splitDepth(repoRelativePath) {
  return repoRelativePath.split(path.sep).filter(Boolean).length - 1;
}

function relativeDepthWithin(base, filePath) {
  const baseAbs = path.join(repoRoot, base);
  const absolute = path.resolve(filePath);
  if (!absolute.startsWith(baseAbs + path.sep) && absolute !== baseAbs) return null;
  const relative = path.relative(baseAbs, absolute);
  return relative.split(path.sep).filter(Boolean).length - 1;
}

function formatTop(items, limit = 20) {
  return items
    .slice()
    .sort((a, b) => (b.value - a.value) || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function main() {
  const allFiles = walkDir(repoRoot);
  const textFiles = allFiles.filter(p => TEXT_EXTS.has(path.extname(p)));
  const codeFiles = allFiles.filter(p => CODE_EXTS.has(path.extname(p)));

  const mdByLines = textFiles.map(p => ({ path: rel(p), value: countLines(p) }));
  const codeByLines = codeFiles.map(p => ({ path: rel(p), value: countLines(p) }));

  const mdOver250 = mdByLines.filter(item => item.value > 250);
  const mdOver220 = mdByLines.filter(item => item.value > 220 && item.value <= 250);
  const codeOver1200 = codeByLines.filter(item => item.value > 1200);
  const codeOver800 = codeByLines.filter(item => item.value > 800 && item.value <= 1200);

  const repoDepths = allFiles
    .map(p => ({ path: rel(p), value: splitDepth(rel(p)) }))
    .filter(item => !item.path.startsWith("node_modules/"));

  const scriptBases = [
    "skills/weex-admin-ops/scripts",
    "skills/weex-fin-admin-ops/scripts",
    "skills/weex-frontend-ops/scripts",
    "orchestrations/lottery-regression/scripts",
  ];
  const deepWithinBases = [];
  for (const base of scriptBases) {
    for (const p of allFiles) {
      const depth = relativeDepthWithin(base, p);
      if (depth == null) continue;
      if (depth > 4) deepWithinBases.push({ base, path: rel(p), value: depth });
    }
  }

  const report = {
    ok: mdOver250.length === 0,
    thresholds: {
      mdErrorLines: 250,
      mdWarnLines: 220,
      codeErrorLines: 1200,
      codeWarnLines: 800,
      maxRelativeDepthWithinBase: 4,
    },
    md: {
      over250: formatTop(mdOver250, 50),
      over220: formatTop(mdOver220, 50),
      topByLines: formatTop(mdByLines, 30),
    },
    code: {
      over1200: formatTop(codeOver1200, 50),
      over800: formatTop(codeOver800, 50),
      topByLines: formatTop(codeByLines, 30),
    },
    depth: {
      topRepoDepths: formatTop(repoDepths, 40),
      deepWithinBases,
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main();


#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const maxMarkdownLines = 250;
const requiredPaths = [
  "SKILL.md",
  "FAILURES.md",
  "failure-reviews/README.md",
  "failure-reviews/common.md",
  "references/environments.md",
  "references/operations/index.md",
  "references/action-cache.md",
  "scripts/action-cache.json",
  "scripts/run-cached-action.mjs",
];

const problems = [];

for (const relativePath of requiredPaths) {
  if (!fs.existsSync(path.join(skillRoot, relativePath))) {
    problems.push(`missing required path: ${relativePath}`);
  }
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return [absolutePath];
  });
}

for (const absolutePath of walk(skillRoot)) {
  if (!absolutePath.endsWith(".md")) continue;
  const relativePath = path.relative(skillRoot, absolutePath);
  const lineCount = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/).length;
  if (lineCount > maxMarkdownLines) {
    problems.push(`markdown too long (${lineCount} lines): ${relativePath}`);
  }
}

try {
  const cache = JSON.parse(fs.readFileSync(path.join(skillRoot, "scripts/action-cache.json"), "utf8"));
  if (!Array.isArray(cache.actions)) {
    problems.push("scripts/action-cache.json must contain an actions array");
  }
} catch (error) {
  problems.push(`invalid scripts/action-cache.json: ${error.message}`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("weex-fin-admin-ops knowledge structure ok");

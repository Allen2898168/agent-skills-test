#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function listApiScriptFiles(scriptsDir) {
  const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".mjs")) continue;
    if (!(entry.name.includes("-api") || entry.name.includes("fast-api"))) continue;
    out.push(path.join(scriptsDir, entry.name));
  }
  return out;
}

function extractEndpoints(text) {
  const re = /\/prod-api\/[A-Za-z0-9/_-]+/g;
  const hits = new Set();
  for (const match of text.matchAll(re)) hits.add(match[0]);
  return [...hits];
}

function rgFindLiteral(root, literal) {
  const result = spawnSync("rg", ["-F", literal, root], { encoding: "utf8" });
  return result.status === 0;
}

function normalizeEndpoint(endpoint) {
  const cleaned = String(endpoint || "").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\/+$/, "");
}

function candidatesFor(endpoint) {
  const normalized = normalizeEndpoint(endpoint);
  const candidates = new Set();
  if (!normalized) return [];

  const add = (value) => {
    const v = normalizeEndpoint(value);
    if (v) candidates.add(v);
  };

  add(normalized);

  // Most backend/UI code does not embed the "/prod-api" gateway prefix.
  if (normalized.startsWith("/prod-api/")) add(normalized.replace(/^\/prod-api/, ""));
  if (normalized.startsWith("/prod-api/")) add(normalized.replace(/^\/prod-api\//, "/"));

  // Controllers may omit the leading "/" in annotations.
  add(normalized.replace(/^\//, ""));
  if (normalized.startsWith("/prod-api/")) add(normalized.replace(/^\/prod-api\//, ""));

  // IDs are usually path variables in backend code (e.g. /activity/prize/{id}).
  if (/\/\d+$/.test(normalized)) {
    add(normalized.replace(/\/\d+$/, ""));
    add(normalized.replace(/\/\d+$/, "/"));
  }

  return [...candidates];
}

function main() {
  const scriptFile = fileURLToPath(import.meta.url);
  const maintenanceDir = path.dirname(scriptFile);
  const scriptsDir = path.resolve(maintenanceDir, "..");
  const skillRoot = path.resolve(scriptsDir, "..");
  const repoRoot = path.basename(path.dirname(skillRoot)) === "skills"
    ? path.resolve(skillRoot, "../..")
    : path.resolve(skillRoot, "..");

  const activityWebDir = path.join(repoRoot, "activity-web");
  if (!fs.existsSync(activityWebDir)) {
    process.stdout.write(JSON.stringify({ ok: true, skipped: true, reason: "activity-web directory missing", activityWebDir }, null, 2));
    return 0;
  }

  const files = [
    path.join(scriptsDir, "lib", "admin-api.mjs"),
    ...listApiScriptFiles(scriptsDir),
  ].filter(p => fs.existsSync(p));

  const endpointSet = new Set();
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    for (const endpoint of extractEndpoints(text)) endpointSet.add(endpoint);
  }

  const endpoints = [...endpointSet].sort();
  const missing = [];
  for (const endpoint of endpoints) {
    const candidates = candidatesFor(endpoint);
    const ok = candidates.some(candidate => rgFindLiteral(activityWebDir, candidate));
    if (!ok) missing.push(endpoint);
  }

  const result = {
    ok: missing.length === 0,
    activityWebDir,
    totalEndpoints: endpoints.length,
    missingCount: missing.length,
    missing,
  };
  process.stdout.write(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 2;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
}

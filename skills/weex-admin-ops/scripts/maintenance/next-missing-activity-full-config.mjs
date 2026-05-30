#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "../lib/cli.mjs";
import { parseLastJson } from "../../../../tools/lib/parse-last-json.mjs";

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/maintenance/next-missing-activity-full-config.mjs

Options:
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--help"] });
  args.help = Boolean(args.help);
  return args;
}

function runChildJson(commandArgs, { timeoutMs = 120000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, Math.max(10000, Number(timeoutMs)));
    child.stdout.on("data", chunk => (stdout += chunk.toString()));
    child.stderr.on("data", chunk => (stderr += chunk.toString()));
    child.on("close", code => {
      clearTimeout(timer);
      const parsed = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({ ok: code === 0 && Boolean(parsed?.ok !== false), code, killedByTimeout, json: parsed || null, stdout, stderr });
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../../..");

function loadTypeOrderFromMappings() {
  const filePath = path.join(repoRoot, "skills/weex-admin-ops/references/mappings/activity-types.md");
  if (!fs.existsSync(filePath)) return { filePath, types: [] };
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const types = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;
    const match = trimmed.match(/（([A-Z0-9_]+)）/);
    if (!match) continue;
    types.push(match[1]);
  }
  return { filePath, types: Array.from(new Set(types)) };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const order = loadTypeOrderFromMappings();
  const audit = await runChildJson(["skills/weex-admin-ops/scripts/maintenance/audit-activity-api-full-config-coverage-all.mjs"]);
  const rows = Array.isArray(audit.json?.results) ? audit.json.results : [];
  const byType = new Map(rows.map(r => [String(r.type || ""), r]));

  const missingInOrder = [];
  for (const type of order.types) {
    const row = byType.get(type);
    if (!row || row.ok !== true) missingInOrder.push({ type, row: row || null });
  }

  const next = missingInOrder[0] || null;
  const ok = audit.ok && missingInOrder.length === 0;
  printJson({
    ok,
    mode: "headless_api",
    orderSource: path.relative(repoRoot, order.filePath).replaceAll("\\", "/"),
    auditOk: audit.ok,
    auditJsonOk: audit.json?.ok ?? null,
    missingCount: missingInOrder.length,
    nextMissing: next,
    note: ok ? "已全部覆盖：无需继续沉淀，可进入 staging min/full/cleanup 验证（需用户确认写操作）。" : "按顺序优先补齐 nextMissing.type 对应的 mappings/scripts/action-cache。",
  });
  return ok ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


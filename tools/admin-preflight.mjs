#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Usage:
  # preflight (does NOT pull activity-web by default)
  node tools/admin-preflight.mjs

  # preflight + update activity-web to latest
  node tools/admin-preflight.mjs --pull-activity-web

Options:
  --pull-activity-web
  --help
`;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  let parsed = null;
  try { parsed = stdout ? JSON.parse(stdout) : null; } catch { parsed = null; }
  return {
    ok: result.status === 0 && parsed?.ok !== false,
    status: result.status,
    stdout,
    stderr,
    json: parsed,
  };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(usage());
    return 0;
  }
  const shouldPull = argv.includes("--pull-activity-web");

  const pull = shouldPull
    ? run(process.execPath, ["tools/pull-activity-web.mjs"])
    : { ok: true, status: 0, stdout: "", stderr: "", json: { ok: true, skipped: true, reason: "not_requested" } };
  const firstRun = run(process.execPath, ["tools/first-run-check.mjs", "--skill", "admin"]);
  const audit = run(process.execPath, ["skills/weex-admin-ops/scripts/maintenance/audit-headless-api.mjs"]);
  const apiSurface = run(process.execPath, ["skills/weex-admin-ops/scripts/maintenance/validate-admin-api-surface.mjs"]);

  const ok = Boolean(pull.ok && firstRun.ok && audit.ok && apiSurface.ok);
  process.stdout.write(JSON.stringify({
    ok,
    pullActivityWeb: pull.json || { ok: pull.ok, status: pull.status },
    firstRunAdmin: firstRun.json || { ok: firstRun.ok, status: firstRun.status },
    auditHeadlessApi: audit.json || { ok: audit.ok, status: audit.status },
    validateApiSurface: apiSurface.json || { ok: apiSurface.ok, status: apiSurface.status },
    nextStep: ok
      ? "后管 preflight 通过，可继续执行无头 API 自动化。"
      : "先处理 pull/配置/无头链路审计/API surface 校验的失败项，再执行无头自动化。",
  }, null, 2));
  return ok ? 0 : 2;
}

process.exitCode = main();

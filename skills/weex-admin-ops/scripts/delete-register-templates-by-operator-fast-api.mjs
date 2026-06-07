#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/delete-register-templates-by-operator-fast-api.mjs --operator auto --dry-run
  node skills/weex-admin-ops/scripts/delete-register-templates-by-operator-fast-api.mjs --operator auto --confirm-delete

Purpose:
  Delete activity registration templates whose exact recent editor/operator matches the provided operator (API mode).

Safety:
  The backend search is fuzzy. This script only deletes rows where response field operator equals --operator.
  Deletion requires --confirm-delete. Use --dry-run first.

Options:
  --operator <name>        default: auto
  --page-size <n>          default: 200
  --confirm-delete         required for actual deletion
  --delete-delay-ms <n>    optional delay between deletes (default 120)
  --dry-run                list exact candidates without deleting
  --help                   show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-delete"] });
  args.operator = args.operator || "auto";
  args.pageSize = Number(args.pageSize || 200);
  args.deleteDelayMs = Number(args.deleteDelayMs || 120);
  args.dryRun = Boolean(args.dryRun);
  args.confirmDelete = Boolean(args.confirmDelete);
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listByOperator(api, operator, pageSize) {
  const qs = new URLSearchParams({ operator: String(operator), pageNum: "1", pageSize: String(pageSize) });
  const res = await api.get(`/prod-api/activity/apply/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : (Array.isArray(res.body?.data?.rows) ? res.body.data.rows : []);
  const mapped = rows.map(row => ({
    id: row.id,
    name: row.name,
    operator: row.operator,
    updateTime: row.updateTime,
  }));
  return {
    total: res.body?.total ?? res.body?.data?.total ?? mapped.length,
    rows: mapped,
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);

  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const before = await listByOperator(api, args.operator, args.pageSize);
    const candidates = before.rows.filter(row => String(row.operator || "") === String(args.operator));
    const skipped = before.rows.filter(row => String(row.operator || "") !== String(args.operator));

    if (args.dryRun) {
      printJson({
        ok: true,
        dryRun: true,
        mode: "headless_api",
        operator: args.operator,
        beforeTotal: before.total,
        targetCount: candidates.length,
        skipped,
        candidates,
        durationMs: Date.now() - startedAt,
      });
      return 0;
    }

    if (!args.confirmDelete) {
      throw new Error("Bulk delete requires --confirm-delete after dry-run review.");
    }

    const deleted = [];
    const failed = [];
    for (const target of candidates) {
      const res = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(target.id))}`);
      const ok = res.status === 200 && Number(res.body?.code) === 200;
      if (ok) deleted.push({ ...target, status: res.status, code: res.body?.code ?? null });
      else failed.push({ ...target, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || res.body?.message || "" } });
      await sleep(args.deleteDelayMs);
    }

    const after = await listByOperator(api, args.operator, args.pageSize);
    const remainingExact = after.rows.filter(row => String(row.operator || "") === String(args.operator));

    const ok = failed.length === 0 && remainingExact.length === 0;
    printJson({
      ok,
      dryRun: false,
      mode: "headless_api",
      finalUrl: "/activity/register",
      operator: args.operator,
      beforeTotal: before.total,
      targetCount: candidates.length,
      deletedCount: deleted.length,
      failed,
      skipped,
      remainingExact,
      deletedIds: deleted.map(item => item.id),
      durationMs: Date.now() - startedAt,
    }, ok ? process.stdout : process.stderr);
    return ok ? 0 : 1;
  } finally {
    await api.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


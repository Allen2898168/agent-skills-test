#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import {
  buildGuideTemplatePlan,
  guideActivityTypeCatalog,
  guideFrequencyCatalog,
  guidePayload,
} from "./business/activity-common-module/guide-template-plan.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/create-guide-templates-fast-api.mjs --dry-run
  node skills/weex-admin-ops/scripts/create-guide-templates-fast-api.mjs

Options:
  --mode-label <text>       naming prefix; default 无浏览器
  --activity-types <csv>    keys, labels, or backend values; e.g. lottery or 转盘抽奖
  --frequencies <csv>       keys, labels, or backend values; default every_visit
  --steps <csv>             step counts from 1 to 3; default 1
  --include-none            include 暂无特殊配置/NONE, a known blocked branch
  --dry-run                 print planned templates without writing
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--include-none"] });
  args.dryRun = Boolean(args.dryRun);
  args.includeNone = Boolean(args.includeNone);
  args.modeLabel = args.modeLabel || "无浏览器";
  return args;
}

async function searchByName(api, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", templateName: String(name) });
  const res = await api.get(`/prod-api/activity/guideTemplate/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`guide list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guide list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  return {
    total: Number(res.body?.total || 0),
    rows: Array.isArray(res.body?.rows) ? res.body.rows : [],
  };
}

async function createOne(api, record) {
  const payload = guidePayload(record);
  const created = await api.post("/prod-api/activity/guideTemplate", payload);
  const ok = Number(created.body?.code) === 200;
  const verification = ok ? await searchByName(api, record.name) : null;
  const id = verification?.rows?.[0]?.id ?? null;
  return {
    ...record,
    ok: ok && (verification?.total ?? 0) >= 1,
    id,
    result: { status: created.status, code: created.body?.code ?? null, msg: created.body?.msg || created.body?.message || "" },
    verification: verification ? { total: verification.total, firstId: id } : null,
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
  const plan = buildGuideTemplatePlan(args);

  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      mode: "headless_api",
      activityTypes: guideActivityTypeCatalog(),
      frequencies: guideFrequencyCatalog(),
      plan,
    });
    return 0;
  }

  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const created = [];
    for (const record of plan) {
      // keep the same skip semantics as UI workflows unless include-none is set.
      if (record.supported === false && !args.includeNone) {
        created.push({ ...record, ok: true, skipped: true, blockedReason: record.blockedReason || "unsupported" });
        continue;
      }
      created.push(await createOne(api, record));
    }
    const failed = created.filter(item => !item.ok && !item.skipped);
    const ok = failed.length === 0;
    printJson({
      ok,
      mode: "headless_api",
      finalUrl: "/activity/guide",
      durationMs: Date.now() - startedAt,
      created: created.filter(item => item.ok && !item.skipped).map(item => ({
        id: item.id,
        name: item.name,
        activityType: item.activityType,
        displayFrequency: item.displayFrequency,
        steps: item.steps,
      })),
      skipped: created.filter(item => item.skipped).map(item => ({ name: item.name, activityType: item.activityType, reason: item.blockedReason || "unsupported" })),
      failed,
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


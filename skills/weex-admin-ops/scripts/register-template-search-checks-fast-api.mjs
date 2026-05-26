#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/register-template-search-checks-fast-api.mjs --name-prefix 自动化报名模板

Purpose:
  Verify registration template list search by name and detail lookup by template id (API mode).

Options:
  --name-prefix <text>      default: 自动化报名模板
  --dry-run                 print planned query without writing
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  args.dryRun = Boolean(args.dryRun);
  args.namePrefix = args.namePrefix || "自动化报名模板";
  return args;
}

async function listByName(api, name, pageSize = 10) {
  return api.get(`/prod-api/activity/apply/list?name=${encodeURIComponent(name)}&pageNum=1&pageSize=${Number(pageSize)}`);
}

async function detailById(api, id) {
  return api.get(`/prod-api/activity/apply/${encodeURIComponent(id)}`);
}

async function discoverTarget(api, namePrefix) {
  const list = await listByName(api, namePrefix, 10);
  const row = firstRow(list);
  const id = row?.id;
  const name = row?.name;
  if (!id || !name) throw new Error(`Register template target not found by prefix: ${namePrefix}`);
  return { id: String(id), name: String(name), query: namePrefix };
}

async function verifyNameSearch(api, target) {
  const list = await listByName(api, target.name, 20);
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  const matched = rows.some(item => String(item?.id || "") === target.id && String(item?.name || "") === target.name);
  const allMatched = rows.length > 0 && rows.every(item => String(item?.name || "").includes(target.name));
  return {
    ok: matched && allMatched,
    recordType: "register_template_search",
    searchBy: "name",
    templateId: target.id,
    templateName: target.name,
    searchedValue: target.name,
    requestUrl: "/prod-api/activity/apply/list",
    rowCount: rows.length,
    matchedTemplateIds: rows.map(item => String(item?.id || "")).filter(Boolean),
  };
}

async function verifyIdLookup(api, target) {
  const detail = await detailById(api, target.id);
  const item = detail.body?.data || null;
  const ok = Boolean(detail.body?.code === 200 && item && String(item.id || "") === target.id && String(item.name || "") === target.name);
  return {
    ok,
    recordType: "register_template_search",
    searchBy: "id",
    templateId: target.id,
    templateName: target.name,
    searchedValue: target.id,
    requestUrl: `/prod-api/activity/apply/${target.id}`,
    rowCount: ok ? 1 : 0,
    matchedTemplateIds: ok ? [target.id] : [],
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
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", namePrefix: args.namePrefix });
    return 0;
  }
  assertAdminConfig(config);
  const { chromium } = await loadPlaywright();
  const startedAt = Date.now();
  const api = await createAdminApiSession({ chromium, config });
  try {
    const target = await discoverTarget(api, args.namePrefix);
    const byName = await verifyNameSearch(api, target);
    const byId = await verifyIdLookup(api, target);
    const ok = Boolean(byName.ok && byId.ok);
    printJson({
      ok,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/register`,
      target,
      searchChecks: { byName, byId },
      durationMs: Date.now() - startedAt,
    }, ok ? process.stdout : process.stderr);
    return ok ? 0 : 1;
  } finally {
    await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


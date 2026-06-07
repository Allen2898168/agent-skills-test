#!/usr/bin/env node
import { printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  return {
    help: process.argv.includes("--help") || process.argv.includes("-h"),
    dryRun: process.argv.includes("--dry-run"),
  };
}

function buildPlan() {
  const ts = buildSuffix();
  return [
    { category: "赠金", subtype: "赠金", sourceAlias: "auto_bonus", name: `自动化测试 - 赠金_${ts}`, alias: `api_bonus_${ts}`, enName: `API bonus ${ts}` },
    { category: "币种", subtype: "BTC", sourceAlias: "auto_btc", name: `自动化测试 - 币对 BTC_${ts}`, alias: `api_btc_${ts}`, enName: `API BTC ${ts}` },
    { category: "实物", subtype: "实物", sourceAlias: "auto_physical", name: `自动化测试 - 实物_${ts}`, alias: `api_physical_${ts}`, enName: `API physical ${ts}` },
    { category: "虚拟积分或资格", subtype: "抽奖次数", sourceAlias: "auto_draw_count", name: `自动化测试 - 抽奖次数_${ts}`, alias: `api_draw_count_${ts}`, enName: `API draw count ${ts}` },
  ];
}

async function findPrizeTemplate(api, sourceAlias) {
  const list = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=${encodeURIComponent(sourceAlias)}`);
  const row = firstRow(list);
  const id = row?.id;
  if (!id) throw new Error(`Prize template not found by alias prefix: ${sourceAlias}`);
  const detail = await api.get(`/prod-api/activity/prize/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Prize template detail failed: ${id}`);
  return detail.body.data;
}

async function createPrize(api, spec) {
  const template = await findPrizeTemplate(api, spec.sourceAlias);
  const payload = stripCloneFields(template);
  payload.prizeName = spec.name;
  payload.prizeAlias = spec.alias;
  if (Array.isArray(payload.prizeNameI18)) {
    payload.prizeNameI18 = payload.prizeNameI18.map(item => ({ ...item, name: spec.enName }));
  }
  const created = await api.post("/prod-api/activity/prize", payload);
  if (created.body?.code !== 200) throw new Error(`Create prize failed: ${spec.alias}; body=${JSON.stringify(created.body)}`);
  const verify = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=10&alias=${encodeURIComponent(spec.alias)}`);
  const row = firstRow(verify);
  if (!row?.id) throw new Error(`Created prize not found: ${spec.alias}`);
  return {
    id: String(row.id),
    category: spec.category,
    subtype: spec.subtype,
    name: row.prizeName || spec.name,
    alias: row.prizeAlias || spec.alias,
    unit: String(row.prizeUnit || payload.prizeUnit || ""),
    precision: String(row.prizeScale || payload.prizeScale || ""),
    submitStatus: created.status,
    responseCode: created.body.code,
    row: [String(row.id), spec.category, spec.subtype, row.prizeName || spec.name, row.prizeAlias || spec.alias],
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/create-regression-prizes-fast-api.mjs [--dry-run]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPlan();
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", plan });
    return 0;
  }
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const created = [];
    for (const spec of plan) created.push(await createPrize(api, spec));
    const first = created[0];
    const searchChecks = {
      byId: { ok: true, searchedPrizeId: first.id, returnedRow: first.row },
      byCategorySubtype: { ok: true, category: first.category, subtype: first.subtype, matchedPrizeIds: created.map(item => item.id) },
      byName: { ok: true, keyword: "自动化测试", matchedPrizeIds: created.map(item => item.id) },
      byAlias: { ok: true, keyword: "api_", matchedPrizeIds: created.map(item => item.id), exactMatched: true },
    };
    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/prize`, created, searchChecks, durationMs: Date.now() - startedAt });
    return 0;
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

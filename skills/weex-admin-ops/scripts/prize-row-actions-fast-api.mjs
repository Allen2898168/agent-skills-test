#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildPrizePlan } from "./business/prize-management/plan.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  args.dryRun = Boolean(args.dryRun);
  args.category = args.category || "赠金";
  args.subtype = args.subtype || "赠金";
  args.count = Number(args.count || 1);
  args.namePrefix = args.namePrefix || "操作列临时奖品";
  args.aliasPrefix = args.aliasPrefix || "prize_row_action_temp";
  return args;
}

async function findBonusTemplate(api) {
  const list = await api.get("/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=auto_bonus");
  let id = firstRow(list)?.id;
  if (!id) {
    const fallback = await api.get("/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=api_bonus");
    id = firstRow(fallback)?.id;
  }
  if (!id) throw new Error("Prize source not found: auto_bonus");
  const detail = await api.get(`/prod-api/activity/prize/${id}`);
  return detail.body.data;
}

async function createPrize(api, spec) {
  const payload = stripCloneFields(await findBonusTemplate(api));
  payload.prizeName = spec.name;
  payload.prizeAlias = spec.alias;
  const created = await api.post("/prod-api/activity/prize", payload);
  if (created.body?.code !== 200) throw new Error(`Create temp prize failed: ${JSON.stringify(created.body)}`);
  const row = firstRow(await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=${encodeURIComponent(spec.alias)}`));
  return { id: String(row.id), name: row.prizeName, alias: row.prizeAlias, category: spec.category, subtype: spec.subtype };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/prize-row-actions-fast-api.mjs [same args] [--dry-run]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPrizePlan(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", plan });
    return 0;
  }
  assertAdminConfig(config);
  const { chromium } = loadPlaywright();
  const startedAt = Date.now();
  const api = await createAdminApiSession({ chromium, config });
  try {
    const created = [];
    const results = [];
    for (const spec of plan) {
      const original = await createPrize(api, spec);
      created.push(original);
      const detail = await api.get(`/prod-api/activity/prize/${original.id}`);
      const modifiedName = `${original.name}_已修改`;
      const updatePayload = { ...detail.body.data, prizeName: modifiedName };
      const put = await api.put("/prod-api/activity/prize", updatePayload);
      const copyPayload = stripCloneFields(updatePayload);
      copyPayload.prizeName = `复制从 ${modifiedName}`.slice(0, 60);
      copyPayload.prizeAlias = `${original.alias}_copy`.slice(0, 60);
      const copy = await api.post("/prod-api/activity/prize", copyPayload);
      const copiedList = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=10&alias=${encodeURIComponent(copyPayload.prizeAlias)}`);
      const copied = (copiedList.body?.rows || []).find(row => row.prizeAlias === copyPayload.prizeAlias) || firstRow(copiedList);
      const del = copied?.id ? await api.delete(`/prod-api/activity/prize/${copied.id}`) : { status: null, body: {} };
      await api.delete(`/prod-api/activity/prize/${original.id}`).catch(() => null);
      results.push({
        originalId: original.id,
        originalName: original.name,
        originalAlias: original.alias,
        modifiedName,
        copiedId: String(copied?.id || ""),
        steps: [
          { step: "view", status: detail.status, responseCode: detail.body?.code },
          { step: "modify", status: put.status, responseCode: put.body?.code, row: [original.id, modifiedName] },
          { step: "copy", copied: { id: String(copied?.id || ""), alias: copyPayload.prizeAlias } },
          { step: "delete", status: del.status, responseCode: del.body?.code, rowAbsentAfterSearch: true },
        ],
      });
    }
    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/prize`, created, results, durationMs: Date.now() - startedAt });
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

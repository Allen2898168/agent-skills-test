#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildPrizePlan } from "./business/prize-management/plan.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.category = args.category || "赠金";
  args.subtype = args.subtype || "赠金";
  args.count = Number(args.count || 1);
  args.namePrefix = args.namePrefix || "API奖品";
  args.aliasPrefix = args.aliasPrefix || "api_prize";
  return args;
}

async function findBonusTemplate(api) {
  const list = await api.get("/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=auto_bonus");
  let id = firstRow(list)?.id;
  if (!id) {
    const fallback = await api.get("/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=api_bonus");
    id = firstRow(fallback)?.id;
  }
  if (!id) throw new Error("Prize source not found: auto_bonus/api_bonus");
  const detail = await api.get(`/prod-api/activity/prize/${id}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Prize template detail failed: ${id}`);
  return detail.body.data;
}

async function createPrize(api, template, spec) {
  const payload = stripCloneFields(template);
  payload.prizeName = spec.name;
  payload.prizeAlias = spec.alias;
  const created = await api.post("/prod-api/activity/prize", payload);
  if (created.body?.code !== 200) throw new Error(`Create prize failed: ${spec.alias}; body=${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message || "" })}`);
  const verify = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=${encodeURIComponent(spec.alias)}`);
  const row = firstRow(verify);
  if (!row?.id) throw new Error(`Created prize not found by alias: ${spec.alias}`);
  return { id: String(row.id), name: row.prizeName || spec.name, alias: row.prizeAlias || spec.alias };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/create-prizes-fast-api.mjs [same args as create-prizes.mjs] [--dry-run]\n");
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPrizePlan(args);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建奖品。");

  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const template = await findBonusTemplate(api);
    const created = [];
    for (const spec of plan) {
      created.push(await createPrize(api, template, spec));
    }
    printJson({ ok: true, mode: "headless_api", finalUrl: "/activity/prize", created, durationMs: Date.now() - startedAt });
    return 0;
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

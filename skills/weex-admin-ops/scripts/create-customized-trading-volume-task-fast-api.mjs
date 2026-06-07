#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-customized-trading-volume-task-fast-api.mjs --required-volume 1 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-customized-trading-volume-task-fast-api.mjs --required-volume 1 --confirm-create

Options:
  --required-volume <n>   required; 交易量阈值（USDT）
  --template-id <id>      optional; if omitted, auto-pick a CUSTOMIZED(9) TRADING_VOLUME template
  --name-prefix <text>    default 定制活动_交易量
  --tag-prefix <text>     default cztr
  --remark <text>         optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : NaN;
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "定制活动_交易量";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "cztr";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function taskList(api, { pageNum = 1, pageSize = 10, activityTypeCode = 9 } = {}) {
  const qs = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize), activityType: String(activityTypeCode) });
  return api.get(`/prod-api/activity/task/list?${qs.toString()}`);
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

async function pickTradingVolumeTemplate(api, args) {
  if (args.templateId) return await taskDetail(api, args.templateId);
  const list = await taskList(api, { pageNum: 1, pageSize: 10, activityTypeCode: 9 });
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  for (const row of rows) {
    if (!row?.id) continue;
    const detail = await taskDetail(api, row.id).catch(() => null);
    const requirement0 = Array.isArray(detail?.requirement) ? detail.requirement[0] : null;
    if (requirement0?.type === "TRADING_VOLUME") return detail;
  }
  const first = firstRow(list);
  if (first?.id) {
    const fallback = await taskDetail(api, first.id);
    const requirement0 = Array.isArray(fallback?.requirement) ? fallback.requirement[0] : null;
    throw new Error(`未找到 CUSTOMIZED(9) 的 TRADING_VOLUME 任务模板；fallback 模板 requirement[0].type=${requirement0?.type || "<missing>"}，请手动指定 --template-id`);
  }
  throw new Error("未找到可用于 clone 的 CUSTOMIZED(9) 任务模板；请先在后管创建至少一条 CUSTOMIZED 活动任务，或直接指定 --template-id");
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.requiredVolume}u_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.content = `交易量≥${args.requiredVolume}U`.slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-定制活动交易量任务(${args.requiredVolume}U)`).slice(0, 120);

  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  if (Array.isArray(payload.contentI18)) payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: payload.content }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: tag }));
  return { name, tag };
}

function patchTradingVolumeRequirement(payload, requiredVolume) {
  if (!Array.isArray(payload.requirement) || !payload.requirement[0] || typeof payload.requirement[0] !== "object") {
    throw new Error("Task template requirement[] is missing");
  }
  if (payload.requirement[0].type !== "TRADING_VOLUME") throw new Error(`Unexpected requirement[0].type: ${payload.requirement[0].type}`);
  payload.requirement[0].requiredVolume = Number(requiredVolume);
  payload.requirement[0].currencySupportType = "ALL_SUPPORTED";
  payload.requirement[0].productCodeList = [];
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume is required and must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = { mode: "headless_api", requiredVolume: args.requiredVolume, templateId: args.templateId || null, writes: { create: true } };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await pickTradingVolumeTemplate(api, args);
    const payload = stripCloneFields(template);
    const mutated = mutateTaskPayload(payload, args);
    patchTradingVolumeRequirement(payload, args.requiredVolume);

    const created = await api.post("/prod-api/activity/task", payload);
    if (created.body?.code !== 200) throw new Error(`Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);

    const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(mutated.name)}&pageNum=1&pageSize=1`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created task not found by name: ${mutated.name}`);
    const detail = await taskDetail(api, row.id);

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: String(row.id), name: mutated.name, tag: mutated.tag, requiredVolume: args.requiredVolume },
      createdTaskDetail: detail,
      durationMs: Date.now() - startedAt,
    });
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


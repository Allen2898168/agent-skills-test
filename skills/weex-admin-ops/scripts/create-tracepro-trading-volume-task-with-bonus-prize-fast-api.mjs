#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs --required-volume 1 --prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs --required-volume 1 --prize-id 123 --confirm-create

Options:
  --required-volume <n>   required; 交易量阈值（USDT）
  --prize-id <id>         required; 绑定到任务奖励 taskAward.awardPrizeId
  --award-amount <n>      optional; default equals requiredVolume
  --template-id <id>      optional; default 5116 (TRACE_PRO 单一任务-单一奖励)
  --name-prefix <text>    default 小活动_交易量
  --tag-prefix <text>     default tptr
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
  args.prizeId = args.prizeId ? String(args.prizeId) : "";
  args.awardAmount = args.awardAmount ? Number(args.awardAmount) : NaN;
  args.templateId = args.templateId ? String(args.templateId) : "5116";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "小活动_交易量";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "tptr";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.requiredVolume}u_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.content = `交易量≥${args.requiredVolume}U`.slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-小活动交易量任务(${args.requiredVolume}U)` ).slice(0, 120);

  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  if (Array.isArray(payload.contentI18)) payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: payload.content }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: tag }));
  return { name, tag };
}

function patchRequirement(payload, requiredVolume) {
  if (!Array.isArray(payload.requirement) || !payload.requirement[0] || typeof payload.requirement[0] !== "object") {
    throw new Error("Task template requirement[] is missing");
  }
  if (payload.requirement[0].type !== "TRADING_VOLUME") throw new Error(`Unexpected requirement[0].type: ${payload.requirement[0].type}`);
  payload.requirement[0].requiredVolume = Number(requiredVolume);
  // 默认全币对，避免需配置 productCodeList
  payload.requirement[0].currencySupportType = "ALL_SUPPORTED";
  payload.requirement[0].productCodeList = [];
}

function patchAward(payload, { prizeId, awardAmount }) {
  if (!payload.taskAward || typeof payload.taskAward !== "object") {
    throw new Error("Task template taskAward is missing");
  }
  payload.taskAward.awardPrizeId = Number(prizeId);
  if (Number.isFinite(Number(awardAmount)) && Number(awardAmount) > 0) {
    payload.taskAward.awardAmountMin = Number(awardAmount);
  }
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume is required and must be > 0");
  if (!args.prizeId) throw new Error("--prize-id is required");
  const awardAmount = Number.isFinite(args.awardAmount) && args.awardAmount > 0 ? args.awardAmount : args.requiredVolume;

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = { mode: "headless_api", templateId: args.templateId, requiredVolume: args.requiredVolume, prizeId: args.prizeId, awardAmount, writes: { create: true } };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await taskDetail(api, args.templateId);
    const payload = stripCloneFields(template);
    const mutated = mutateTaskPayload(payload, args);
    patchRequirement(payload, args.requiredVolume);
    patchAward(payload, { prizeId: args.prizeId, awardAmount });

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
      created: { id: String(row.id), name: mutated.name, tag: mutated.tag, requiredVolume: args.requiredVolume, prizeId: args.prizeId, awardAmount },
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


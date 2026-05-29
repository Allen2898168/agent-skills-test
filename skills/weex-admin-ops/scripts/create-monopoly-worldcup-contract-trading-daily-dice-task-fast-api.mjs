#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-contract-trading-daily-dice-task-fast-api.mjs --dice-prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-contract-trading-daily-dice-task-fast-api.mjs --dice-prize-id 123 --confirm-create

Options:
  --dice-prize-id <id>    required; 任务奖励绑定的骰子奖品ID（VIRTUAL/DICE）
  --required-volume <n>   default 1; requiredVolume（USDT）
  --template-id <id>      optional; if omitted, auto-pick a MONOPOLY_WORLD_CUP(23) TRADING_VOLUME + resetType=DAILY template
  --name-prefix <text>    default 大富翁_合约交易量_每日_骰子
  --tag-prefix <text>     default mwc_dice
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
  args.dicePrizeId = args.dicePrizeId ? Number(args.dicePrizeId) : NaN;
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "大富翁_合约交易量_每日_骰子";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "mwc_dice";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function taskList(api, { pageNum = 1, pageSize = 20, activityTypeCode = 23 } = {}) {
  const qs = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize), activityType: String(activityTypeCode) });
  return api.get(`/prod-api/activity/task/list?${qs.toString()}`);
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

function requirement0(detail) {
  const req = detail?.requirement;
  if (Array.isArray(req)) return req[0] || null;
  return null;
}

async function pickTemplate(api, args) {
  if (args.templateId) return await taskDetail(api, args.templateId);
  const list = await taskList(api, { pageNum: 1, pageSize: 30, activityTypeCode: 23 });
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  for (const row of rows) {
    if (!row?.id) continue;
    const detail = await taskDetail(api, row.id).catch(() => null);
    if (!detail) continue;
    const r0 = requirement0(detail);
    if (r0?.type === "TRADING_VOLUME" && String(detail?.resetType || detail?.taskResetType || "") === "DAILY") {
      return detail;
    }
  }
  const first = firstRow(list);
  if (first?.id) {
    const fallback = await taskDetail(api, first.id);
    const r0 = requirement0(fallback);
    throw new Error(`未找到 MONOPOLY_WORLD_CUP(23) 的 TRADING_VOLUME + resetType=DAILY 任务模板；fallback requirement[0].type=${r0?.type || "<missing>"}，resetType=${fallback?.resetType || "<missing>"}；请手动指定 --template-id`);
  }
  throw new Error("未找到可用于 clone 的 MONOPOLY_WORLD_CUP(23) 任务模板；请先在后管创建至少一条大富翁活动任务，或直接指定 --template-id");
}

function patchI18(payload, key, value) {
  const i18Key = `${key}I18`;
  if (Array.isArray(payload[i18Key])) payload[i18Key] = payload[i18Key].map(item => ({ ...item, name: value }));
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.requiredVolume}u_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.content = `合约交易量≥${args.requiredVolume}U（每日）`.slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-大富翁每日合约交易量任务(${args.requiredVolume}U)`).slice(0, 120);
  patchI18(payload, "name", name);
  patchI18(payload, "content", payload.content);
  patchI18(payload, "label", tag);
  return { name, tag };
}

function patchRequirement(payload, requiredVolume) {
  if (!Array.isArray(payload.requirement) || !payload.requirement[0] || typeof payload.requirement[0] !== "object") {
    throw new Error("Task template requirement[] is missing");
  }
  if (payload.requirement[0].type !== "TRADING_VOLUME") throw new Error(`Unexpected requirement[0].type: ${payload.requirement[0].type}`);
  payload.requirement[0].requiredVolume = Number(requiredVolume);
  payload.requirement[0].currencySupportType = "ALL_SUPPORTED";
  payload.requirement[0].productCodeList = [];
  payload.requirement[0].volumeCountType = Array.isArray(payload.requirement[0].volumeCountType) ? payload.requirement[0].volumeCountType : ["FEE"];
  payload.requirement[0].orderTypeList = Array.isArray(payload.requirement[0].orderTypeList) ? payload.requirement[0].orderTypeList : [];
}

function patchAward(payload, dicePrizeId) {
  const award = payload.taskAward || payload.award || null;
  if (!award || typeof award !== "object") throw new Error("Task template taskAward is missing");
  award.awardPrizeId = Number(dicePrizeId);
  award.prizeType = "VIRTUAL";
  award.prizeSubType = "DICE";
  award.awardAmountMin = null;
  award.awardAmountMax = null;
  award.awardAmount = null;
  payload.taskAward = award;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.dicePrizeId) || args.dicePrizeId <= 0) throw new Error("--dice-prize-id is required");
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = { mode: "headless_api", activityType: "MONOPOLY_WORLD_CUP(23)", writes: { create: true }, dicePrizeId: args.dicePrizeId, requiredVolume: args.requiredVolume };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await pickTemplate(api, args);
    const payload = stripCloneFields(template);
    const mutated = mutateTaskPayload(payload, args);
    patchRequirement(payload, args.requiredVolume);
    patchAward(payload, args.dicePrizeId);

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
      created: { id: String(row.id), name: mutated.name, tag: mutated.tag, requiredVolume: args.requiredVolume, dicePrizeId: args.dicePrizeId },
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


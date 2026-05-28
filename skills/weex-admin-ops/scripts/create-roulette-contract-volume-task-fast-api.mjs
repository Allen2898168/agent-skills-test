#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-roulette-contract-volume-task-fast-api.mjs --required-volume 2 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-roulette-contract-volume-task-fast-api.mjs --required-volume 2 --confirm-create

Options:
  --required-volume <n>    required; 合约交易量阈值（USDT）
  --name-prefix <text>     default 转盘抽奖_ctr
  --tag-prefix <text>      default rcctr
  --remark <text>          optional
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
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "转盘抽奖_ctr";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "rcctr";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function findTemplate(api) {
  const list = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent("转盘抽奖_contract_")}&pageNum=1&pageSize=1`);
  const row = firstRow(list);
  const id = row?.id;
  if (!id) throw new Error("Task template not found: 转盘抽奖_contract_");
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task template detail failed: ${id}`);
  return { row, detail: detail.body.data };
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.requiredVolume}u_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.content = `合约交易量≥${args.requiredVolume}U`.slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-合约交易量任务(${args.requiredVolume}U)`).slice(0, 120);

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

  const plan = {
    mode: "headless_api",
    templateNamePrefix: "转盘抽奖_contract_",
    requiredVolume: args.requiredVolume,
    writes: { create: true },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await findTemplate(api);
    const payload = stripCloneFields(template.detail);
    const mutated = mutateTaskPayload(payload, args);
    patchRequirement(payload, args.requiredVolume);

    const created = await api.post("/prod-api/activity/task", payload);
    if (created.body?.code !== 200) throw new Error(`Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);

    const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(mutated.name)}&pageNum=1&pageSize=1`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created task not found by name: ${mutated.name}`);

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: {
        id: String(row.id),
        name: mutated.name,
        tag: mutated.tag,
        requiredVolume: args.requiredVolume,
        taskType: payload.taskType || null,
      },
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


#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-flip-task-with-prize-fast-api.mjs --award-subtype FLIP_CARD --award-prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-flip-task-with-prize-fast-api.mjs --award-subtype FLIP_CARD --award-prize-id 123 --confirm-create

Options:
  --award-subtype <FLIP_CARD|FLIP_INTEGRAL>  required
  --award-prize-id <id>                      required
  --template-id <id>                         optional; if omitted, auto-pick a FLIP task template
  --name-prefix <text>                       default 小丑牌任务
  --tag-prefix <text>                        default flip
  --remark <text>                            optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.awardSubtype = args.awardSubtype ? String(args.awardSubtype) : "";
  args.awardPrizeId = args.awardPrizeId ? String(args.awardPrizeId) : "";
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "小丑牌任务";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "flip";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function listAllTasks(api) {
  const res = await api.get("/prod-api/activity/task/all");
  if (res.status >= 400) throw new Error(`task all HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task all failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return Array.isArray(res.body?.data) ? res.body.data : [];
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

function looksLikeFlipTask(rowOrDetail) {
  const a = rowOrDetail?.activityType;
  return String(a || "").toUpperCase() === "FLIP";
}

function pickTemplateTaskId(tasks) {
  // Prefer "INVITE_FRIEND" or "TRADING_VOLUME" as relatively stable templates; fall back to first FLIP task.
  const preferred = ["INVITE_FRIEND", "TRADING_VOLUME", "RECHARGE", "REGISTER_PASS"];
  const flipRows = tasks.filter(looksLikeFlipTask);
  for (const type of preferred) {
    const hit = flipRows.find(t => String(t?.taskType || "").toUpperCase() === type);
    if (hit?.id) return String(hit.id);
  }
  const first = flipRows.find(t => t?.id);
  return first?.id ? String(first.id) : "";
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.awardSubtype}_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.label = tag;
  payload.remark = (args.remark || `自动化-小丑牌任务(${args.awardSubtype})`).slice(0, 120);
  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: tag }));
  return { name, tag };
}

function patchAward(payload, args) {
  if (!payload.taskAward || typeof payload.taskAward !== "object") payload.taskAward = {};
  payload.taskAward.awardPrizeId = Number(args.awardPrizeId);
  if ("prizeType" in payload.taskAward) payload.taskAward.prizeType = "VIRTUAL";
  if ("prizeSubType" in payload.taskAward) payload.taskAward.prizeSubType = String(args.awardSubtype);
  // some payloads keep duplicate fields at top-level
  if ("awardPrizeId" in payload) payload.awardPrizeId = Number(args.awardPrizeId);
}

function sanitizeClonedTaskPayload(payload) {
  // avoid uniqueness / binding conflicts from cloned templates
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, v] of Object.entries(value)) {
      if (key === "linkTaskId") value[key] = null;
      if (v && typeof v === "object") visit(v);
    }
  };
  visit(payload);
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!["FLIP_CARD", "FLIP_INTEGRAL"].includes(args.awardSubtype)) throw new Error("--award-subtype must be FLIP_CARD|FLIP_INTEGRAL");
  if (!args.awardPrizeId) throw new Error("--award-prize-id is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = { mode: "headless_api", awardSubtype: args.awardSubtype, awardPrizeId: args.awardPrizeId, templateId: args.templateId || null, writes: { create: true } };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const tasks = await listAllTasks(api);
    const templateId = args.templateId || pickTemplateTaskId(tasks);
    if (!templateId) {
      throw new Error("未找到可用于 clone 的 FLIP 活动任务模板（task/all 中不存在 activityType=FLIP 的任务）。请先在后管创建至少 1 条小丑牌活动任务，或手动指定 --template-id。");
    }
    const template = await taskDetail(api, templateId);
    if (!looksLikeFlipTask(template)) {
      throw new Error(`指定的 --template-id 不属于 FLIP(activityType=FLIP)：${templateId}`);
    }
    const payload = stripCloneFields(template);
    sanitizeClonedTaskPayload(payload);
    const mutated = mutateTaskPayload(payload, args);
    patchAward(payload, args);

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
      created: { id: String(row.id), name: mutated.name, tag: mutated.tag, awardSubtype: args.awardSubtype, awardPrizeId: args.awardPrizeId },
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


#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

const CONDITION_DEFS = {
  kol: { label: "KOL绑定", slug: "kol", shortTag: "kol" },
  contract: { label: "合约交易量", slug: "contract", shortTag: "ctr" },
  spot: { label: "现货交易量", slug: "spot", shortTag: "spt" },
  recharge: { label: "充值任务", slug: "recharge", shortTag: "rch" },
};

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  args.dryRun = Boolean(args.dryRun);
  return args;
}

function parseConditions(value) {
  if (!value || value === "all") return ["kol", "contract", "spot", "recharge"];
  const conditions = String(value).split(",").map(item => item.trim()).filter(Boolean);
  const bad = conditions.filter(item => !CONDITION_DEFS[item]);
  if (bad.length) throw new Error(`Unknown --conditions value: ${bad.join(", ")}`);
  return conditions;
}

function buildPlan(args) {
  const ts = timestamp();
  return parseConditions(args.conditions).map(condition => {
    const def = CONDITION_DEFS[condition];
    return {
      condition,
      taskCondition: def.label,
      name: `${args.namePrefix || "转盘抽奖"}_${def.slug}_${ts}`,
      content: args.content || `自动化任务条件任务-${def.label}`,
      tag: args.tag || `rc${def.shortTag}${String(ts).slice(-5)}`,
      remark: args.remark || `自动化-${def.label}`,
      enName: args.enName || `Roulette condition ${def.slug} ${ts}`,
      enContent: args.enContent || `Automated roulette condition task ${def.slug}`,
      rewardMode: "单一奖励",
      rewardMin: args.rewardMin || "10",
      rewardMax: args.rewardMax || "100",
    };
  });
}

async function findTaskTemplate(api, nameHint) {
  const list = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(nameHint)}&pageNum=1&pageSize=20`);
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  if (!rows.length) throw new Error(`Task source not found: ${nameHint}`);
  let lastError = "";
  for (const row of rows) {
    const id = row?.id;
    if (!id) continue;
    const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(id)}`);
    if (detail.body?.code === 200 && detail.body?.data) return detail.body.data;
    lastError = `Task detail failed: ${id}`;
  }
  throw new Error(lastError || `Task detail failed: ${nameHint}`);
}

async function findCreatedTaskRow(api, taskName, { attempts = 8, delayMs = 500 } = {}) {
  for (let attempt = 1; attempt <= Math.max(1, Number(attempts) || 1); attempt += 1) {
    const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(taskName)}&pageNum=1&pageSize=5`);
    const rows = Array.isArray(verify.body?.rows) ? verify.body.rows : [];
    const row = rows.find(item => String(item?.name || "") === String(taskName)) || rows[0] || null;
    if (row?.id) return row;
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
  }
  return null;
}

function mutateTaskPayload(payload, task) {
  payload.name = task.name;
  payload.content = task.content;
  payload.label = task.tag;
  payload.remark = task.remark;
  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name: item.lang === "en" ? task.enName : task.name }));
  if (Array.isArray(payload.contentI18)) payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: item.lang === "en" ? task.enContent : task.content }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: task.tag }));
}

async function createTask(api, task) {
  const sourceKey = task.condition === "kol" ? "all" : task.condition;
  const template = await findTaskTemplate(api, `转盘抽奖_${sourceKey}_`);
  const payload = stripCloneFields(template);
  mutateTaskPayload(payload, task);
  const created = await api.post("/prod-api/activity/task", payload);
  if (created.body?.code !== 200) throw new Error(`Create condition task failed: ${task.name}; body=${JSON.stringify(created.body)}`);
  const row = await findCreatedTaskRow(api, task.name);
  if (!row?.id) throw new Error(`Created condition task not found: ${task.name}`);
  return {
    id: String(row.id),
    name: task.name,
    tag: task.tag,
    remark: task.remark,
    scope: "报名的所有用户",
    taskCondition: task.taskCondition,
    rewardMode: task.rewardMode,
    rewardMin: task.rewardMin,
    rewardMax: task.rewardMax,
    submit: { status: created.status, body: { code: created.body.code, msg: created.body.msg || "" } },
    row: [String(row.id), task.name, task.tag, task.remark],
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/create-roulette-condition-tasks-fast-api.mjs --conditions kol,contract,spot,recharge [--dry-run]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPlan(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", plan });
    return 0;
  }
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const created = [];
    for (const task of plan) created.push(await createTask(api, task));
    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/task`, created, durationMs: Date.now() - startedAt });
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

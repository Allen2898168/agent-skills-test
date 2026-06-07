#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-guessing-task-from-scratch-fast-api.mjs --required-integral 1 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-guessing-task-from-scratch-fast-api.mjs --required-integral 1 --confirm-create

Options:
  --required-integral <n>  required; 竞猜消耗积分阈值（requiredVolume）
  --start-time <text>      optional; guessConfig.startTime, e.g. "2026-06-01 10:00:00" (Asia/Shanghai)
  --deadline-time <text>   optional; guessConfig.deadlineTime
  --end-time <text>        optional; guessConfig.endTime
  --start-offset-seconds <n>  default 300; used when --start-time omitted
  --duration-hours <n>        default 72; used when --end-time omitted
  --deadline-offset-hours <n> default 48; used when --deadline-time omitted
  --name-prefix <text>     default 竞猜大赛_竞猜任务
  --tag-prefix <text>      default guess_task_s
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
  args.requiredIntegral = args.requiredIntegral ? Number(args.requiredIntegral) : NaN;
  args.startTime = args.startTime ? String(args.startTime) : "";
  args.deadlineTime = args.deadlineTime ? String(args.deadlineTime) : "";
  args.endTime = args.endTime ? String(args.endTime) : "";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 300;
  args.durationHours = args.durationHours ? Number(args.durationHours) : 72;
  args.deadlineOffsetHours = args.deadlineOffsetHours ? Number(args.deadlineOffsetHours) : 48;
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "竞猜大赛_竞猜任务";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "guess_task_s";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

function formatDateTimeInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function patchI18(payload, key, value) {
  const i18Key = `${key}I18`;
  if (!Array.isArray(payload[i18Key])) return;
  payload[i18Key] = payload[i18Key].map(item => ({ ...item, name: value }));
}

function loadBaseline() {
  const filePath = path.join(repoRoot, "skills/weex-admin-ops/references/payload-baselines/guess-guessTask.baseline.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeGuessStatusAndResult(payload) {
  payload.guessStatus = "NOT_START";
  if ("guessResult" in payload) delete payload.guessResult;
}

function normalizeGuessConfigTimes(payload, { startTime, deadlineTime, endTime } = {}) {
  if (!payload.guessConfig) payload.guessConfig = {};
  payload.guessConfig.startTime = startTime;
  payload.guessConfig.deadlineTime = deadlineTime;
  payload.guessConfig.endTime = endTime;
}

function windowGuessTimes(args) {
  const now = Date.now();
  const start = new Date(now + Math.max(0, Number(args.startOffsetSeconds) || 0) * 1000);
  const end = new Date(start.getTime() + Math.max(1, Number(args.durationHours) || 1) * 60 * 60 * 1000);
  const deadline = new Date(start.getTime() + Math.max(0, Number(args.deadlineOffsetHours) || 0) * 60 * 60 * 1000);
  const timeZone = "Asia/Shanghai";
  const startStr = args.startTime || formatDateTimeInTimeZone(start, timeZone);
  const endStr = args.endTime || formatDateTimeInTimeZone(end, timeZone);
  const deadlineStr = args.deadlineTime || formatDateTimeInTimeZone(deadline, timeZone);
  return { startTime: startStr, deadlineTime: deadlineStr, endTime: endStr };
}

function buildPayload(args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${ts}_${short}`.slice(0, 80);
  const tag = `${args.tagPrefix}${short}`.slice(0, 40);
  const content = `竞猜任务描述_${ts}`.slice(0, 120);

  const baseline = stripCloneFields(loadBaseline());
  const payload = JSON.parse(JSON.stringify(baseline));
  payload.name = name;
  payload.content = content;
  payload.label = tag;
  payload.remark = (args.remark || `自动化-GUESS竞猜任务(${ts})`).slice(0, 120);
  patchI18(payload, "name", name);
  patchI18(payload, "content", content);
  patchI18(payload, "label", tag);

  if (Array.isArray(payload.requirement) && payload.requirement[0]) {
    payload.requirement[0].requiredVolume = Number(args.requiredIntegral);
  } else {
    payload.requirement = [{ type: "GUESS", guessTaskType: "ACTIVITY_INTEGRAL", verifyType: "GREATER_EQUAL", requiredVolume: Number(args.requiredIntegral) }];
  }

  normalizeGuessStatusAndResult(payload);
  normalizeGuessConfigTimes(payload, windowGuessTimes(args));

  if (payload.completeTaskGroupCount == null) payload.completeTaskGroupCount = 1;
  if (!Array.isArray(payload.taskRisk) || payload.taskRisk.length === 0) payload.taskRisk = ["NONE"];

  return payload;
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/guessTask/${encodeURIComponent(String(id))}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`GuessTask detail failed: ${id}`);
  return res.body.data;
}

async function findCreatedIdByName(api, name) {
  const res = await api.get(`/prod-api/activity/guessTask/list?pageNum=1&pageSize=5&name=${encodeURIComponent(String(name || ""))}`);
  const row = res?.body?.rows?.[0] || null;
  const id = row?.id || null;
  return id ? String(id) : null;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.requiredIntegral) || args.requiredIntegral <= 0) throw new Error("--required-integral is required and must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const payload = buildPayload(args);
  const plan = {
    mode: "headless_api",
    endpoint: "/prod-api/activity/guessTask",
    requiredIntegral: args.requiredIntegral,
    guessConfigTime: payload?.guessConfig ? { startTime: payload.guessConfig.startTime, deadlineTime: payload.guessConfig.deadlineTime, endTime: payload.guessConfig.endTime } : null,
    writes: { create: true },
    preview: { name: payload.name, label: payload.label },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建竞猜任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const created = await api.post("/prod-api/activity/guessTask", payload);
    if (created.body?.code !== 200) throw new Error(`Create guessTask failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);
    const createdId = created.body?.data?.id ?? created.body?.data ?? created.body?.id ?? null;
    let id = createdId ? String(createdId) : null;
    if (!id) id = await findCreatedIdByName(api, payload.name).catch(() => null);
    if (!id) throw new Error("Create guessTask succeeded but id missing");
    const det = await detail(api, id);
    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/guessCompetition`, created: { id, name: payload.name, tag: payload.label, requiredIntegral: args.requiredIntegral }, createdGuessTaskDetail: det, durationMs: Date.now() - startedAt });
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

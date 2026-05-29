#!/usr/bin/env node
import fs from "node:fs";
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config MONOPOLY_WORLD_CUP with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    optional; if omitted, auto-pick first MONOPOLY_WORLD_CUP activity as payload baseline
  --title-prefix <text>       default 大富翁世界杯全配
  --alias-prefix <text>       default mwc
  --required-volume <n>       default 1; for created contract trading daily dice task
  --start-offset-seconds <n>  default 1800 (30min)
  --end-days <n>              default 30
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--dry-run", "--confirm-create", "--confirm-full-verify", "--cleanup", "--confirm-cleanup"],
  });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.confirmFullVerify = Boolean(args.confirmFullVerify);
  args.cleanup = Boolean(args.cleanup);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  args.verifyLevel = args.verifyLevel ? String(args.verifyLevel) : "min";
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "大富翁世界杯全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "mwc";
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
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

function activityWindow(offsetSeconds = 1800, endDays = 30) {
  const start = new Date(Date.now() + Number(offsetSeconds) * 1000);
  const end = new Date(start.getTime() + Number(endDays) * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function runChildJson(commandArgs, { timeoutMs = 300000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, Math.max(30000, Number(timeoutMs)));
    child.stdout.on("data", chunk => (stdout += chunk.toString()));
    child.stderr.on("data", chunk => (stderr += chunk.toString()));
    child.on("close", code => {
      clearTimeout(timer);
      const parsed = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({ ok: code === 0 && Boolean(parsed?.ok !== false), code, killedByTimeout, stdout, stderr, json: parsed });
    });
  });
}

async function resolveTemplate(api, templateAlias) {
  if (templateAlias) {
    const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=MONOPOLY_WORLD_CUP&showUrl=${encodeURIComponent(templateAlias)}`);
    const row = firstRow(list);
    const id = row?.activityId || row?.id;
    if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
    const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
    if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
    return { id: String(id), alias: templateAlias, detail: detail.body.data };
  }
  const list = await api.get("/prod-api/activity/config/list?pageNum=1&pageSize=10&type=MONOPOLY_WORLD_CUP");
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  const alias = row?.showUrl || row?.showUrlSecret || "";
  if (!id) throw new Error("未找到可用于 clone 的 MONOPOLY_WORLD_CUP 模板活动；请先在后管创建至少一条大富翁世界杯活动，或传 --template-alias");
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: String(alias), detail: detail.body.data };
}

function patchActivityI18n(payload, { title, subTitle }) {
  if (!Array.isArray(payload.activityConfigI18n)) return;
  payload.activityConfigI18n = payload.activityConfigI18n.map(item => {
    if (!item || typeof item !== "object") return item;
    if (item.lang === "zh_CN") return { ...item, title, subTitle };
    return item;
  });
}

function ensureMonopolyList(payload) {
  if (!Array.isArray(payload.monopolyList) || payload.monopolyList.length === 0) {
    payload.monopolyList = [{ channelType: 1 }];
  }
}

function patchMinimalMonopolyConfig({ payload, created }) {
  ensureMonopolyList(payload);
  const list = payload.monopolyList;
  const first = list[0] || {};
  const grids = Array.from({ length: 16 }, (_, i) => ({
    gridNo: i + 1,
    prizeId: Number(created.noRewardPrizeId),
    displayMin: 0,
    displayMax: 0,
    rewardDisplayCount: 0,
    rewardRealCount: 0,
    prizeLabel: "",
    blankGridFlag: true,
  }));
  first.boardSize = 16;
  first.startPosition = 1;
  first.dailyMoveLimit = 20;
  first.maxDicePoint = 6;
  first.gridConfig = {
    autoRewardEnabled: true,
    grids,
    fallbackGrid: { prizeId: Number(created.noRewardPrizeId), displayMin: 0, displayMax: 0, rewardDisplayCount: 0, rewardRealCount: 0, prizeLabel: "", blankGridFlag: true },
  };
  first.pointPoolPrizeList = [
    { prizeId: Number(created.integralPrizeId), total: 1, sort: 1 },
  ];
  first.extraInfo = first.extraInfo || {};
  first.extraInfo.descriptionContent = first.extraInfo.descriptionContent || {};
  first.taskConfig = first.taskConfig || {};
  first.taskConfig.dailyTask = {
    moduleIntro: "",
    moduleIntroI18: [],
    tasks: [{ taskId: Number(created.dailyDiceTaskId), sort: 1 }],
  };
  first.riskConfig = first.riskConfig || { thresholds: [{ minValue: 40, maxValue: 40, ratio: 10 }] };
  list[0] = first;
  payload.monopolyList = list;
}

function buildActivityPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const alias = String(`${args.aliasPrefix || "mwc"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix || "大富翁世界杯全配"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(templateDetail);
  payload.type = "MONOPOLY_WORLD_CUP";
  payload.activityType = 23;
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  payload.startTime = window.start;
  payload.endTime = window.end;
  payload.channelCategory = payload.channelCategory || "UNIVERSAL";
  payload.applyConfigId = Number(created.applyConfigId);
  payload.showActivityCalendar = payload.showActivityCalendar ?? 1;
  payload.syncCalendarFlag = payload.syncCalendarFlag ?? 0;
  payload.contractTradingVolumeTaskId = Number(created.dailyDiceTaskId);
  patchActivityI18n(payload, { title, subTitle });
  patchMinimalMonopolyConfig({ payload, created });
  return { alias, title, subTitle, window, payload };
}

async function online(api, activityId, config) {
  const res = await api.post("/prod-api/activity/monopoly/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function offline(api, activityId, config) {
  const res = await api.post("/prod-api/activity/monopoly/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteActivity(api, activityId, config) {
  const res = await api.post("/prod-api/activity/monopoly/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deletePrize(api, id) {
  const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const verifyLevel = String(args.verifyLevel || "min");
  if (!["min", "full"].includes(verifyLevel)) throw new Error(`--verify-level must be min|full, got: ${verifyLevel}`);
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  const plan = {
    mode: "headless_api",
    templateAlias: args.templateAlias || null,
    dependencyCreates: {
      registerTemplate: "create-register-templates-fast-api.mjs (platformScope=all; signupMode=auto)",
      prizes: "create-monopoly-worldcup-virtual-prizes-fast-api.mjs (DICE,INTEGRAL,NO_REWARD)",
      dailyDiceTask: "create-monopoly-worldcup-contract-trading-daily-dice-task-fast-api.mjs",
    },
    activity: { titlePrefix: args.titlePrefix, aliasPrefix: args.aliasPrefix, window: activityWindow(args.startOffsetSeconds, args.endDays) },
    verify: { level: verifyLevel, includes: verifyLevel === "full" ? ["draft-checks", "online", "offline"] : ["draft-checks"] },
    writes: { create: true, fullVerify: verifyLevel === "full", cleanup: Boolean(args.cleanup) },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建大富翁世界杯活动全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  if (args.cleanup && !args.confirmCleanup) throw new Error("需要用户确认：cleanup 需要传 --confirm-cleanup（会删除活动与依赖项）。");

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = {
    registerTemplateId: "",
    applyConfigId: "",
    dicePrizeId: "",
    integralPrizeId: "",
    noRewardPrizeId: "",
    dailyDiceTaskId: "",
    activityId: "",
    activityAlias: "",
  };

  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });

    const template = await resolveTemplate(api, args.templateAlias);

    // 1) register template (applyConfigId)
    const createdRegister = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
      "--platform-scope",
      "all",
    ]);
    if (!createdRegister.ok) throw new Error(`create register template failed: ${createdRegister.json?.error || createdRegister.stderr}`);
    const rt = createdRegister.json?.created?.[0];
    created.registerTemplateId = String(rt?.id || "");
    created.applyConfigId = created.registerTemplateId;
    if (!created.applyConfigId) throw new Error("missing applyConfigId from created register template");

    // 2) prizes (DICE, INTEGRAL, NO_REWARD)
    const createdPrizes = await runChildJson([
      "skills/weex-admin-ops/scripts/create-monopoly-worldcup-virtual-prizes-fast-api.mjs",
      "--subtypes",
      "DICE,INTEGRAL,NO_REWARD",
      "--confirm-create",
    ]);
    if (!createdPrizes.ok) throw new Error(`create monopoly prizes failed: ${createdPrizes.json?.error || createdPrizes.stderr}`);
    const list = Array.isArray(createdPrizes.json?.created) ? createdPrizes.json.created : [];
    const bySubtype = new Map(list.map(p => [String(p?.prizeSubType || "").toUpperCase(), p]));
    created.dicePrizeId = String(bySubtype.get("DICE")?.id || "");
    created.integralPrizeId = String(bySubtype.get("INTEGRAL")?.id || "");
    created.noRewardPrizeId = String(bySubtype.get("NO_REWARD")?.id || "");
    if (!created.dicePrizeId || !created.integralPrizeId || !created.noRewardPrizeId) throw new Error("missing created prize ids");

    // 3) daily contract trading volume task with dice reward
    const createdTask = await runChildJson([
      "skills/weex-admin-ops/scripts/create-monopoly-worldcup-contract-trading-daily-dice-task-fast-api.mjs",
      "--dice-prize-id",
      String(created.dicePrizeId),
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    if (!createdTask.ok) throw new Error(`create task failed: ${createdTask.json?.error || createdTask.stderr}`);
    created.dailyDiceTaskId = String(createdTask.json?.created?.id || "");
    if (!created.dailyDiceTaskId) throw new Error("missing dailyDiceTaskId");

    // 4) create activity
    const built = buildActivityPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const createdActivity = await api.post("/prod-api/activity/config", built.payload);
    if (createdActivity.body?.code !== 200) throw new Error(`Create activity failed: ${JSON.stringify({ code: createdActivity.body?.code, msg: createdActivity.body?.msg || createdActivity.body?.message })}`);
    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=MONOPOLY_WORLD_CUP&showUrl=${encodeURIComponent(built.alias)}`);
    const row = firstRow(verifyList);
    const activityId = row?.activityId || row?.id;
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);
    created.activityId = String(activityId);
    created.activityAlias = built.alias;

    // 5) min verify: draft-checks (key fields)
    const detailRes = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    const d = detailRes.body?.data || {};
    const minOk =
      d?.type === "MONOPOLY_WORLD_CUP" &&
      Boolean(d?.applyConfigId) &&
      Array.isArray(d?.monopolyList) &&
      d.monopolyList.length >= 1 &&
      Number(d?.contractTradingVolumeTaskId) > 0;
    const verify = {
      ok: Boolean(minOk),
      checks: {
        type: d?.type ?? null,
        applyConfigId: d?.applyConfigId ?? null,
        monopolyListCount: Array.isArray(d?.monopolyList) ? d.monopolyList.length : null,
        contractTradingVolumeTaskId: d?.contractTradingVolumeTaskId ?? null,
      },
    };
    if (!verify.ok) throw new Error(`min verify failed: ${JSON.stringify(verify.checks)}`);

    let fullVerify = null;
    if (verifyLevel === "full") {
      const on = await online(api, activityId, config);
      if (!on.ok) throw new Error(`online failed: ${JSON.stringify(on.body)}`);
      const off = await offline(api, activityId, config);
      if (!off.ok) throw new Error(`offline failed: ${JSON.stringify(off.body)}`);
      fullVerify = { ok: true, online: on.body, offline: off.body };
    }

    let cleanedUp = null;
    if (args.cleanup) {
      await offline(api, activityId, config).catch(() => {});
      const delAct = await deleteActivity(api, activityId, config);
      const delTask = await deleteTask(api, created.dailyDiceTaskId);
      const delDice = await deletePrize(api, created.dicePrizeId);
      const delIntegral = await deletePrize(api, created.integralPrizeId);
      const delNoReward = await deletePrize(api, created.noRewardPrizeId);
      const delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
      cleanedUp = { activity: delAct, task: delTask, dicePrize: delDice, integralPrize: delIntegral, noRewardPrize: delNoReward, registerTemplate: delRegister };
    }

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/monopoly`,
      template: { alias: template.alias, id: template.id },
      created,
      verify,
      fullVerify,
      cleanedUp,
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api?.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

const LIST_TYPE = "TRACE_PRO";
const CHANNEL_CATEGORY_AGENT = "AGENT";

function usage() {
  return `Usage:
  # Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config AGENT_TRACE_PRO with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    default dimootest1-4
  --title-prefix <text>       default 代理小活动全配
  --alias-prefix <text>       default atp
  --start-offset-seconds <n>  default 1800 (30min)
  --end-days <n>              default 30
  --required-volume <n>       default 1 (交易量任务阈值)
  --resource-cards <n>        default 3 (资源卡数量，最多 3)
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
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "dimootest1-4";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "代理小活动全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "atp";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.resourceCards = Math.max(0, Math.min(3, Number(args.resourceCards ?? 3)));
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
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "1", type: LIST_TYPE, showUrl: String(templateAlias) });
  const list = await api.get(`/prod-api/activity/config/list?${qs.toString()}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template activity detail failed: ${templateAlias}`);
  return { id: String(id), detail: detail.body.data };
}

function patchMiniActivityTaskConfigs(miniActivity, createdTaskDetail) {
  if (!Array.isArray(miniActivity) || !miniActivity[0] || typeof miniActivity[0] !== "object") return miniActivity;
  const item0 = miniActivity[0];
  if (Array.isArray(item0.taskConfigs)) item0.taskConfigs = [createdTaskDetail];
  else if (Array.isArray(item0.taskConfig)) item0.taskConfig = [createdTaskDetail];
  else item0.taskConfigs = [createdTaskDetail];
  return miniActivity;
}

async function buildAgentTraceProPayload({ templateDetail, created, args }) {
  const ts = buildSuffix();
  const alias = `${args.aliasPrefix || "atp"}${Date.now().toString().slice(-8)}`.slice(0, 32);
  const title = `${args.titlePrefix || "代理小活动"}${ts.slice(-6)}`.slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds, args.endDays);

  const payload = stripCloneFields(templateDetail);
  payload.type = LIST_TYPE;
  payload.channelCategory = CHANNEL_CATEGORY_AGENT;
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;

  payload.applyConfigId = Number(created.applyConfigId || 0) || payload.applyConfigId;
  if (payload.preApplyConfigId && payload.preApplyConfigId === payload.applyConfigId) payload.preApplyConfigId = "";

  if (args.resourceCards > 0 && Array.isArray(created.resourceCardIds) && created.resourceCardIds.length) {
    payload.resourceConfig = created.resourceCardIds.map(id => ({ id: Number(id) }));
    payload.showResource = 1;
  }

  if (Array.isArray(payload.miniActivity) && created.taskDetail) {
    payload.miniActivity = patchMiniActivityTaskConfigs(payload.miniActivity, created.taskDetail);
  }

  return { alias, title, window, payload };
}

async function deleteTraceProActivity(api, activityId, config) {
  const del = await api.post("/prod-api/activity/tracePro/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deletePrize(api, id) {
  const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteResourceCard(api, id) {
  const del = await api.delete(`/prod-api/activity/resource/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const verifyLevel = String(args.verifyLevel || "min");
  if (!["min", "full"].includes(verifyLevel)) throw new Error(`--verify-level must be min|full, got: ${verifyLevel}`);

  const plan = {
    mode: "headless_api",
    templateAlias: args.templateAlias,
    dependencyCreates: {
      registerTemplate: "create-register-templates-fast-api.mjs (platformScope=all; signupMode=auto; permissions=signup,view)",
      prize: "create-prizes-fast-api.mjs (1 bonus prize)",
      task: `create-agent-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs (requiredVolume=${args.requiredVolume}U + prize binding)`,
      resourceCards: args.resourceCards > 0 ? `resource-card-fast-api.mjs (create-min ${args.resourceCards} cards for TRACE_PRO)` : "skipped",
    },
    activity: {
      channelCategory: CHANNEL_CATEGORY_AGENT,
      titlePrefix: args.titlePrefix,
      aliasPrefix: args.aliasPrefix,
      window: activityWindow(args.startOffsetSeconds, args.endDays),
    },
    verify: { level: verifyLevel, includes: verifyLevel === "full" ? ["draft-checks", "online", "offline"] : ["draft-checks"] },
    writes: { create: true, fullVerify: verifyLevel === "full", cleanup: Boolean(args.cleanup) },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建代理小活动全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = { applyConfigId: "", registerTemplateId: "", prizeId: "", taskId: "", taskDetail: null, resourceCardIds: [] };
  let api = null;
  try {
    // 0) resolve template (payload baseline only)
    const apiForTemplate = await createAdminApiSession({ config, requireApiLogin: true });
    const template = await resolveTemplate(apiForTemplate, args.templateAlias);
    await apiForTemplate.close();

    // 1) register template (applyConfigId)
    const ts = timestamp().slice(-6);
    const registerTemplate = await runChildJson([
      "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
      "--platform-scope",
      "all",
      "--signup-modes",
      "auto",
      "--permissions",
      "signup,view",
      "--name-prefix",
      `代理小活动报名模板_${ts}`,
      "--confirm-create",
    ]);
    if (!registerTemplate.ok) throw new Error(`create-register-templates-fast-api.mjs failed: ${registerTemplate.json?.error || "unknown"}`);
    const createdTemplates = Array.isArray(registerTemplate.json?.created) ? registerTemplate.json.created : [];
    created.registerTemplateId = String(createdTemplates[0]?.id || "");
    created.applyConfigId = created.registerTemplateId;
    if (!created.registerTemplateId) throw new Error("No register template id returned from create-register-templates-fast-api.mjs");

    // 2) prize (create 1 bonus prize)
    const prizesCreate = await runChildJson([
      "skills/weex-admin-ops/scripts/create-prizes-fast-api.mjs",
      "--category",
      "赠金",
      "--subtype",
      "赠金",
      "--count",
      "1",
      "--name-prefix",
      `代理小活动赠金_${ts}`,
      "--confirm-create",
    ]);
    if (!prizesCreate.ok) throw new Error(`create-prizes-fast-api.mjs failed: ${prizesCreate.json?.error || "unknown"}`);
    const createdPrizes = Array.isArray(prizesCreate.json?.created) ? prizesCreate.json.created : [];
    created.prizeId = String(createdPrizes[0]?.id || "");
    if (!created.prizeId) throw new Error("No prize id returned from create-prizes-fast-api.mjs");

    // 3) task (AGENT_TRACE_PRO trading volume)
    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-agent-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--prize-id",
      String(created.prizeId),
      "--confirm-create",
    ]);
    if (!task.ok) throw new Error(`create-agent-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");
    created.taskDetail = task.json?.createdTaskDetail || null;
    if (!created.taskId || !created.taskDetail) throw new Error("No task id/detail returned from create-agent-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs");

    // 4) resource cards
    if (args.resourceCards > 0) {
      const cards = await runChildJson([
        "skills/weex-admin-ops/scripts/resource-card-fast-api.mjs",
        "--action",
        "create-min",
        "--count",
        String(args.resourceCards),
        "--activity-types",
        "TRACE_PRO",
        "--confirm-create",
      ]);
      if (!cards.ok) throw new Error(`resource-card-fast-api.mjs failed: ${cards.json?.error || "unknown"}`);
      created.resourceCardIds = Array.isArray(cards.json?.createdIds) ? cards.json.createdIds.map(String) : [];
    }

    // 5) create activity
    api = await createAdminApiSession({ config, requireApiLogin: true });
    const built = await buildAgentTraceProPayload({ templateDetail: template.detail, created, args });
    const createdActivity = await api.post("/prod-api/activity/config", built.payload);
    if (createdActivity.body?.code !== 200) throw new Error(`Create activity failed: ${JSON.stringify({ code: createdActivity.body?.code, msg: createdActivity.body?.msg || createdActivity.body?.message })}`);

    const listVerify = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=${encodeURIComponent(LIST_TYPE)}&showUrl=${encodeURIComponent(built.alias)}`);
    const row = firstRow(listVerify);
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);

    // 6) min/full verify
    const draftCheck = await runChildJson([
      "skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs",
      "--action",
      "draft-checks",
      "--activity-alias",
      built.alias,
    ]);
    if (!draftCheck.ok) throw new Error(`agent-tracepro draft-checks failed: ${draftCheck.json?.error || "unknown"}`);

    const verifySteps = { draftChecks: draftCheck.json };
    if (verifyLevel === "full") {
      const online = await api.post("/prod-api/activity/tracePro/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      if (online.body?.code !== 200) throw new Error(`online failed: ${JSON.stringify({ code: online.body?.code, msg: online.body?.msg || online.body?.message })}`);
      const offline = await api.post("/prod-api/activity/tracePro/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      if (offline.body?.code !== 200) throw new Error(`offline failed: ${JSON.stringify({ code: offline.body?.code, msg: offline.body?.msg || offline.body?.message })}`);
      verifySteps.online = { code: online.body?.code ?? null, msg: online.body?.msg || "" };
      verifySteps.offline = { code: offline.body?.code ?? null, msg: offline.body?.msg || "" };
    }

    // 7) cleanup
    const cleanup = { attempted: Boolean(args.cleanup), ok: true, steps: {} };
    if (args.cleanup) {
      if (!args.confirmCleanup) throw new Error("需要用户确认：cleanup 需要同时传 --confirm-cleanup。");
      const delAct = await deleteTraceProActivity(api, activityId, config);
      cleanup.steps.deleteActivity = delAct;
      if (!delAct.ok) cleanup.ok = false;
      if (created.taskId) cleanup.steps.deleteTask = await deleteTask(api, created.taskId);
      if (created.prizeId) cleanup.steps.deletePrize = await deletePrize(api, created.prizeId);
      if (created.registerTemplateId) cleanup.steps.deleteRegisterTemplate = await deleteRegisterTemplate(api, created.registerTemplateId);
      if (Array.isArray(created.resourceCardIds) && created.resourceCardIds.length) {
        cleanup.steps.deleteResourceCards = [];
        for (const id of created.resourceCardIds) cleanup.steps.deleteResourceCards.push(await deleteResourceCard(api, id));
      }
    }

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: "/activities/copyTrading",
      created: {
        activityId,
        alias: built.alias,
        title: built.title,
        channelCategory: CHANNEL_CATEGORY_AGENT,
        applyConfigId: created.applyConfigId,
        registerTemplateId: created.registerTemplateId,
        prizeId: created.prizeId,
        taskId: created.taskId,
        resourceCardIds: created.resourceCardIds,
      },
      verifyHints: verifySteps,
      cleanup,
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    if (api) await api.close().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


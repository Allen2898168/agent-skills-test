#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config CONTRACT_MINING with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    optional; if omitted, auto-pick first CONTRACT_MINING activity as template baseline
  --title-prefix <text>       default 合约挖矿全配
  --alias-prefix <text>       default cm
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "合约挖矿全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "cm";
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
    const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CONTRACT_MINING&showUrl=${encodeURIComponent(templateAlias)}`);
    const row = firstRow(list);
    const id = row?.activityId || row?.id;
    if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
    const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
    if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
    return { id: String(id), alias: templateAlias, detail: detail.body.data };
  }
  const list = await api.get("/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CONTRACT_MINING");
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error("未找到可用于 clone 的 CONTRACT_MINING 活动模板（活动列表为空）；请先在后管创建至少 1 个合约挖矿活动。");
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: String(detail.body.data?.showUrl || row?.showUrl || ""), detail: detail.body.data };
}

function patchActivityI18n(payload, { title, subTitle }) {
  if (Array.isArray(payload.activityConfigI18n) && payload.activityConfigI18n.length) {
    payload.activityConfigI18n = payload.activityConfigI18n.map(item => ({ ...item, title, subTitle }));
    return;
  }
  payload.activityConfigI18n = [{ lang: "zh_CN", title, subTitle }];
}

function patchMiningListTaskConfig(payload, taskId) {
  if (!Array.isArray(payload.miningList) || payload.miningList.length === 0) {
    payload.miningList = [
      {
        channelType: "OFFICIAL_WEBSITE",
        taskConfig: [{ id: Number(taskId) }],
        showPoolFlag: "NO",
        showWeLaunchFlag: "NO",
        showBuybackNoticeFlag: "NO",
        showAgentTaskFlag: "NO",
      },
    ];
    return;
  }
  payload.miningList = payload.miningList.map(item => {
    const next = { ...(item || {}) };
    next.taskConfig = [{ id: Number(taskId) }];
    if (!next.channelType) next.channelType = "OFFICIAL_WEBSITE";
    if (!next.showPoolFlag) next.showPoolFlag = "NO";
    if (!next.showWeLaunchFlag) next.showWeLaunchFlag = "NO";
    if (!next.showBuybackNoticeFlag) next.showBuybackNoticeFlag = "NO";
    if (!next.showAgentTaskFlag) next.showAgentTaskFlag = "NO";
    return next;
  });
}

function buildActivityPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const alias = String(`${args.aliasPrefix || "cm"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix || "合约挖矿全配"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(templateDetail);
  payload.type = "CONTRACT_MINING";
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if (!payload.channelCategory) payload.channelCategory = "UNIVERSAL";
  payload.applyConfigId = Number(created.applyConfigId);
  payload.showActivityCalendar = payload.showActivityCalendar ?? 1;
  patchMiningListTaskConfig(payload, created.taskId);
  patchActivityI18n(payload, { title, subTitle });

  return { alias, title, subTitle, window, payload };
}

async function deleteContractMiningActivity(api, activityId, config) {
  const del = await api.post("/prod-api/activity/mining/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function offlineContractMiningActivity(api, activityId, config) {
  const off = await api.post("/prod-api/activity/mining/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: off.body?.code === 200, status: off.status, body: { code: off.body?.code ?? null, msg: off.body?.msg || "" } };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteRegisterTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
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
    templateAlias: args.templateAlias || null,
    dependencyCreates: {
      registerTemplate: "create-register-templates-fast-api.mjs (platformScope=all; signupMode=auto; permissions=signup,view)",
      task: "create-contract-mining-trading-mining-task-fast-api.mjs",
    },
    activity: {
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
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建合约挖矿活动全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }
  if (args.cleanup && !args.confirmCleanup) throw new Error("需要用户确认：cleanup 需要传 --confirm-cleanup（会删除活动与依赖项）。");

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = { applyConfigId: "", registerTemplateId: "", taskId: "", activityId: "", activityAlias: "" };
  let api = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 0) resolve template (payload baseline only)
    const template = await resolveTemplate(api, args.templateAlias);

    // 1) register template (applyConfigId)
    const ts = String(Date.now()).slice(-6);
    const registerScriptArgs = [
      "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
      "--platform-scope",
      "all",
      "--signup-modes",
      "auto",
      "--permissions",
      "signup,view",
      "--name-prefix",
      `合约挖矿报名模板_${ts}`,
    ];
    const registerRes = await runChildJson(registerScriptArgs);
    if (!registerRes.ok) throw new Error(`Create register template failed: ${registerRes.json?.error || registerRes.stderr || registerRes.stdout}`);
    const createdTemplates = Array.isArray(registerRes.json?.created) ? registerRes.json.created : [];
    const registerId = String(createdTemplates[0]?.id || "");
    if (!registerId) throw new Error("Create register template ok but id missing in output");
    created.registerTemplateId = registerId;
    created.applyConfigId = registerId;

    // 2) main task
    const taskRes = await runChildJson(["skills/weex-admin-ops/scripts/create-contract-mining-trading-mining-task-fast-api.mjs", "--confirm-create"]);
    if (!taskRes.ok) throw new Error(`Create contract mining task failed: ${taskRes.json?.error || taskRes.stderr || taskRes.stdout}`);
    const taskId = String(taskRes.json?.created?.id || "");
    if (!taskId) throw new Error("Create contract mining task ok but id missing in output");
    created.taskId = taskId;

    // 3) create activity
    const built = buildActivityPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create activity failed: ${JSON.stringify({ code: create.body?.code, msg: create.body?.msg || create.body?.message })}`);

    const verifyList = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CONTRACT_MINING&showUrl=${encodeURIComponent(built.alias)}`);
    const row = firstRow(verifyList);
    const activityId = row?.activityId || row?.id;
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);
    created.activityId = String(activityId);
    created.activityAlias = built.alias;

    // 4) verify
    const checks = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
    if (checks.body?.code !== 200 || !checks.body?.data) throw new Error("Verify detail failed");
    const verifyDetail = checks.body.data;
    const draftChecks = [
      { ok: verifyDetail.type === "CONTRACT_MINING", key: "type", expected: "CONTRACT_MINING", actual: verifyDetail.type ?? null },
      { ok: Number(verifyDetail.applyConfigId) === Number(created.applyConfigId), key: "applyConfigId", expected: created.applyConfigId, actual: verifyDetail.applyConfigId ?? null },
      { ok: Array.isArray(verifyDetail.miningList) && verifyDetail.miningList.length >= 1, key: "miningList", expected: ">=1", actual: Array.isArray(verifyDetail.miningList) ? verifyDetail.miningList.length : null },
      {
        ok: Array.isArray(verifyDetail.miningList?.[0]?.taskConfig) && verifyDetail.miningList[0].taskConfig.length >= 1,
        key: "miningList[0].taskConfig",
        expected: ">=1",
        actual: verifyDetail.miningList?.[0]?.taskConfig?.length ?? null,
      },
    ];
    const minVerifyOk = draftChecks.every(item => item.ok);
    if (!minVerifyOk) throw new Error(`draft-checks failed: ${JSON.stringify(draftChecks)}`);

    const fullVerify = { online: null, offline: null };
    if (verifyLevel === "full") {
      const on = await api.post("/prod-api/activity/mining/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      fullVerify.online = { ok: on.body?.code === 200, code: on.body?.code ?? null, msg: on.body?.msg || "" };
      if (!fullVerify.online.ok) throw new Error(`online failed: ${JSON.stringify(fullVerify.online)}`);
      const off = await api.post("/prod-api/activity/mining/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      fullVerify.offline = { ok: off.body?.code === 200, code: off.body?.code ?? null, msg: off.body?.msg || "" };
      if (!fullVerify.offline.ok) throw new Error(`offline failed: ${JSON.stringify(fullVerify.offline)}`);
    }

    const cleanup = { activity: null, task: null, registerTemplate: null };
    if (args.cleanup) {
      // best-effort offline before delete
      await offlineContractMiningActivity(api, activityId, config).catch(() => null);
      cleanup.activity = await deleteContractMiningActivity(api, activityId, config);
      cleanup.task = await deleteTask(api, created.taskId);
      cleanup.registerTemplate = await deleteRegisterTemplate(api, created.registerTemplateId);
      if (!cleanup.activity?.ok) throw new Error(`cleanup activity failed: ${JSON.stringify(cleanup.activity)}`);
    }

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/contractMining/index`,
      plan,
      template: { id: template.id, alias: template.alias },
      created,
      draftChecks,
      fullVerify,
      cleanup,
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    if (api) await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

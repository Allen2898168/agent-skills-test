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

function runChildJson(commandArgs, { timeoutMs = 300000, envOverrides = {} } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: { ...process.env, ...envOverrides },
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

function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function rebindApplyTemplateToDefault(api, activityId, { defaultApplyConfigId = 2442 } = {}) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  const item = detail.body?.data || null;
  if (!item || detail.body?.code !== 200) return { ok: false, skipped: true, reason: "detail_unavailable", detail: { status: detail.status, code: detail.body?.code ?? null, msg: detail.body?.msg || "" } };
  const patched = { ...item, applyConfigId: Number(defaultApplyConfigId) };
  if ("registerTemplateId" in patched) patched.registerTemplateId = Number(defaultApplyConfigId);
  const put = await api.put("/prod-api/activity/config", patched);
  return { ok: put.body?.code === 200, status: put.status, body: { code: put.body?.code ?? null, msg: put.body?.msg || "" } };
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
  const taskIds = Array.isArray(taskId) ? taskId.map(x => String(x)).filter(Boolean) : [String(taskId || "")].filter(Boolean);
  const fallbackTaskId = taskIds[0] ? Number(taskIds[0]) : null;
  if (!Array.isArray(payload.miningList) || payload.miningList.length === 0) {
    payload.miningList = [
      {
        channelType: "OFFICIAL_WEBSITE",
        taskConfig: fallbackTaskId ? [{ id: fallbackTaskId }] : [],
        showPoolFlag: "NO",
        showWeLaunchFlag: "NO",
        showBuybackNoticeFlag: "NO",
        showAgentTaskFlag: "NO",
      },
    ];
    return;
  }
  payload.miningList = payload.miningList.map((item, index) => {
    const nextTaskId = taskIds[index] ? Number(taskIds[index]) : fallbackTaskId;
    const next = { ...(item || {}) };
    next.taskConfig = nextTaskId ? [{ id: nextTaskId }] : [];
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
  patchMiningListTaskConfig(payload, created.taskIds || created.taskId);
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

async function cleanupCreated(api, created, config) {
  const cleanup = {
    rebindApplyTemplate: { ok: true, skipped: true },
    activity: { ok: true, skipped: true },
    tasks: { ok: true, skipped: true, deletedTasks: [] },
    registerTemplate: { ok: true, skipped: true },
  };

  if (created?.activityId) {
    cleanup.rebindApplyTemplate = await rebindApplyTemplateToDefault(api, created.activityId, { defaultApplyConfigId: 2442 }).catch(err => ({
      ok: false,
      error: err?.message || String(err),
    }));
    await offlineContractMiningActivity(api, created.activityId, config).catch(() => null);
    cleanup.activity = await deleteContractMiningActivity(api, created.activityId, config);
  }

  const ids = Array.isArray(created?.taskIds) && created.taskIds.length ? created.taskIds : created?.taskId ? [created.taskId] : [];
  cleanup.tasks = { ok: true, skipped: ids.length === 0, deletedTasks: [] };
  for (const id of ids) {
    const del = await deleteTask(api, id);
    cleanup.tasks.deletedTasks.push({ id, ...del });
  }
  cleanup.tasks.ok = cleanup.tasks.deletedTasks.every(item => item.ok);

  if (created?.registerTemplateId) {
    let delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
    for (let attempt = 1; !delRegister.ok && attempt <= 3; attempt++) {
      const msg = String(delRegister?.body?.msg || "");
      if (!msg.includes("该报名模版已经被(") || !msg.includes(")使用")) break;
      await sleepMs(1200 * attempt);
      delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
    }
    cleanup.registerTemplate = delRegister;
  }

  return cleanup;
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

  const created = { applyConfigId: "", registerTemplateId: "", taskIds: [], taskId: "", activityId: "", activityAlias: "" };
  let api = null;
  let template = null;
  let draftChecks = null;
  const fullVerify = { online: null, offline: null };
  let cleanup = null;
  let error = null;
  try {
    api = await createAdminApiSession({ config, requireApiLogin: true });

    // 0) resolve template (payload baseline only)
    template = await resolveTemplate(api, args.templateAlias);
    const miningListCount = Array.isArray(template.detail?.miningList) && template.detail.miningList.length ? template.detail.miningList.length : 1;
    const taskCount = Math.max(1, Math.min(5, miningListCount));

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
    const registerRes = await runChildJson(registerScriptArgs, { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!registerRes.ok) throw new Error(`Create register template failed: ${registerRes.json?.error || registerRes.stderr || registerRes.stdout}`);
    const createdTemplates = Array.isArray(registerRes.json?.created) ? registerRes.json.created : [];
    const registerId = String(createdTemplates[0]?.id || "");
    if (!registerId) throw new Error("Create register template ok but id missing in output");
    created.registerTemplateId = registerId;
    created.applyConfigId = registerId;

    // 2) tasks (one per miningList item to avoid backend "任务配置重复")
    for (let i = 0; i < taskCount; i += 1) {
      const taskRes = await runChildJson(
        [
          "skills/weex-admin-ops/scripts/create-contract-mining-trading-mining-task-fast-api.mjs",
          "--confirm-create",
          "--name-prefix",
          `合约挖矿_主任务_${i + 1}_${ts}`,
        ],
        { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } },
      );
      if (!taskRes.ok) throw new Error(`Create contract mining task failed: ${taskRes.json?.error || taskRes.stderr || taskRes.stdout}`);
      const taskId = String(taskRes.json?.created?.id || "");
      if (!taskId) throw new Error("Create contract mining task ok but id missing in output");
      created.taskIds.push(taskId);
    }
    created.taskId = created.taskIds[0] || "";

    // Child scripts may perform API logins that invalidate previously issued tokens.
    // Refresh the session before creating the activity to avoid intermittent business code=401.
    api = await createAdminApiSession({ config, requireApiLogin: true });

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
    draftChecks = [
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

    if (verifyLevel === "full") {
      const on = await api.post("/prod-api/activity/mining/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      fullVerify.online = { ok: on.body?.code === 200, code: on.body?.code ?? null, msg: on.body?.msg || "" };
      if (!fullVerify.online.ok) throw new Error(`online failed: ${JSON.stringify(fullVerify.online)}`);
      const off = await api.post("/prod-api/activity/mining/offline", { activityId: Number(activityId), totp: String(config.googleCode || "") });
      fullVerify.offline = { ok: off.body?.code === 200, code: off.body?.code ?? null, msg: off.body?.msg || "" };
      if (!fullVerify.offline.ok) throw new Error(`offline failed: ${JSON.stringify(fullVerify.offline)}`);
    }
  } catch (err) {
    error = err?.message || String(err);
  } finally {
    if (args.cleanup) {
      try {
        if (!api) api = await createAdminApiSession({ config, requireApiLogin: true });
        cleanup = await cleanupCreated(api, created, config);
      } catch (err) {
        cleanup = cleanup || {};
        cleanup.error = err?.message || String(err);
      }
    }
    if (api) await api.close().catch(() => {});
  }

  const cleanedUpOk = args.cleanup ? Boolean(cleanup?.activity?.ok ?? true) && Boolean(cleanup?.tasks?.ok ?? true) && Boolean(cleanup?.registerTemplate?.ok ?? true) : true;
  const ok = !error && cleanedUpOk;
  printJson({
    ok,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/contractMining/index`,
    plan,
    template: template ? { id: template.id, alias: template.alias } : null,
    created,
    draftChecks,
    fullVerify,
    cleanedUp: args.cleanup ? cleanedUpOk : false,
    cleanup,
    error,
    durationMs: Date.now() - startedAt,
  }, ok ? process.stdout : process.stderr);
  return ok ? 0 : 1;
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

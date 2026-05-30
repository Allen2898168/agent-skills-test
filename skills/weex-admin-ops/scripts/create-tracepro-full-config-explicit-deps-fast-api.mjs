#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config TRACE_PRO with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    default dimootest1-4
  --title-prefix <text>       default 小活动全配
  --alias-prefix <text>       default tp
  --start-offset-seconds <n>  default 1800 (30min)
  --end-days <n>              default 30
  --required-volume <n>       default 1 (交易量任务阈值)
  --resource-cards <n>        default 3 (资源卡数量)
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "小活动全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "tp";
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
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=TRACE_PRO&showUrl=${encodeURIComponent(templateAlias)}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: templateAlias, detail: detail.body.data };
}

function patchMiniActivityTaskConfigs(templateMiniActivity, createdTaskDetail) {
  const mini = Array.isArray(templateMiniActivity) ? JSON.parse(JSON.stringify(templateMiniActivity)) : [];
  if (!mini.length) return mini;
  if (!createdTaskDetail) return mini;
  // 选择第 1 个子活动，覆盖其 taskConfigs 为“单一任务（带奖励）”
  mini[0].taskConfigs = [createdTaskDetail];
  mini[0].taskConfig = null;
  if (typeof mini[0].completeTaskGroupCount !== "number") mini[0].completeTaskGroupCount = 1;
  return mini;
}

function buildActivityPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const window = activityWindow(args.startOffsetSeconds, args.endDays);
  const alias = String(`${args.aliasPrefix}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix}${ts.slice(-6)}`).slice(0, 120);
  const payload = stripCloneFields(templateDetail);
  payload.type = "TRACE_PRO";
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;

  // 显式绑定依赖项
  payload.applyConfigId = Number(created.applyConfigId);
  payload.applyConfig = null;
  if (Array.isArray(created.resourceCardIds) && created.resourceCardIds.length) {
    payload.resourceConfig = created.resourceCardIds.slice(0, 3).map(id => ({ id: Number(id) }));
  }
  payload.miniActivity = patchMiniActivityTaskConfigs(payload.miniActivity, created.taskDetail);

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
      task: `create-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs (requiredVolume=${args.requiredVolume}U + prize binding)`,
      resourceCards: args.resourceCards > 0 ? `resource-card-fast-api.mjs (create-min ${args.resourceCards} cards for TRACE_PRO)` : "skipped",
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
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建小活动全配置与依赖模块。");
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
	    api = await createAdminApiSession({ config, requireApiLogin: true });

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
	      `小活动报名模板_${ts}`,
	    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!registerTemplate.ok) throw new Error(`create-register-templates-fast-api.mjs failed: ${registerTemplate.json?.error || "unknown"}`);
    const createdTemplates = Array.isArray(registerTemplate.json?.created) ? registerTemplate.json.created : [];
    created.registerTemplateId = String(createdTemplates[0]?.id || "");
    created.applyConfigId = created.registerTemplateId;
    if (!created.registerTemplateId) throw new Error("No register template id returned from create-register-templates-fast-api.mjs");

    // 2) prize (create 1 bonus prize)
	    const prizes = await runChildJson([
	      "skills/weex-admin-ops/scripts/create-prizes-fast-api.mjs",
      "--category",
      "赠金",
      "--subtype",
      "赠金",
      "--count",
      "1",
      "--name-prefix",
      `小活动奖品_${ts}`,
      "--alias-prefix",
	      `tp_prize_${ts}`,
	      "--confirm-create",
	    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!prizes.ok) throw new Error(`create-prizes-fast-api.mjs failed: ${prizes.json?.error || "unknown"}`);
    const prizeIds = Array.isArray(prizes.json?.created) ? prizes.json.created.map(item => String(item?.id || "")).filter(Boolean) : [];
    created.prizeId = String(prizeIds[0] || "");
    if (!created.prizeId) throw new Error("No prize id returned from create-prizes-fast-api.mjs");

    // 3) task (with prize binding)
	    const task = await runChildJson([
	      "skills/weex-admin-ops/scripts/create-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--prize-id",
	      String(created.prizeId),
	      "--confirm-create",
	    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!task.ok) throw new Error(`create-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");
    created.taskDetail = task.json?.createdTaskDetail || null;
    if (!created.taskId || !created.taskDetail) throw new Error("No task id/detail returned from create-tracepro-trading-volume-task-with-bonus-prize-fast-api.mjs");

    // 4) resource cards (optional)
    if (args.resourceCards > 0) {
	      const cardRes = await runChildJson([
	        "skills/weex-admin-ops/scripts/resource-card-fast-api.mjs",
        "--action",
        "create-min",
        "--activity-type",
        "TRACE_PRO",
        "--count",
        String(args.resourceCards),
        "--name-prefix",
	        `资源卡_小活动_${ts}`,
	        "--confirm-create",
	      ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
      if (!cardRes.ok) throw new Error(`resource-card-fast-api.mjs create-min failed: ${cardRes.json?.error || "unknown"}`);
      const createdCards = Array.isArray(cardRes.json?.created) ? cardRes.json.created : [];
      created.resourceCardIds = createdCards.map(item => String(item?.id || "")).filter(Boolean);
      if (created.resourceCardIds.length !== args.resourceCards) {
        throw new Error(`resource-card-fast-api.mjs create-min created ${created.resourceCardIds.length} cards, expected ${args.resourceCards}`);
      }
    }

    // 5) create activity with explicit binding
	    // Child scripts may perform API logins that invalidate previously issued tokens.
	    // Refresh the session before creating the activity to avoid intermittent business code=401.
	    api = await createAdminApiSession({ config, requireApiLogin: true });
    const built = buildActivityPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create TRACE_PRO activity failed: ${JSON.stringify(create.body)}`);
    const row = firstRow(await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=TRACE_PRO&showUrl=${encodeURIComponent(built.alias)}`));
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);

    const verify = await api.get(`/prod-api/activity/config/${encodeURIComponent(activityId)}`);
    const verifyItem = verify.body?.data || null;

	    const draftChecks = await runChildJson([
	      "skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs",
      "--action",
      "draft-checks",
	      "--activity-id",
	      String(activityId),
	    ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
    if (!draftChecks.ok) throw new Error(`tracepro-activity-fast-api.mjs draft-checks failed: ${draftChecks.json?.error || "unknown"}`);

    let fullVerify = null;
    if (verifyLevel === "full") {
	      const online = await runChildJson([
	        "skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs",
        "--action",
        "online",
	        "--activity-id",
	        String(activityId),
	      ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
      if (!online.ok) throw new Error(`tracepro-activity-fast-api.mjs online failed: ${online.json?.error || "unknown"}`);
	      const offline = await runChildJson([
	        "skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs",
        "--action",
        "offline",
	        "--activity-id",
	        String(activityId),
	      ], { envOverrides: { WEEX_ADMIN_AUTHORIZATION: api.authorization } });
      if (!offline.ok) throw new Error(`tracepro-activity-fast-api.mjs offline failed: ${offline.json?.error || "unknown"}`);
      fullVerify = { online: { ok: true }, offline: { ok: true } };
    }

    const evidence = {
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/copyTrading`,
      created: {
        activityId,
        showUrl: built.alias,
        title: built.title,
        startTime: built.window.start,
        endTime: built.window.end,
        applyConfigId: created.applyConfigId,
        registerTemplateId: created.registerTemplateId,
        prizeId: created.prizeId,
        taskId: created.taskId,
        resourceCardIds: created.resourceCardIds,
      },
      verifyHints: {
        status: verifyItem?.status || null,
        type: verifyItem?.type || null,
        applyConfigId: verifyItem?.applyConfigId ?? null,
        miniActivityCount: Array.isArray(verifyItem?.miniActivity) ? verifyItem.miniActivity.length : null,
        resourceConfigCount: Array.isArray(verifyItem?.resourceConfig) ? verifyItem.resourceConfig.length : null,
        draftChecksOk: Boolean(draftChecks.ok),
        fullVerify,
      },
      dependencyIds: {
        createdRegisterTemplateId: created.registerTemplateId,
        createdPrizeId: created.prizeId,
        createdTaskId: created.taskId,
        createdResourceCardIds: created.resourceCardIds,
        template: { activityId: template.id, alias: template.alias },
      },
      plan,
    };

    if (!args.cleanup) {
      printJson({ ...evidence, cleanedUp: false, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除刚创建的活动与依赖模块。");

    const cleanup = {
      rebindApplyTemplate: await rebindApplyTemplateToDefault(api, activityId, { defaultApplyConfigId: 2442 }).catch(err => ({
        ok: false,
        error: err?.message || String(err),
      })),
      deleteActivity: await deleteTraceProActivity(api, activityId, config),
      deleteTask: await deleteTask(api, created.taskId),
      deletePrize: await deletePrize(api, created.prizeId),
      deleteRegisterTemplate: { ok: true, skipped: true },
      deleteResourceCards: created.resourceCardIds.length ? await Promise.all(created.resourceCardIds.map(id => deleteResourceCard(api, id))) : [],
    };
    if (created.registerTemplateId) {
      let delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
      for (let attempt = 1; !delRegister.ok && attempt <= 3; attempt++) {
        const msg = String(delRegister?.body?.msg || "");
        if (!msg.includes("该报名模版已经被(") || !msg.includes(")使用")) break;
        await sleepMs(1200 * attempt);
        delRegister = await deleteRegisterTemplate(api, created.registerTemplateId);
      }
      cleanup.deleteRegisterTemplate = delRegister;
    }
    const ok =
      cleanup.deleteActivity.ok
      && cleanup.deleteTask.ok
      && cleanup.deletePrize.ok
      && cleanup.deleteRegisterTemplate.ok
      && cleanup.deleteResourceCards.every(item => item.ok);
    printJson({ ...evidence, cleanedUp: ok, cleanup, durationMs: Date.now() - startedAt }, ok ? process.stdout : process.stderr);
    await api.close();
    api = null;
    return ok ? 0 : 1;
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

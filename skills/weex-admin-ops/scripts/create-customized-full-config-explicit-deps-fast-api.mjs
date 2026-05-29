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
  node skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config CUSTOMIZED with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    optional; if omitted, auto-pick first CUSTOMIZED activity as template baseline
  --title-prefix <text>       default 定制活动全配
  --alias-prefix <text>       default cz
  --start-offset-seconds <n>  default 1800 (30min)
  --end-days <n>              default 30
  --required-volume <n>       default 1 (交易量任务阈值)
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "定制活动全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "cz";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
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
    const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CUSTOMIZED&showUrl=${encodeURIComponent(templateAlias)}`);
    const row = firstRow(list);
    const id = row?.activityId || row?.id;
    if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
    const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
    if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
    return { id: String(id), alias: templateAlias, detail: detail.body.data };
  }
  const list = await api.get("/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CUSTOMIZED");
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error("未找到可用于 clone 的 CUSTOMIZED 活动模板（活动列表为空）；请先在后管创建至少 1 个定制化活动。");
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

function buildActivityPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const alias = String(`${args.aliasPrefix || "cz"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix || "定制活动"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(templateDetail);
  payload.type = "CUSTOMIZED";
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if (!payload.channelCategory) payload.channelCategory = "UNIVERSAL";
  payload.applyConfigId = Number(created.applyConfigId);
  payload.applyConfig = { id: Number(created.applyConfigId) };
  payload.taskConfig = [{ id: Number(created.taskId) }];
  payload.showActivityCalendar = payload.showActivityCalendar ?? 1;
  patchActivityI18n(payload, { title, subTitle });

  return { alias, title, subTitle, window, payload };
}

async function deleteCustomizedActivity(api, activityId, config) {
  const del = await api.post("/prod-api/activity/customized/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
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
      task: `create-customized-trading-volume-task-fast-api.mjs (requiredVolume=${args.requiredVolume}U)`,
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
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建定制化活动全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = { applyConfigId: "", registerTemplateId: "", taskId: "", taskDetail: null };
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
      `定制活动报名模板_${ts}`,
    ]);
    if (!registerTemplate.ok) throw new Error(`create-register-templates-fast-api.mjs failed: ${registerTemplate.json?.error || "unknown"}`);
    const createdTemplates = Array.isArray(registerTemplate.json?.created) ? registerTemplate.json.created : [];
    created.registerTemplateId = String(createdTemplates[0]?.id || "");
    created.applyConfigId = created.registerTemplateId;
    if (!created.registerTemplateId) throw new Error("No register template id returned from create-register-templates-fast-api.mjs");

    // 2) task (trading volume)
    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-customized-trading-volume-task-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    if (!task.ok) throw new Error(`create-customized-trading-volume-task-fast-api.mjs failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");
    created.taskDetail = task.json?.createdTaskDetail || null;
    if (!created.taskId || !created.taskDetail) throw new Error("No task id/detail returned from create-customized-trading-volume-task-fast-api.mjs");

    // 3) create activity with explicit binding
    api = await createAdminApiSession({ config, requireApiLogin: true });
    const built = buildActivityPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create CUSTOMIZED activity failed: ${JSON.stringify(create.body)}`);
    const row = firstRow(await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=CUSTOMIZED&showUrl=${encodeURIComponent(built.alias)}`));
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);

    const verify = await api.get(`/prod-api/activity/config/${encodeURIComponent(activityId)}`);
    const verifyItem = verify.body?.data || null;

    const draftChecks = await runChildJson([
      "skills/weex-admin-ops/scripts/customized-activity-fast-api.mjs",
      "--action",
      "draft-checks",
      "--activity-id",
      String(activityId),
    ]);
    if (!draftChecks.ok) throw new Error(`customized-activity-fast-api.mjs draft-checks failed: ${draftChecks.json?.error || "unknown"}`);

    let fullVerify = null;
    if (verifyLevel === "full") {
      const online = await runChildJson([
        "skills/weex-admin-ops/scripts/customized-activity-fast-api.mjs",
        "--action",
        "online",
        "--activity-id",
        String(activityId),
      ]);
      if (!online.ok) throw new Error(`customized-activity-fast-api.mjs online failed: ${online.json?.error || "unknown"}`);
      const offline = await runChildJson([
        "skills/weex-admin-ops/scripts/customized-activity-fast-api.mjs",
        "--action",
        "offline",
        "--activity-id",
        String(activityId),
      ]);
      if (!offline.ok) throw new Error(`customized-activity-fast-api.mjs offline failed: ${offline.json?.error || "unknown"}`);
      fullVerify = { online: { ok: true }, offline: { ok: true } };
    }

    const evidence = {
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/commission`,
      created: {
        activityId,
        showUrl: built.alias,
        title: built.title,
        startTime: built.window.start,
        endTime: built.window.end,
        applyConfigId: created.applyConfigId,
        registerTemplateId: created.registerTemplateId,
        taskId: created.taskId,
      },
      verifyHints: {
        status: verifyItem?.status || null,
        type: verifyItem?.type || null,
        applyConfigId: verifyItem?.applyConfigId ?? null,
        taskConfigCount: Array.isArray(verifyItem?.taskConfig) ? verifyItem.taskConfig.length : null,
        draftChecksOk: Boolean(draftChecks.ok),
        fullVerify,
      },
      dependencyIds: {
        createdRegisterTemplateId: created.registerTemplateId,
        createdTaskId: created.taskId,
        template: { activityId: template.id, alias: template.alias || null },
      },
      plan,
    };

    if (!args.cleanup) {
      printJson({ ...evidence, cleanedUp: false, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除刚创建的活动与依赖模块。");

    const cleanup = {
      deleteActivity: await deleteCustomizedActivity(api, activityId, config),
      deleteTask: await deleteTask(api, created.taskId),
      deleteRegisterTemplate: created.registerTemplateId ? await deleteRegisterTemplate(api, created.registerTemplateId) : { ok: true, skipped: true },
    };
    const ok =
      cleanup.deleteActivity.ok
      && cleanup.deleteTask.ok
      && cleanup.deleteRegisterTemplate.ok;
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


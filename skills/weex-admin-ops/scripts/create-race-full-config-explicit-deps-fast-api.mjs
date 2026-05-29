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
  node skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config RACE_COMPETITION with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --verify-level <min|full>   default min; full includes online->offline verification (requires extra confirm)
  --confirm-full-verify       required when --verify-level=full
  --cleanup
  --confirm-cleanup
  --template-alias <alias>    default jyjss-4
  --title-prefix <text>       default 竞速赛全配
  --alias-prefix <text>       default rc
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
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "jyjss-4";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "竞速赛全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "rc";
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
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=RACE_COMPETITION&showUrl=${encodeURIComponent(templateAlias)}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: templateAlias, detail: detail.body.data };
}

function buildActivityPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const window = activityWindow(args.startOffsetSeconds, args.endDays);
  const alias = String(`${args.aliasPrefix}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(`${args.titlePrefix}${ts.slice(-6)}`).slice(0, 60);
  const payload = stripCloneFields(templateDetail);
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;

  payload.type = "RACE_COMPETITION";
  payload.applyConfigId = Number(created.applyConfigId);

  // 竞速数据：双写，兼容历史字段
  payload.rankType = "TRADING";
  payload.raceParams = {
    ...(payload.raceParams || {}),
    rankType: "TRADING",
    isParticipantsNum: 0,
    isTotalPricePoolAmount: 0,
    totalPricePoolAmount: null,
  };

  payload.bonusPoolType = "FIXED";
  payload.raceRankingParams = { isShow: 1, minRank: 1, maxRank: 10 };
  payload.raceFixBonusPoolParams = [
    {
      stageId: 1,
      taskId: Number(created.taskId),
      rewardNum: 2147483647,
      dynamicsPicture: null,
      isRewardNum: 0,
      requirements: [],
      prizeId: Number(created.prizeId),
    },
  ];

  return { alias, title, window, payload };
}

async function deleteRaceActivity(api, activityId, config) {
  const del = await api.post("/prod-api/activity/competition/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
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
      task: `create-race-trading-volume-task-fast-api.mjs (requiredVolume=${args.requiredVolume}U)`,
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
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建交易竞速赛全配置与依赖模块。");
  if (verifyLevel === "full" && !args.confirmFullVerify) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = { applyConfigId: "", registerTemplateId: "", taskId: "", prizeId: "" };
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
      `竞速赛报名模板_${ts}`,
    ]);
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
      `竞速赛奖品_${ts}`,
      "--alias-prefix",
      `rc_prize_${ts}`,
    ]);
    if (!prizes.ok) throw new Error(`create-prizes-fast-api.mjs failed: ${prizes.json?.error || "unknown"}`);
    const prizeIds = Array.isArray(prizes.json?.created) ? prizes.json.created.map(item => String(item?.id || "")).filter(Boolean) : [];
    created.prizeId = String(prizeIds[0] || "");
    if (!created.prizeId) throw new Error("No prize id returned from create-prizes-fast-api.mjs");

    // 3) task
    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-race-trading-volume-task-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    if (!task.ok) throw new Error(`create-race-trading-volume-task-fast-api.mjs failed: ${task.json?.error || "unknown"}`);
    created.taskId = String(task.json?.created?.id || "");
    if (!created.taskId) throw new Error("No task id returned from create-race-trading-volume-task-fast-api.mjs");

    // 4) create activity with explicit binding
    api = await createAdminApiSession({ config, requireApiLogin: true });
    const built = buildActivityPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create race competition activity failed: ${JSON.stringify(create.body)}`);
    const row = firstRow(await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=RACE_COMPETITION&showUrl=${encodeURIComponent(built.alias)}`));
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);

    const verify = await api.get(`/prod-api/activity/config/${encodeURIComponent(activityId)}`);
    const verifyItem = verify.body?.data || null;

    const draftChecks = await runChildJson([
      "skills/weex-admin-ops/scripts/race-activity-fast-api.mjs",
      "--action",
      "draft-checks",
      "--activity-id",
      String(activityId),
    ]);
    if (!draftChecks.ok) throw new Error(`race-activity-fast-api.mjs draft-checks failed: ${draftChecks.json?.error || "unknown"}`);

    let fullVerify = null;
    if (verifyLevel === "full") {
      const online = await runChildJson([
        "skills/weex-admin-ops/scripts/race-activity-fast-api.mjs",
        "--action",
        "online",
        "--activity-id",
        String(activityId),
      ]);
      if (!online.ok) throw new Error(`race-activity-fast-api.mjs online failed: ${online.json?.error || "unknown"}`);
      const offline = await runChildJson([
        "skills/weex-admin-ops/scripts/race-activity-fast-api.mjs",
        "--action",
        "offline",
        "--activity-id",
        String(activityId),
      ]);
      if (!offline.ok) throw new Error(`race-activity-fast-api.mjs offline failed: ${offline.json?.error || "unknown"}`);
      fullVerify = { online: { ok: true }, offline: { ok: true } };
    }

    const evidence = {
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/speedRace`,
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
      },
      verifyHints: {
        status: verifyItem?.status || null,
        type: verifyItem?.type || null,
        applyConfigId: verifyItem?.applyConfigId ?? null,
        rankType: verifyItem?.rankType ?? verifyItem?.raceParams?.rankType ?? null,
        stage0: Array.isArray(verifyItem?.raceFixBonusPoolParams) ? verifyItem.raceFixBonusPoolParams[0] : null,
        draftChecksOk: Boolean(draftChecks.ok),
        fullVerify,
      },
      dependencyIds: {
        createdRegisterTemplateId: created.registerTemplateId,
        createdPrizeId: created.prizeId,
        createdTaskId: created.taskId,
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
      deleteActivity: await deleteRaceActivity(api, activityId, config),
      deleteTask: await deleteTask(api, created.taskId),
      deletePrize: await deletePrize(api, created.prizeId),
      deleteRegisterTemplate: created.registerTemplateId ? await deleteRegisterTemplate(api, created.registerTemplateId) : { ok: true, skipped: true },
    };
    const ok =
      cleanup.deleteActivity.ok
      && cleanup.deleteTask.ok
      && cleanup.deletePrize.ok
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


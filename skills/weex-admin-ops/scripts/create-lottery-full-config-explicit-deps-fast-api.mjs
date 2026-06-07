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
  node skills/weex-admin-ops/scripts/create-lottery-full-config-explicit-deps-fast-api.mjs --dry-run

  # Create full-config lottery activity with explicitly created deps (writes)
  node skills/weex-admin-ops/scripts/create-lottery-full-config-explicit-deps-fast-api.mjs --confirm-create

  # Create + cleanup (recommended for validation runs)
  node skills/weex-admin-ops/scripts/create-lottery-full-config-explicit-deps-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --cleanup
  --confirm-cleanup
  --template-alias <alias>   default lf25085715
  --title-prefix <text>      default 转盘全配
  --alias-prefix <text>      default lx
  --raffle-style <style>     optional: CIRCLE|DART|EASTER_EGG|CIRCULAR_RECORD|WORLD_CUP_KICK_BALL (or empty to keep template)
  --apply-template-id <id>   optional: reuse an existing applyConfigId (recommended for cleanup runs)
  --create-apply-template    optional: create a new apply template and bind it (NOTE: backend may block deleting once referenced)
  --start-offset-seconds <n> default 1800 (30min)
  --end-days <n>             default 30
  --tasks-scopes <csv>       default all,vip,newuser
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create", "--cleanup", "--confirm-cleanup", "--create-apply-template"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.cleanup = Boolean(args.cleanup);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "lf25085715";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "转盘全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "lx";
  args.raffleStyle = args.raffleStyle ? String(args.raffleStyle) : "";
  args.applyTemplateId = args.applyTemplateId ? String(args.applyTemplateId) : "";
  args.createApplyTemplate = Boolean(args.createApplyTemplate);
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  args.tasksScopes = String(args.tasksScopes || "all,vip,newuser")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
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
      resolve({
        ok: code === 0 && Boolean(parsed?.ok !== false),
        code,
        killedByTimeout,
        stdout,
        stderr,
        json: parsed,
      });
    });
  });
}

async function resolveTemplate(api, templateAlias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=LOTTERY&showUrl=${encodeURIComponent(templateAlias)}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Template lottery activity not found by alias: ${templateAlias}`);
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: String(templateAlias), detail: detail.body.data };
}

function pickLotteryAlias(prefix) {
  return String(`${prefix}${Date.now().toString().slice(-8)}`).slice(0, 10);
}

function buildLotteryPayloadFromTemplate({ templateDetail, args, created }) {
  const ts = buildSuffix();
  const alias = pickLotteryAlias(args.aliasPrefix);
  const title = String(`${args.titlePrefix}${ts.slice(-6)}`).slice(0, 15);
  const window = activityWindow(args.startOffsetSeconds, args.endDays);
  const payload = stripCloneFields(templateDetail);

  payload.type = "LOTTERY";
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if (Array.isArray(payload.periods) && payload.periods[0]) {
    if ("startTime" in payload.periods[0]) payload.periods[0].startTime = window.start;
    if ("endTime" in payload.periods[0]) payload.periods[0].endTime = window.end;
  }

  // 显式绑定：报名模板 / 任务 / 奖品
  payload.applyConfigId = Number(created.applyTemplateId);

  const taskConfig = (created.taskIds || []).slice(0, 5).map((id, index) => ({ id: Number(id), order: index + 1 }));
  payload.taskConfig = taskConfig;

  // 不启用“新手活动合约任务”虚拟开关（保持最小稳定配置）
  payload.showBeginnerTaskConfig = [];

  if (args.raffleStyle && "raffleStyle" in payload) payload.raffleStyle = args.raffleStyle;

  // 预报名默认关闭，避免额外依赖（可由模板/后续动作覆盖）
  payload.isPreApply = 0;
  payload.preApplyConfigId = "";
  payload.preApplyStartTime = "";
  payload.preApplyEndTime = "";
  if (payload.preApplyConfig && typeof payload.preApplyConfig === "object") payload.preApplyConfig = { id: "" };

  const prizeIds = Array.isArray(created.prizeIds) ? created.prizeIds : [];
  if (Array.isArray(payload.prize) && payload.prize.length === 8 && prizeIds.length) {
    const mapped = Array(8).fill(null).map((_, idx) => prizeIds[idx % prizeIds.length]);
    payload.prize = payload.prize.map((record, idx) => ({
      ...record,
      prizeType: 4,
      linkPrizeId: Number(mapped[idx]),
      // 后端可能会使用 prizeName 展示；这里保持与 linkPrizeId 对齐的最小可读值
      prizeName: record?.prizeName || `prize_${mapped[idx]}`,
    }));
  }

  return { alias, title, window, payload };
}

async function deleteLotteryActivity(api, activityId, config) {
  const del = await api.post("/prod-api/activity/lottery/delete", { activityId: Number(activityId), totp: String(config.googleCode || "") });
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

async function deleteApplyTemplate(api, id) {
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

  const plan = {
    mode: "headless_api",
    templateAlias: args.templateAlias,
    dependencyCreates: {
      prizes: "create-regression-prizes-fast-api.mjs (4 prizes, reused across 8 slots)",
      applyTemplate: args.createApplyTemplate
        ? "create-register-templates-fast-api.mjs (1 template: all + auto_manual + none)"
        : args.applyTemplateId
          ? `reuse apply template id=${args.applyTemplateId}`
          : "reuse template.applyConfigId",
      tasks: `create-roulette-participant-scope-tasks-fast-api.mjs (scopes=${args.tasksScopes.join(",")})`,
    },
    activity: {
      titlePrefix: args.titlePrefix,
      aliasPrefix: args.aliasPrefix,
      raffleStyle: args.raffleStyle || "<keep template>",
      window: activityWindow(args.startOffsetSeconds, args.endDays),
    },
    writes: { create: true, cleanup: Boolean(args.cleanup) },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建转盘抽奖全配置与依赖模块。");

  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const created = {
    prizeIds: [],
    applyTemplateId: "",
    taskIds: [],
    applyTemplateCreated: false,
  };

  let api = null;
  try {
    // 注意：后台 token 可能在重复登录后失效。依赖创建脚本会执行登录，因此这里把“读取模板”和“创建/清理活动”拆成两段会话。
    const apiForTemplate = await createAdminApiSession({ config, requireApiLogin: true });
    const template = await resolveTemplate(apiForTemplate, args.templateAlias);
    await apiForTemplate.close();

    // 1) prizes
    const prizes = await runChildJson(["skills/weex-admin-ops/scripts/create-regression-prizes-fast-api.mjs"]);
    if (!prizes.ok) throw new Error(`create-regression-prizes-fast-api.mjs failed: ${prizes.json?.error || "unknown"}`);
    const prizeIds = Array.isArray(prizes.json?.created) ? prizes.json.created.map(item => String(item?.id || "")).filter(Boolean) : [];
    if (!prizeIds.length) throw new Error("No prize ids returned from create-regression-prizes-fast-api.mjs");
    created.prizeIds = prizeIds;

    // 2) apply template
    if (args.applyTemplateId) {
      created.applyTemplateId = args.applyTemplateId;
    } else if (!args.createApplyTemplate) {
      const fromTemplate = String(template.detail?.applyConfigId ?? "");
      if (!fromTemplate) throw new Error("template activity is missing applyConfigId; please pass --apply-template-id or --create-apply-template");
      created.applyTemplateId = fromTemplate;
    } else {
      const apply = await runChildJson([
        "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
        "--platform-scopes",
        "all",
        "--restrict-scopes",
        "none",
        "--signup-modes",
        "auto_manual",
        "--permissions",
        "none",
        "--name-prefix",
        `报名模板_转盘全配_${timestamp().slice(-6)}`,
      ]);
      if (!apply.ok) throw new Error(`create-register-templates-fast-api.mjs failed: ${apply.json?.error || "unknown"}`);
      const applyId = String(apply.json?.created?.[0]?.id || "");
      if (!applyId) throw new Error("No apply template id returned from create-register-templates-fast-api.mjs");
      created.applyTemplateId = applyId;
      created.applyTemplateCreated = true;
    }

    // 3) tasks
    const tasks = await runChildJson([
      "skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks-fast-api.mjs",
      "--scopes",
      args.tasksScopes.join(","),
      "--name-prefix",
      `转盘抽奖全配_${timestamp().slice(-6)}`,
    ]);
    if (!tasks.ok) throw new Error(`create-roulette-participant-scope-tasks-fast-api.mjs failed: ${tasks.json?.error || "unknown"}`);
    const taskIds = Array.isArray(tasks.json?.created) ? tasks.json.created.map(item => String(item?.id || "")).filter(Boolean) : [];
    if (!taskIds.length) throw new Error("No task ids returned from create-roulette-participant-scope-tasks-fast-api.mjs");
    created.taskIds = taskIds;

    // 4) create activity with explicit binding
    api = await createAdminApiSession({ config, requireApiLogin: true });
    const built = buildLotteryPayloadFromTemplate({ templateDetail: template.detail, args, created });
    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create lottery activity failed: ${JSON.stringify(create.body)}`);
    const row = firstRow(await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=LOTTERY&showUrl=${encodeURIComponent(built.alias)}`));
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);
    const verify = await api.get(`/prod-api/activity/config/${encodeURIComponent(activityId)}`);
    const verifyItem = verify.body?.data || null;

    const evidence = {
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/lottery`,
      created: {
        activityId,
        showUrl: built.alias,
        title: built.title,
        startTime: built.window.start,
        endTime: built.window.end,
        applyConfigId: created.applyTemplateId,
        taskIdsUsed: created.taskIds.slice(0, 5),
        prizeIdsUsed: created.prizeIds,
      },
      verifyHints: {
        status: verifyItem?.status || null,
        raffleStyle: verifyItem?.raffleStyle || null,
        prizeCount: Array.isArray(verifyItem?.prize) ? verifyItem.prize.length : null,
        taskConfigCount: Array.isArray(verifyItem?.taskConfig) ? verifyItem.taskConfig.length : null,
      },
      dependencyIds: {
        applyTemplateId: created.applyTemplateId,
        applyTemplateCreated: created.applyTemplateCreated,
        createdTaskIds: created.taskIds,
        createdPrizeIds: created.prizeIds,
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
      deleteActivity: await deleteLotteryActivity(api, activityId, config),
      deleteApplyTemplate: created.applyTemplateCreated
        ? await deleteApplyTemplate(api, created.applyTemplateId)
        : { ok: true, status: null, body: { code: null, msg: "skipped (reused existing apply template)" } },
      deleteTasks: await Promise.all(created.taskIds.map(id => deleteTask(api, id))),
      deletePrizes: await Promise.all(created.prizeIds.map(id => deletePrize(api, id))),
    };
    const ok =
      cleanup.deleteActivity.ok &&
      cleanup.deleteApplyTemplate.ok &&
      cleanup.deleteTasks.every(item => item.ok) &&
      cleanup.deletePrizes.every(item => item.ok);

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

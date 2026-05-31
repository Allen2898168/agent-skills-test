#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/configure-monopoly-multiplier-coupon-task-by-showurl-api.mjs --show-url <alias>

Options:
  --show-url <alias>           Monopoly showUrl / 互动别名 (e.g. tonk-26)
  --task-name <name>           Default task name (used for OFFICIAL_WEBSITE unless overridden)
  --official-task-name <name>  Task name for OFFICIAL_WEBSITE (default: 合量(仅1次/报名后)-虚资-膨胀券)
  --channel-task-name <name>   Task name for CHANNEL (default: 现量(仅1次/报名后)-虚资-膨胀券)
  --trigger-probability <n>    0-100 (default: 100)
  --guaranteed-count <n>       positive integer (default: 1)
  --channels <list>            comma-separated: OFFICIAL_WEBSITE,CHANNEL (default: both)
  --type <type>                Activity type (default: MONOPOLY_WORLD_CUP)
  --dry-run                    Print plan only; no API writes
  --help                       Show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  args.showUrl = String(args.showUrl || "").trim();
  args.taskName = String(args.taskName || "").trim();
  args.officialTaskName = String(args.officialTaskName || "").trim();
  args.channelTaskName = String(args.channelTaskName || "").trim();
  args.triggerProbability = args.triggerProbability == null ? 100 : Number(args.triggerProbability);
  args.guaranteedCount = args.guaranteedCount == null ? 1 : Number(args.guaranteedCount);
  args.type = String(args.type || "MONOPOLY_WORLD_CUP").trim();
  args.channels = String(args.channels || "OFFICIAL_WEBSITE,CHANNEL")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (!args.help) {
    if (!args.showUrl) throw new Error("--show-url is required");
    if (!Number.isFinite(args.triggerProbability) || args.triggerProbability < 0 || args.triggerProbability > 100) {
      throw new Error("--trigger-probability must be between 0 and 100");
    }
    if (!Number.isInteger(args.guaranteedCount) || args.guaranteedCount < 1) {
      throw new Error("--guaranteed-count must be a positive integer");
    }
    if (!args.channels.length) throw new Error("--channels resolved to empty list");
  }
  return args;
}

function langPack(value) {
  return [{ lang: "zh_CN", name: value }];
}

async function listActivitiesByShowUrl(session, { type, showUrl }) {
  const qs = new URLSearchParams({ type, total: "0", pageNum: "1", pageSize: "50", showUrl });
  const res = await session.get(`/prod-api/activity/config/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`activity config list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity config list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return Array.isArray(res.body?.rows) ? res.body.rows : [];
}

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${activityId}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateActivity(session, payload) {
  const res = await session.put("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`activity update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

async function findTaskByName(session, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "5", activityType: "23", name });
  const res = await session.get(`/prod-api/activity/task/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`task list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows.find(row => String(row?.name || "") === String(name)) || null;
}

async function getTaskDetail(session, id) {
  const res = await session.get(`/prod-api/activity/task/${id}`);
  if (res.status >= 400) throw new Error(`task detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

function getTaskRequirementList(taskDetail) {
  const req = taskDetail?.requirement;
  if (Array.isArray(req)) return req;
  if (typeof req === "string") {
    try {
      const parsed = JSON.parse(req);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function assertMultiplierCouponTask(taskDetail) {
  const resetType = String(taskDetail?.resetType || taskDetail?.taskResetType || "").trim();
  if (resetType !== "ONCE") throw new Error(`Task ${taskDetail?.id} resetType must be ONCE, got ${resetType || "(empty)"}`);
  const prizeSubType = taskDetail?.taskAward?.prizeSubType;
  if (String(prizeSubType) !== "MULTIPLIER_COUPON") {
    throw new Error(`Task ${taskDetail?.id} reward must be MULTIPLIER_COUPON, got ${String(prizeSubType || "")}`);
  }
  const types = new Set(getTaskRequirementList(taskDetail).map(r => String(r?.type || "")).filter(Boolean));
  if (!(types.has("TRADING_VOLUME") || types.has("SPOT_TRADING_VOLUME"))) {
    throw new Error(`Task ${taskDetail?.id} must be TRADING_VOLUME or SPOT_TRADING_VOLUME, got ${Array.from(types).join(",") || "(none)"}`);
  }
}

function patchMultiplierCouponModule(taskConfig, { taskId, triggerProbability, guaranteedCount }) {
  const next = { ...(taskConfig || {}) };
  const moduleIntro = "膨胀券任务";
  next.multiplierCouponTask = {
    ...(next.multiplierCouponTask || {}),
    moduleIntro,
    moduleIntroI18: langPack(moduleIntro),
    triggerProbability: String(triggerProbability),
    guaranteedTriggerCount: String(guaranteedCount),
    tasks: [{ taskId: Number(taskId), sort: 1, toTopFlag: 0, weekNo: null }],
  };
  return next;
}

function resolveTaskNameByChannel(args) {
  const defaults = {
    OFFICIAL_WEBSITE: "合量(仅1次/报名后)-虚资-膨胀券",
    CHANNEL: "现量(仅1次/报名后)-虚资-膨胀券",
  };
  const base = args.taskName || "";
  return {
    OFFICIAL_WEBSITE: args.officialTaskName || base || defaults.OFFICIAL_WEBSITE,
    CHANNEL: args.channelTaskName || defaults.CHANNEL,
  };
}

function buildUpdatePayload(detail, nextMonopolyList) {
  return {
    activityId: detail.activityId,
    activityOwner: detail.activityOwner,
    configType: detail.configType,
    channelCategory: detail.channelCategory,
    guideTemplateId: detail.guideTemplateId,
    startTime: detail.startTime,
    endTime: detail.endTime,
    showUrl: detail.showUrl,
    applyConfigId: detail.applyConfigId,
    expanded: detail.expanded,
    showActivityCalendar: detail.showActivityCalendar,
    periodValidity: detail.periodValidity ?? null,
    periods: detail.periods ?? 0,
    syncCalendarFlag: detail.syncCalendarFlag ?? 0,
    syncCalendarDto: detail.syncCalendarDto ?? null,
    title: detail.title,
    subTitle: detail.subTitle,
    intro: detail.intro,
    shareContent: detail.shareContent,
    agentShareContent: detail.agentShareContent,
    type: detail.type,
    activityType: detail.activityType,
    contractTradingVolumeTaskId: detail.contractTradingVolumeTaskId ?? null,
    activityConfigI18n: detail.activityConfigI18n,
    monopolyList: nextMonopolyList,
  };
}

function verifyBound(afterDetail, { channels, taskId, triggerProbability, guaranteedCount }) {
  const list = Array.isArray(afterDetail?.monopolyList) ? afterDetail.monopolyList : [];
  for (const channelType of channels) {
    const item = list.find(v => String(v?.channelType) === String(channelType));
    if (!item) throw new Error(`verify failed: channelType=${channelType} not found`);
    const module = item?.taskConfig?.multiplierCouponTask;
    if (!module) throw new Error(`verify failed: multiplierCouponTask missing for channelType=${channelType}`);
    if (String(module.triggerProbability) !== String(triggerProbability)) {
      throw new Error(`verify failed: triggerProbability mismatch for channelType=${channelType}`);
    }
    if (String(module.guaranteedTriggerCount) !== String(guaranteedCount)) {
      throw new Error(`verify failed: guaranteedTriggerCount mismatch for channelType=${channelType}`);
    }
    const tasks = Array.isArray(module.tasks) ? module.tasks : [];
    if (tasks.length !== 1 || Number(tasks[0]?.taskId) !== Number(taskId)) {
      throw new Error(`verify failed: multiplierCouponTask.tasks mismatch for channelType=${channelType}`);
    }
  }
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const session = await createAdminApiSession({ config, requireApiLogin: true });

  try {
    const rows = await listActivitiesByShowUrl(session, { type: args.type, showUrl: args.showUrl });
    const activityIds = [...new Set(rows.map(r => Number(r?.activityId)).filter(Boolean))];
    if (!activityIds.length) throw new Error(`No activity found for showUrl=${args.showUrl} type=${args.type}`);
    if (activityIds.length > 1) throw new Error(`Multiple activities found for showUrl=${args.showUrl}: ${activityIds.join(",")}`);
    const activityId = activityIds[0];

    const taskNameByChannel = resolveTaskNameByChannel(args);
    const taskIdByChannel = {};
    for (const channelType of args.channels) {
      const name = taskNameByChannel[channelType];
      if (!name) throw new Error(`Task name missing for channelType=${channelType}`);
      const row = await findTaskByName(session, name);
      if (!row) throw new Error(`Task not found by name for channelType=${channelType}: ${name}`);
      const id = Number(row.id);
      const taskDetail = await getTaskDetail(session, id);
      assertMultiplierCouponTask(taskDetail);
      taskIdByChannel[channelType] = id;
    }
    if (args.channels.length > 1) {
      const ids = args.channels.map(c => Number(taskIdByChannel[c])).filter(Boolean);
      if (new Set(ids).size !== ids.length) throw new Error(`Task ids must be unique across channels, got: ${ids.join(",")}`);
    }

    const detail = await getActivityDetail(session, activityId);
    const monopolyList = Array.isArray(detail?.monopolyList) ? detail.monopolyList : [];
    if (!monopolyList.length) throw new Error("monopolyList is empty");

    const nextMonopolyList = monopolyList.map(item => {
      const channelType = String(item?.channelType);
      if (!args.channels.includes(channelType)) return item;
      return {
        ...item,
        taskConfig: patchMultiplierCouponModule(item?.taskConfig, {
          taskId: taskIdByChannel[channelType],
          triggerProbability: args.triggerProbability,
          guaranteedCount: args.guaranteedCount,
        }),
      };
    });

    const plan = {
      ok: true,
      dryRun: args.dryRun,
      showUrl: args.showUrl,
      activityId,
      tasks: Object.fromEntries(args.channels.map(c => [c, { id: taskIdByChannel[c], name: taskNameByChannel[c] }])),
      channels: args.channels,
      triggerProbability: args.triggerProbability,
      guaranteedCount: args.guaranteedCount,
    };

    if (args.dryRun) {
      printJson(plan);
      return 0;
    }

    await updateActivity(session, buildUpdatePayload(detail, nextMonopolyList));
    const after = await getActivityDetail(session, activityId);
    for (const channelType of args.channels) {
      verifyBound(after, {
        channels: [channelType],
        taskId: taskIdByChannel[channelType],
        triggerProbability: args.triggerProbability,
        guaranteedCount: args.guaranteedCount,
      });
    }

    printJson({ ...plan, ok: true, updated: true });
    return 0;
  } finally {
    await session.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

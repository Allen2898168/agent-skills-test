#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/extend-monopoly-worldcup-pointmilestone-weeks-activity9603-api.mjs

Options:
  --dry-run     Print plan only; no API writes
  --force       Create tasks even if same-name exists
  --help        Show help

Behavior:
  - Creates additional weekly LIMITED_TIME TRADING_VOLUME tasks (basic/advanced, DURING/AFTER)
  - Appends them into activityId=9603 (OFFICIAL_WEBSITE) pointMilestoneTask.basicTradingTask/advancedTradingTask
  - Weeks are contiguous 7-day windows (to satisfy official-site validation)
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--force", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.force = Boolean(args.force);
  args.help = Boolean(args.help);
  return args;
}

const ACTIVITY_ID = 9603;
const MONOPOLY_ACTIVITY_TYPE = "MONOPOLY_WORLD_CUP";
const ALLOW_RANGE_NONE = "NONE";
const COMPARE = "GREATER_EQUAL";
const REQUIRED_VOLUME = 10;
const AWARD_MIN = 10;
const AWARD_MAX = 100;
const RESET_TYPE_LIMITED = "LIMITED_TIME";

// No orderTypeList (do not configure order method)
const CONTRACT_ORDER_TYPES = [];
const CONTRACT_VOLUME_COUNT_TYPE = ["FEE"];

const TIME_TYPES = {
  DURING: "DURING",
  AFTER: "AFTER"
};

// Week windows (inclusive). Start time uses 08:00 to avoid timezone-induced dayCount drift on the official site.
const WEEK_WINDOWS = [
  { weekNo: 2, startTime: "2026-06-03 08:00:00", endTime: "2026-06-09 23:59:59" },
  { weekNo: 3, startTime: "2026-06-10 08:00:00", endTime: "2026-06-16 23:59:59" }
];

function langPack(value) {
  return [{ lang: "zh_CN", name: value }];
}

function baseTaskFields(name) {
  return {
    name,
    nameI18: langPack(name),
    content: name,
    contentI18: langPack(name),
    label: null,
    labelI18: [{ lang: "zh_CN", name: null }],
    labelDesc: null,
    labelDescI18: [{ lang: "zh_CN", name: null }],
    remark: name
  };
}

function taskRangeFields() {
  return {
    activityType: MONOPOLY_ACTIVITY_TYPE,
    allowRange: [ALLOW_RANGE_NONE],
    conditions: {
      allowRangeLogic: null,
      allowAgentList: [],
      allowAreaList: [],
      allowUserList: [],
      newUser: null,
      oldUser: null
    },
    taskRisk: ["AUTO"],
    dynamicAuditConfig: {
      applyCountryIds: [],
      hardRiskLabels: [],
      riskTotalScoreThreshold: null,
      inviteCodes: [],
      agencyGroupIds: [],
      onRiskServiceError: "TRIGGER_MANUAL",
      scoreRiskLabels: [],
      triggerMode: "ANY"
    },
    kycRiskAreaIds: [],
    isLivenessEnabled: "NO",
    livenessConfig: {
      isPartialTriggerEnabled: "NO",
      limitedAreaIdList: [],
      limitedRange: [],
      mustTriggerCondition: [],
      riskControlLabels: [],
      riskControlTotalScore: null,
      triggerCondition: [],
      triggerProbability: null
    },
    linkTaskId: null,
    awardImage: ""
  };
}

function requirementsFormFields(requirement) {
  return {
    completeTaskGroupCount: 1,
    taskGroupType: null,
    isSameLinkUrl: null,
    requirement: [requirement]
  };
}

function additionalFields() {
  return { resetType: RESET_TYPE_LIMITED, resetDay: null, resetTime: null };
}

function taskAwardFields({ awardPrize }) {
  return {
    taskAward: {
      awardMode: "SINGLE",
      awardPrizeId: awardPrize.id,
      prizeType: awardPrize.prizeType,
      prizeSubType: awardPrize.prizeSubType,
      multiplier: awardPrize.multiplier ?? null,
      awardAmountMin: AWARD_MIN,
      awardAmountMax: AWARD_MAX,
      awardAmount: null,
      dailyLimit: null,
      totalLimit: null,
      compensationRatioType: null,
      rewardOrderCreated: null
    }
  };
}

function buildTradingVolumeRequirement({ timeType, startTime, endTime }) {
  return {
    type: "TRADING_VOLUME",
    timeType,
    startTime,
    endTime,
    progressType: null,
    linkTaskId: null,
    allowVipWhiteType: null,
    limitVipLevelList: [],
    isMultiplierCoupon: 0,
    multiplier: null,
    verifyType: COMPARE,
    requiredVolume: REQUIRED_VOLUME,
    currencySupportType: "ALL_SUPPORTED",
    productCodeList: [],
    productCodeNameList: [],
    volumeCountType: CONTRACT_VOLUME_COUNT_TYPE,
    orderTypeList: CONTRACT_ORDER_TYPES,
    isFirst: 0
  };
}

function buildPlannedTasks({ integralPrize }) {
  const plan = [];
  for (const window of WEEK_WINDOWS) {
    for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
      const timeLabel = timeType === TIME_TYPES.DURING ? "活动开始" : "报名后";
      plan.push({
        name: `合里程碑(基础限时第${window.weekNo}周/${timeLabel})-虚资-积分`,
        weekNo: window.weekNo,
        requirement: buildTradingVolumeRequirement({ timeType, startTime: window.startTime, endTime: window.endTime }),
        awardPrize: integralPrize,
        module: "basicTradingTask",
        timeType
      });
      plan.push({
        name: `合里程碑(进阶限时第${window.weekNo}周/${timeLabel})-虚资-积分`,
        weekNo: window.weekNo,
        requirement: buildTradingVolumeRequirement({ timeType, startTime: window.startTime, endTime: window.endTime }),
        awardPrize: integralPrize,
        module: "advancedTradingTask",
        timeType
      });
    }
  }
  return plan;
}

async function findTaskByName(session, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "5", activityType: "23", name });
  const res = await session.get(`/prod-api/activity/task/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`task list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows.find(row => String(row?.name || "") === String(name)) || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTaskWithRetry(session, payload, { maxAttempts = 20 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await session.post("/prod-api/activity/task", payload);
      if (res.status >= 400) throw new Error(`create task HTTP ${res.status}`);
      const code = Number(res.body?.code);
      if (code === 200) return res.body;
      const msg = String(res.body?.msg || res.body?.message || "");
      if (code === 500 && /系统繁忙|busy|稍后再试/i.test(msg)) {
        lastError = new Error(`create task busy (attempt ${attempt}/${maxAttempts}): ${msg || "code=500"}`);
        await sleep(8000 + 5000 * attempt);
        continue;
      }
      throw new Error(`create task rejected: ${JSON.stringify({ code, msg })}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(5000 + 3000 * attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error("createTaskWithRetry failed (no error captured)");
}

async function getActivityDetail(session) {
  const res = await session.get(`/prod-api/activity/config/${ACTIVITY_ID}`);
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

function appendWeeklyTasksIntoPointMilestone(module, newTaskIdsByWeek) {
  const tasks = Array.isArray(module?.tasks) ? [...module.tasks] : [];
  const existingIds = new Set(tasks.map(t => Number(t?.taskId)).filter(Boolean));
  let maxSort = tasks.reduce((m, t) => Math.max(m, Number(t?.sort || 0)), 0);
  const appended = [];
  for (const { weekNo, afterTaskId, duringTaskId } of newTaskIdsByWeek) {
    for (const [taskId, timeType] of [[afterTaskId, TIME_TYPES.AFTER], [duringTaskId, TIME_TYPES.DURING]]) {
      const id = Number(taskId);
      if (!id || existingIds.has(id)) continue;
      maxSort += 1;
      const entry = { taskId: id, sort: maxSort, weekNo: Number(weekNo), toTopFlag: null, __timeType: timeType };
      tasks.push(entry);
      existingIds.add(id);
      appended.push({ weekNo, taskId: id, sort: maxSort, timeType });
    }
  }
  // Keep ordering stable: sort by weekNo then by sort.
  tasks.sort((a, b) => Number(a.weekNo || 9999) - Number(b.weekNo || 9999) || Number(a.sort || 0) - Number(b.sort || 0));
  // Re-assign sort sequentially to avoid duplicates/gaps.
  tasks.forEach((t, idx) => { t.sort = idx + 1; delete t.__timeType; });
  return { nextModule: { ...module, tasks }, appended };
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
  const { chromium } = loadPlaywright();
  const session = await createAdminApiSession({ chromium, config });

  try {
    const integralRes = await session.get("/prod-api/activity/prize/1036");
    const integralData = integralRes.body?.data || integralRes.body;
    const integralPrize = { id: 1036, prizeType: integralData?.prizeType, prizeSubType: integralData?.prizeSubType, multiplier: integralData?.multiplier ?? null };

    const plan = buildPlannedTasks({ integralPrize });
    if (args.dryRun) {
      printJson({ ok: true, dryRun: true, totalTasksToCreate: plan.length, taskNames: plan.map(v => v.name), weekWindows: WEEK_WINDOWS });
      return 0;
    }

    // 1) Create/find tasks
    const created = [];
    const reused = [];
    const taskIdByName = new Map();
    for (const item of plan) {
      const exists = await findTaskByName(session, item.name);
      if (exists && !args.force) {
        taskIdByName.set(item.name, Number(exists.id));
        reused.push({ id: Number(exists.id), name: item.name });
        continue;
      }
      const payload = {
        ...baseTaskFields(item.name),
        ...taskRangeFields(),
        ...additionalFields(),
        ...requirementsFormFields(item.requirement),
        ...taskAwardFields({ awardPrize: item.awardPrize })
      };
      await createTaskWithRetry(session, payload, { maxAttempts: 30 });
      await sleep(1200);
      const verified = await findTaskByName(session, item.name);
      if (!verified) throw new Error(`verify failed: task not found by name ${item.name}`);
      taskIdByName.set(item.name, Number(verified.id));
      created.push({ id: Number(verified.id), name: item.name });
      // breathing room
      await sleep(2500);
    }

    // 2) Update activityId=9603 OFFICIAL_WEBSITE pointMilestone basic/advanced modules
    const detail = await getActivityDetail(session);
    const monopolyList = Array.isArray(detail?.monopolyList) ? detail.monopolyList : [];
    const idx = monopolyList.findIndex(v => v?.channelType === "OFFICIAL_WEBSITE");
    if (idx < 0) throw new Error("OFFICIAL_WEBSITE config not found in monopolyList");

    const official = monopolyList[idx];
    const taskConfig = official?.taskConfig || {};
    const pm = taskConfig?.pointMilestoneTask || {};
    if (!pm?.basicTradingTask || !pm?.advancedTradingTask) {
      throw new Error("pointMilestoneTask.basicTradingTask/advancedTradingTask not found");
    }

    const basicPairs = WEEK_WINDOWS.map(w => ({
      weekNo: w.weekNo,
      afterTaskId: taskIdByName.get(`合里程碑(基础限时第${w.weekNo}周/报名后)-虚资-积分`),
      duringTaskId: taskIdByName.get(`合里程碑(基础限时第${w.weekNo}周/活动开始)-虚资-积分`)
    }));
    const advancedPairs = WEEK_WINDOWS.map(w => ({
      weekNo: w.weekNo,
      afterTaskId: taskIdByName.get(`合里程碑(进阶限时第${w.weekNo}周/报名后)-虚资-积分`),
      duringTaskId: taskIdByName.get(`合里程碑(进阶限时第${w.weekNo}周/活动开始)-虚资-积分`)
    }));

    const basicResult = appendWeeklyTasksIntoPointMilestone(pm.basicTradingTask, basicPairs);
    const advancedResult = appendWeeklyTasksIntoPointMilestone(pm.advancedTradingTask, advancedPairs);

    const nextOfficial = {
      ...official,
      taskConfig: {
        ...taskConfig,
        pointMilestoneTask: {
          ...pm,
          basicTradingTask: basicResult.nextModule,
          advancedTradingTask: advancedResult.nextModule
        }
      }
    };
    const nextMonopolyList = [...monopolyList];
    nextMonopolyList[idx] = nextOfficial;

    // Build update payload (match monopoly modal.vue save shape)
    const updatePayload = {
      activityId: detail.activityId ?? ACTIVITY_ID,
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
      monopolyList: nextMonopolyList
    };

    await updateActivity(session, updatePayload);
    const after = await getActivityDetail(session);
    const afterOfficial = (after?.monopolyList || []).find(v => v?.channelType === "OFFICIAL_WEBSITE");
    const afterPm = afterOfficial?.taskConfig?.pointMilestoneTask;
    const afterBasicIds = new Set((afterPm?.basicTradingTask?.tasks || []).map(t => Number(t?.taskId)).filter(Boolean));
    const afterAdvancedIds = new Set((afterPm?.advancedTradingTask?.tasks || []).map(t => Number(t?.taskId)).filter(Boolean));
    for (const p of basicPairs) {
      if (!afterBasicIds.has(Number(p.afterTaskId)) || !afterBasicIds.has(Number(p.duringTaskId))) {
        throw new Error(`verify failed: basic week ${p.weekNo} task ids not found in activity config`);
      }
    }
    for (const p of advancedPairs) {
      if (!afterAdvancedIds.has(Number(p.afterTaskId)) || !afterAdvancedIds.has(Number(p.duringTaskId))) {
        throw new Error(`verify failed: advanced week ${p.weekNo} task ids not found in activity config`);
      }
    }

    printJson({
      ok: true,
      createdCount: created.length,
      reusedCount: reused.length,
      activityId: ACTIVITY_ID,
      appended: {
        basic: basicResult.appended,
        advanced: advancedResult.appended
      }
    });
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

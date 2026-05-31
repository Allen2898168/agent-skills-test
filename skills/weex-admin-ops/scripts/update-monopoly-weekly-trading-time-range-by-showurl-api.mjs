#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/update-monopoly-weekly-trading-time-range-by-showurl-api.mjs --show-url <alias> [--week1-end "YYYY-MM-DD HH:mm:ss"] [--shift-back "HH:MM"]

Options:
  --show-url <alias>       Monopoly showUrl / 互动别名 (e.g. tonk-25)
  --week1-end <datetime>   Week1 endTime (YYYY-MM-DD HH:mm:ss)
  --shift-back <HH:MM>     Shift all weekly ranges earlier by duration (e.g. 22:50)
  --day-boundary           Force week windows to use 00:00:00 ~ 23:59:59 (recommended for week switching tests)
  --type <type>            Activity type (default: MONOPOLY_WORLD_CUP)
  --dry-run                Print plan only; no API writes
  --help                   Show help

Behavior:
  - Finds monopoly activities by showUrl
  - For each activity, loads pointMilestoneTask.basicTradingTask/advancedTradingTask weekly tasks
  - Updates TRADING_VOLUME requirement.startTime/endTime for weekNo 1/2/3 windows:
      - If --shift-back is provided: derive new windows by shifting existing week1/2/3 time-of-day earlier, while enforcing official-site dayCount=7 rules
      - Else: week1 ends at --week1-end, and week2/week3 are derived contiguously (day-based, dayCount=7)
  - Applies updates to all involved taskIds (deduped), then verifies by re-fetch
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help", "--day-boundary"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  args.showUrl = String(args.showUrl || "").trim();
  args.week1End = String(args.week1End || args.week1EndTime || "").trim();
  args.shiftBack = String(args.shiftBack || args.shift || "").trim();
  args.type = String(args.type || "MONOPOLY_WORLD_CUP").trim();
  args.dayBoundary = Boolean(args.dayBoundary);
  if (!args.help) {
    if (!args.showUrl) throw new Error("--show-url is required");
    if (!args.week1End && !args.shiftBack) throw new Error("Either --week1-end or --shift-back is required");
  }
  return args;
}

function parseDateTimeToUtcMs(text) {
  const m = String(text || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid datetime (expected YYYY-MM-DD HH:mm:ss): ${text}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

function formatUtcMsToDateTime(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function addSecondsUtc(text, seconds) {
  const ms = parseDateTimeToUtcMs(text);
  return formatUtcMsToDateTime(ms + Number(seconds) * 1000);
}

function shiftUtc(text, deltaMs) {
  const ms = parseDateTimeToUtcMs(text);
  return formatUtcMsToDateTime(ms + Number(deltaMs));
}

function dateKeyFromDateTime(text) {
  return String(text || "").trim().slice(0, 10);
}

function addDaysToDateKey(dateKey, days) {
  const m = String(dateKey || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Invalid dateKey (expected YYYY-MM-DD): ${dateKey}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const base = Date.UTC(y, mo - 1, d, 0, 0, 0);
  const next = base + Number(days) * 24 * 60 * 60 * 1000;
  return formatUtcMsToDateTime(next).slice(0, 10);
}

function timeOfDayFromDateTime(text) {
  return String(text || "").trim().slice(11, 19);
}

function buildBoundaryTimes({ startDateKey, endDateKey }) {
  return { startTime: `${startDateKey} 00:00:00`, endTime: `${endDateKey} 23:59:59` };
}

function parseShiftBackToMs(text) {
  const m = String(text || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid --shift-back (expected HH:MM): ${text}`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || mm < 0 || mm >= 60) {
    throw new Error(`Invalid --shift-back: ${text}`);
  }
  return -1 * (hh * 60 + mm) * 60 * 1000;
}

async function listActivitiesByShowUrl(session, { type, showUrl }) {
  const qs = new URLSearchParams({ type, total: "0", pageNum: "1", pageSize: "50", showUrl });
  const res = await session.get(`/prod-api/activity/config/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`activity config list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity config list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return Array.isArray(res.body?.rows) ? res.body.rows : [];
}

async function getActivityConfig(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${activityId}`);
  if (res.status >= 400) throw new Error(`activity config detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity config detail failed: ${JSON.stringify({ activityId, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

function collectWeeklyTradingTaskIds(activityConfig) {
  const out = [];
  const list = Array.isArray(activityConfig?.monopolyList) ? activityConfig.monopolyList : [];
  for (const item of list) {
    const point = item?.taskConfig?.pointMilestoneTask;
    for (const moduleKey of ["basicTradingTask", "advancedTradingTask"]) {
      const tasks = point?.[moduleKey]?.tasks;
      if (!Array.isArray(tasks)) continue;
      for (const row of tasks) {
        const taskId = Number(row?.taskId);
        const weekNo = row?.weekNo == null ? null : Number(row.weekNo);
        if (!taskId || !weekNo) continue;
        out.push({ taskId, weekNo, moduleKey, channelType: item?.channelType || "" });
      }
    }
  }
  return out;
}

async function getTaskDetail(session, id) {
  const res = await session.get(`/prod-api/activity/task/${id}`);
  if (res.status >= 400) throw new Error(`task detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

function updateTradingVolumeRequirementRange(requirementList, { startTime, endTime }) {
  if (!Array.isArray(requirementList)) return { changed: false, requirement: requirementList };
  let changed = false;
  const next = requirementList.map(item => {
    if (String(item?.type) !== "TRADING_VOLUME") return item;
    if (item.startTime !== startTime || item.endTime !== endTime) changed = true;
    return { ...item, startTime, endTime };
  });
  return { changed, requirement: next };
}

function buildUpdatePayload(taskDetail, nextRequirement) {
  return {
    id: taskDetail.id,
    versionEdit: taskDetail.versionEdit ?? null,
    name: taskDetail.name,
    nameI18: taskDetail.nameI18,
    content: taskDetail.content,
    contentI18: taskDetail.contentI18,
    label: taskDetail.label ?? null,
    labelI18: taskDetail.labelI18 ?? [{ lang: "zh_CN", name: null }],
    labelDesc: taskDetail.labelDesc ?? null,
    labelDescI18: taskDetail.labelDescI18 ?? [{ lang: "zh_CN", name: null }],
    remark: taskDetail.remark ?? taskDetail.name,

    activityType: taskDetail.activityType,
    allowRange: taskDetail.allowRange,
    conditions: taskDetail.conditions,
    taskRisk: taskDetail.taskRisk,
    dynamicAuditConfig: taskDetail.dynamicAuditConfig,
    kycRiskAreaIds: taskDetail.kycRiskAreaIds ?? [],
    isLivenessEnabled: taskDetail.isLivenessEnabled ?? "NO",
    livenessConfig: taskDetail.livenessConfig,
    linkTaskId: taskDetail.linkTaskId ?? null,
    awardImage: taskDetail.awardImage ?? "",

    completeTaskGroupCount: taskDetail.completeTaskGroupCount ?? 1,
    taskGroupType: taskDetail.taskGroupType ?? null,
    isSameLinkUrl: taskDetail.isSameLinkUrl ?? null,

    resetType: taskDetail.resetType,
    resetDay: taskDetail.resetDay ?? null,
    resetTime: taskDetail.resetTime ?? null,

    requirement: nextRequirement,
    taskAward: taskDetail.taskAward,
  };
}

async function updateTask(session, payload) {
  const res = await session.put("/prod-api/activity/task", payload);
  if (res.status >= 400) throw new Error(`update task HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`update task rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function getTradingVolumeRange(taskDetail) {
  const req0 = Array.isArray(taskDetail?.requirement) ? taskDetail.requirement.find(v => String(v?.type) === "TRADING_VOLUME") : null;
  if (!req0) return null;
  return { startTime: String(req0.startTime || ""), endTime: String(req0.endTime || "") };
}

async function getWeekRepresentativeRanges(session, taskIdToWeek) {
  const byWeek = new Map();
  for (const [taskId, weekNo] of taskIdToWeek.entries()) {
    if (!weekNo || byWeek.has(weekNo)) continue;
    const detail = await getTaskDetail(session, taskId);
    const range = getTradingVolumeRange(detail);
    if (!range?.startTime || !range?.endTime) continue;
    byWeek.set(weekNo, { taskId, name: detail.name, ...range });
  }
  return byWeek;
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
    const activities = await listActivitiesByShowUrl(session, { type: args.type, showUrl: args.showUrl });
    const activityIds = [...new Set(activities.map(r => Number(r?.activityId)).filter(Boolean))];
    if (!activityIds.length) throw new Error(`No activity found for showUrl=${args.showUrl} type=${args.type}`);

    const plan = [];
    const taskIdToWeek = new Map();

    for (const activityId of activityIds) {
      const cfg = await getActivityConfig(session, activityId);
      const rows = collectWeeklyTradingTaskIds(cfg);
      if (!rows.length) continue;
      for (const row of rows) {
        taskIdToWeek.set(row.taskId, row.weekNo);
      }
      plan.push({ activityId, weeklyTasks: rows.length });
    }

    const taskIds = [...taskIdToWeek.keys()].sort((a, b) => a - b);
    if (!taskIds.length) throw new Error(`No weekly trading tasks found under showUrl=${args.showUrl}`);

    // Official-site validator computes dayCount from startOf('day'), so we must ensure:
    // - For non-last week: dayCount === 7, i.e. endDate - startDate = 6 days.
    // - Week-to-week continuity is based on date: nextStartDate = previousEndDate + 1 day.
    let week1Start;
    let week1End;
    let week2Start;
    let week2End;
    let week3Start;
    let week3End;

    if (args.shiftBack) {
      const deltaMs = parseShiftBackToMs(args.shiftBack);
      const weekRanges = await getWeekRepresentativeRanges(session, taskIdToWeek);
      const w1 = weekRanges.get(1);
      const w2 = weekRanges.get(2);
      const w3 = weekRanges.get(3);
      if (!w1 || !w2 || !w3) throw new Error("Missing representative weekly task ranges (need weekNo 1/2/3)");

      const w1StartShifted = shiftUtc(w1.startTime, deltaMs);
      const w1EndShifted = shiftUtc(w1.endTime, deltaMs);

      const week1EndDateKey = dateKeyFromDateTime(w1EndShifted);
      const week1StartDateKey = addDaysToDateKey(week1EndDateKey, -6);
      if (args.dayBoundary) {
        ({ startTime: week1Start, endTime: week1End } = buildBoundaryTimes({ startDateKey: week1StartDateKey, endDateKey: week1EndDateKey }));
      } else {
        const w1StartTod = timeOfDayFromDateTime(w1StartShifted);
        const w1EndTod = timeOfDayFromDateTime(w1EndShifted);
        week1Start = `${week1StartDateKey} ${w1StartTod}`;
        week1End = `${week1EndDateKey} ${w1EndTod}`;
      }

      const week2StartDateKey = addDaysToDateKey(week1EndDateKey, 1);
      const week2EndDateKey = addDaysToDateKey(week2StartDateKey, 6);
      if (args.dayBoundary) {
        ({ startTime: week2Start, endTime: week2End } = buildBoundaryTimes({ startDateKey: week2StartDateKey, endDateKey: week2EndDateKey }));
      } else {
        const w2StartShifted = shiftUtc(w2.startTime, deltaMs);
        const w2EndShifted = shiftUtc(w2.endTime, deltaMs);
        const w2StartTod = timeOfDayFromDateTime(w2StartShifted);
        const w2EndTod = timeOfDayFromDateTime(w2EndShifted);
        week2Start = `${week2StartDateKey} ${w2StartTod}`;
        week2End = `${week2EndDateKey} ${w2EndTod}`;
      }

      const week3StartDateKey = addDaysToDateKey(week2EndDateKey, 1);
      const week3EndDateKey = addDaysToDateKey(week3StartDateKey, 6);
      if (args.dayBoundary) {
        ({ startTime: week3Start, endTime: week3End } = buildBoundaryTimes({ startDateKey: week3StartDateKey, endDateKey: week3EndDateKey }));
      } else {
        const w3StartShifted = shiftUtc(w3.startTime, deltaMs);
        const w3EndShifted = shiftUtc(w3.endTime, deltaMs);
        const w3StartTod = timeOfDayFromDateTime(w3StartShifted);
        const w3EndTod = timeOfDayFromDateTime(w3EndShifted);
        week3Start = `${week3StartDateKey} ${w3StartTod}`;
        week3End = `${week3EndDateKey} ${w3EndTod}`;
      }
    } else {
      week1End = args.week1End;
      const week1EndDateKey = dateKeyFromDateTime(week1End);
      const week1StartDateKey = addDaysToDateKey(week1EndDateKey, -6);
      week1Start = args.dayBoundary ? `${week1StartDateKey} 00:00:00` : `${week1StartDateKey} 08:00:00`;

      const week2StartDateKey = addDaysToDateKey(week1EndDateKey, 1);
      week2Start = args.dayBoundary ? `${week2StartDateKey} 00:00:00` : `${week2StartDateKey} 08:00:00`;
      const week2EndDateKey = addDaysToDateKey(week2StartDateKey, 6);
      week2End = `${week2EndDateKey} 23:59:59`;

      const week3StartDateKey = addDaysToDateKey(week2EndDateKey, 1);
      week3Start = args.dayBoundary ? `${week3StartDateKey} 00:00:00` : `${week3StartDateKey} 08:00:00`;
      const week3EndDateKey = addDaysToDateKey(week3StartDateKey, 6);
      week3End = `${week3EndDateKey} 23:59:59`;
    }

    const desiredByWeek = new Map([
      [1, { startTime: week1Start, endTime: week1End }],
      [2, { startTime: week2Start, endTime: week2End }],
      [3, { startTime: week3Start, endTime: week3End }],
    ]);

    const dryRunOutput = {
      ok: true,
      dryRun: args.dryRun,
      showUrl: args.showUrl,
      type: args.type,
      activityIds,
      plan,
      windows: { week1: desiredByWeek.get(1), week2: desiredByWeek.get(2), week3: desiredByWeek.get(3) },
      taskIds,
    };

    if (args.dryRun) {
      printJson(dryRunOutput);
      return 0;
    }

    const updated = [];
    const skipped = [];

    for (const taskId of taskIds) {
      const weekNo = taskIdToWeek.get(taskId);
      const desired = desiredByWeek.get(weekNo);
      if (!desired) continue;

      const detail = await getTaskDetail(session, taskId);
      const current = getTradingVolumeRange(detail);
      if (!current) throw new Error(`Task ${taskId} missing TRADING_VOLUME requirement`);

      const { changed, requirement } = updateTradingVolumeRequirementRange(detail.requirement, desired);
      if (!changed) {
        skipped.push({ taskId, weekNo, name: detail.name });
        continue;
      }

      await updateTask(session, buildUpdatePayload(detail, requirement));
      const after = await getTaskDetail(session, taskId);
      const next = getTradingVolumeRange(after);
      if (!next || next.startTime !== desired.startTime || next.endTime !== desired.endTime) {
        throw new Error(`Verify failed for task ${taskId} (${detail.name})`);
      }
      updated.push({ taskId, weekNo, name: detail.name, startTime: desired.startTime, endTime: desired.endTime });
    }

    printJson({
      ...dryRunOutput,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updated,
      skipped,
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

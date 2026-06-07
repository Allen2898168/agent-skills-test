#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/copy-monopoly-activity-mixed-board-with-guess-tasks-online.mjs

Options:
  --source-activity-id <id>     default 9930
  --start-in-min <n>            default 2
  --channels <list>             default OFFICIAL_WEBSITE,CHANNEL

  --dice-prize-id <id>          default 1343 (自动化_骰子1000)
  --dice-display <n>            default 1000
  --dice-stock <n>              default 300

  --integral-prize-id <id>      default 1036 (虚拟积分或资格-积分)
  --integral-display <n>        default 10000
  --integral-stock <n>          default 300
  --integral-grids <list>       default 1,2,3,4,5,6

  --guess-template-id <id>      default 6510 (用于复制)
  --guess-total <n>             default 30
  --guess-tomorrow <n>          default 3
  --guess-dayafter <n>          default 3
  --guess-running-min-before <n> default 10
  --guess-deadline-hours-after <n> default 24
  --guess-end-min-after-deadline <n> default 15

  --dry-run                     plan only; no writes
  --online                      default true (disable with --no-online)
  --help                        show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help", "--online", "--no-online"] });
  args.help = Boolean(args.help);
  args.dryRun = Boolean(args.dryRun);
  const noOnline = Boolean(args.noOnline);
  const wantOnline = args.online === undefined ? true : Boolean(args.online);
  args.online = wantOnline && !noOnline;

  args.sourceActivityId = args.sourceActivityId != null ? Number(args.sourceActivityId) : 9930;
  args.startInMin = args.startInMin == null ? 2 : Number(args.startInMin);
  args.channels = String(args.channels || "OFFICIAL_WEBSITE,CHANNEL")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  args.dicePrizeId = args.dicePrizeId != null ? Number(args.dicePrizeId) : 1343;
  args.diceDisplay = args.diceDisplay == null ? 1000 : Number(args.diceDisplay);
  args.diceStock = args.diceStock == null ? 300 : Number(args.diceStock);

  args.integralPrizeId = args.integralPrizeId != null ? Number(args.integralPrizeId) : 1036;
  args.integralDisplay = args.integralDisplay == null ? 10000 : Number(args.integralDisplay);
  args.integralStock = args.integralStock == null ? 300 : Number(args.integralStock);
  args.integralGrids = String(args.integralGrids || "1,2,3,4,5,6")
    .split(",")
    .map(s => Number(String(s).trim()))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 16);

  args.guessTemplateId = args.guessTemplateId != null ? Number(args.guessTemplateId) : 6510;
  args.guessTotal = args.guessTotal == null ? 30 : Number(args.guessTotal);
  args.guessTomorrow = args.guessTomorrow == null ? 3 : Number(args.guessTomorrow);
  const rawDayAfter = args.guessDayAfter ?? args.guessDayafter;
  args.guessDayAfter = rawDayAfter == null ? 3 : Number(rawDayAfter);
  args.guessRunningMinBefore = args.guessRunningMinBefore == null ? 10 : Number(args.guessRunningMinBefore);
  args.guessDeadlineHoursAfter = args.guessDeadlineHoursAfter == null ? 24 : Number(args.guessDeadlineHoursAfter);
  args.guessEndMinAfterDeadline = args.guessEndMinAfterDeadline == null ? 15 : Number(args.guessEndMinAfterDeadline);

  if (!args.help) {
    if (!Number.isFinite(args.sourceActivityId) || args.sourceActivityId <= 0) throw new Error("--source-activity-id invalid");
    if (!Number.isFinite(args.startInMin) || args.startInMin < 0) throw new Error("--start-in-min invalid");
    if (!args.channels.length) throw new Error("--channels empty");
    if (!Number.isFinite(args.dicePrizeId) || args.dicePrizeId <= 0) throw new Error("--dice-prize-id invalid");
    if (!Number.isFinite(args.integralPrizeId) || args.integralPrizeId <= 0) throw new Error("--integral-prize-id invalid");
    if (!args.integralGrids.length) throw new Error("--integral-grids empty");
    if (!Number.isFinite(args.guessTemplateId) || args.guessTemplateId <= 0) throw new Error("--guess-template-id invalid");
    if (!Number.isFinite(args.guessTotal) || args.guessTotal <= 0) throw new Error("--guess-total invalid");
    if (!Number.isFinite(args.guessTomorrow) || args.guessTomorrow < 0) throw new Error("--guess-tomorrow invalid");
    if (!Number.isFinite(args.guessDayAfter) || args.guessDayAfter < 0) throw new Error("--guess-dayafter invalid");
    if (args.guessTomorrow + args.guessDayAfter > args.guessTotal) throw new Error("guess tomorrow + dayafter > total");
  }
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

function nowShanghai() {
  return formatDateTimeInTimeZone(new Date(), "Asia/Shanghai");
}

function addMinutesShanghaiFromNow(minutes) {
  const ms = Date.now() + (Number(minutes) || 0) * 60 * 1000;
  return formatDateTimeInTimeZone(new Date(ms), "Asia/Shanghai");
}

function addMsShanghaiFromNow(ms) {
  const target = new Date(Date.now() + (Number(ms) || 0));
  return formatDateTimeInTimeZone(target, "Asia/Shanghai");
}

function shanghaiDateAtOffsetDays(hour, minute, second, dayOffset) {
  const base = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(base)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  const y = Number(parts.year);
  const mo = Number(parts.month);
  const d = Number(parts.day);
  const utc = Date.UTC(y, mo - 1, d, Number(hour) || 0, Number(minute) || 0, Number(second) || 0);
  const next = new Date(utc + Math.max(0, Number(dayOffset) || 0) * 24 * 60 * 60 * 1000);
  return formatDateTimeInTimeZone(next, "Asia/Shanghai");
}

function addDaysFromShanghaiDateTime(startText, days) {
  const m = String(startText || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const base = Date.UTC(y, mo - 1, d, h, mi, s);
  const next = new Date(base + Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000);
  return formatDateTimeInTimeZone(next, "Asia/Shanghai");
}

async function copyActivity(session, activityId) {
  const res = await session.post("/prod-api/activity/config/copy", { activityId: Number(activityId) });
  if (res.status >= 400) throw new Error(`copy HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`copy rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ activityId, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateActivity(session, payload) {
  const res = await session.put("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`activity update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function buildUpdatePayload(detail) {
  const monopolyList = Array.isArray(detail?.monopolyList) ? detail.monopolyList : [];
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
    monopolyList,
  };
}

function buildGrid(existing, { prizeId, display, stock, gridNo }) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const prizeLabel = base.prizeLabel ?? "MIDDLE";
  return {
    ...base,
    gridNo,
    prizeId: Number(prizeId),
    displayMin: Number(display),
    displayMax: Number(display),
    rewardDisplayCount: Number(display),
    rewardRealCount: Number(stock),
    prizeLabel,
    blankGridFlag: false,
  };
}

function patchBoardAndGuess(item, { dicePrizeId, diceDisplay, diceStock, integralPrizeId, integralDisplay, integralStock, integralGridSet, guessTaskIds }) {
  const next = { ...(item || {}) };
  next.boardSize = 16;
  next.startPosition = next.startPosition ?? 1;
  next.dailyMoveLimit = next.dailyMoveLimit ?? 9999;
  next.maxDicePoint = next.maxDicePoint ?? 6;

  const gridConfig = next.gridConfig || {};
  const grids = Array.isArray(gridConfig.grids) ? gridConfig.grids : [];
  const patchedGrids = Array.from({ length: 16 }, (_, i) => {
    const gridNo = i + 1;
    const existing = grids[i];
    const isIntegral = integralGridSet.has(gridNo);
    return buildGrid(existing, {
      prizeId: isIntegral ? integralPrizeId : dicePrizeId,
      display: isIntegral ? integralDisplay : diceDisplay,
      stock: isIntegral ? integralStock : diceStock,
      gridNo,
    });
  });
  const fallbackGrid = buildGrid(gridConfig.fallbackGrid || {}, { prizeId: dicePrizeId, display: diceDisplay, stock: diceStock, gridNo: gridConfig.fallbackGrid?.gridNo ?? 0 });

  next.gridConfig = {
    ...gridConfig,
    autoRewardEnabled: true,
    grids: patchedGrids,
    fallbackGrid,
  };

  const taskConfig = next.taskConfig || {};
  const guessModule = taskConfig.guessTask || {};
  next.taskConfig = {
    ...taskConfig,
    guessTask: {
      ...guessModule,
      tasks: guessTaskIds.map((id, index) => ({
        taskId: String(id),
        sort: index + 1,
        toTopFlag: 0,
      })),
    },
  };
  return next;
}

async function copyGuessTask(session, templateId) {
  const res = await session.post("/prod-api/activity/guessTask/copy", { id: Number(templateId) });
  if (res.status >= 400) throw new Error(`guess copy HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guess copy rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function listGuessTasksByName(session, name, { pageNum = 1, pageSize = 10 } = {}) {
  const qs = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize), name: String(name || "") });
  const res = await session.get(`/prod-api/activity/guessTask/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`guess list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guess list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return Array.isArray(res.body?.rows) ? res.body.rows : [];
}

async function resolveLatestGuessTaskIdByName(session, name, usedIds) {
  const rows = await listGuessTasksByName(session, name, { pageNum: 1, pageSize: 10 });
  const ids = rows
    .map(r => Number(r?.id))
    .filter(id => Number.isFinite(id) && id > 0 && !usedIds.has(id))
    .sort((a, b) => b - a);
  return ids[0] || 0;
}

async function getGuessTaskDetail(session, id) {
  const res = await session.get(`/prod-api/activity/guessTask/${encodeURIComponent(String(id))}`);
  if (res.status >= 400) throw new Error(`guess detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guess detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateGuessTask(session, payload) {
  const res = await session.put("/prod-api/activity/guessTask", payload);
  if (res.status >= 400) throw new Error(`guess update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guess update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

async function onlineMonopoly(session, activityId, totp) {
  const res = await session.post("/prod-api/activity/monopoly/online", { activityId: Number(activityId), totp: String(totp || "") });
  if (res.status >= 400) throw new Error(`online HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`online rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function buildGuessSchedule(args) {
  const total = args.guessTotal;
  const tomorrow = args.guessTomorrow;
  const dayAfter = args.guessDayAfter;
  const running = total - tomorrow - dayAfter;

  const schedules = [];

  // Running tasks: start = now - X min, deadline = now + Y hours, end = deadline + Z min
  for (let i = 0; i < running; i++) {
    const start = addMsShanghaiFromNow(-args.guessRunningMinBefore * 60 * 1000);
    const deadline = addMsShanghaiFromNow(args.guessDeadlineHoursAfter * 60 * 60 * 1000);
    const end = addMsShanghaiFromNow(args.guessDeadlineHoursAfter * 60 * 60 * 1000 + args.guessEndMinAfterDeadline * 60 * 1000);
    schedules.push({ kind: "RUNNING", index: i + 1, startTime: start, deadlineTime: deadline, endTime: end });
  }

  // Tomorrow tasks: 12:00-13:00 bet window; end 13:15
  for (let i = 0; i < tomorrow; i++) {
    const start = shanghaiDateAtOffsetDays(12, 0, 0, 1);
    const deadline = shanghaiDateAtOffsetDays(13, 0, 0, 1);
    const end = shanghaiDateAtOffsetDays(13, 15, 0, 1);
    schedules.push({ kind: "TOMORROW", index: i + 1, startTime: start, deadlineTime: deadline, endTime: end });
  }

  // Day-after-tomorrow tasks: 12:00-13:00; end 13:15
  for (let i = 0; i < dayAfter; i++) {
    const start = shanghaiDateAtOffsetDays(12, 0, 0, 2);
    const deadline = shanghaiDateAtOffsetDays(13, 0, 0, 2);
    const end = shanghaiDateAtOffsetDays(13, 15, 0, 2);
    schedules.push({ kind: "DAY_AFTER", index: i + 1, startTime: start, deadlineTime: deadline, endTime: end });
  }

  return schedules;
}

function guessName(kind, seq) {
  if (kind === "RUNNING") return `自动化_竞猜_进行中${String(seq).padStart(2, "0")}`;
  if (kind === "TOMORROW") return `自动化_竞猜_明天${String(seq).padStart(2, "0")}`;
  return `自动化_竞猜_后天${String(seq).padStart(2, "0")}`;
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
    const plannedStartTime = addMinutesShanghaiFromNow(args.startInMin);
    const plan = {
      ok: true,
      dryRun: args.dryRun,
      sourceActivityId: args.sourceActivityId,
      plannedStartTime,
      channels: args.channels,
      board: {
        integralGrids: args.integralGrids,
        integral: { prizeId: args.integralPrizeId, display: args.integralDisplay, stock: args.integralStock },
        dice: { prizeId: args.dicePrizeId, display: args.diceDisplay, stock: args.diceStock },
      },
      guess: {
        templateId: args.guessTemplateId,
        total: args.guessTotal,
        tomorrow: args.guessTomorrow,
        dayAfter: args.guessDayAfter,
        nowShanghai: nowShanghai(),
      },
      online: args.online,
    };

    if (args.dryRun) {
      printJson(plan);
      return 0;
    }

    // 1) copy activity
    const copied = await copyActivity(session, args.sourceActivityId);
    const newActivityId = Number(copied?.activityId || copied?.data?.activityId || copied?.id || 0);
    if (!Number.isFinite(newActivityId) || newActivityId <= 0) {
      throw new Error(`copy succeeded but new activityId missing: ${JSON.stringify({ keys: Object.keys(copied || {}) })}`);
    }

    // 2) create ~30 guess tasks by copying template
    const schedules = buildGuessSchedule(args);
    const createdGuessIds = [];
    const usedGuessIds = new Set();
    for (let i = 0; i < schedules.length; i++) {
      const sched = schedules[i];
      const copiedGuess = await copyGuessTask(session, args.guessTemplateId);
      const copiedName = String(copiedGuess?.name || "").trim();
      if (!copiedName) throw new Error("guess copy succeeded but name missing");
      const guessId = await resolveLatestGuessTaskIdByName(session, copiedName, usedGuessIds);
      if (!Number.isFinite(guessId) || guessId <= 0) throw new Error("guess copy succeeded but id missing");
      usedGuessIds.add(guessId);

      const detail = await getGuessTaskDetail(session, guessId);
      const next = { ...detail };
      next.name = guessName(sched.kind, sched.index);
      next.guessConfig = { ...(next.guessConfig || {}) };
      next.guessConfig.startTime = sched.startTime;
      next.guessConfig.deadlineTime = sched.deadlineTime;
      next.guessConfig.endTime = sched.endTime;

    await updateGuessTask(session, next);
    createdGuessIds.push(guessId);
  }

    // 3) patch board + bind guess tasks in OFFICIAL_WEBSITE only
    const detail = await getActivityDetail(session, newActivityId);
    const monopolyList = Array.isArray(detail?.monopolyList) ? detail.monopolyList : [];
    if (!monopolyList.length) throw new Error("monopolyList empty on copied activity");

    const integralGridSet = new Set(args.integralGrids);
    const nextMonopolyList = monopolyList.map(item => {
      const channelType = String(item?.channelType || "");
      if (!args.channels.includes(channelType)) return item;
      const isOfficial = channelType === "OFFICIAL_WEBSITE";
      return patchBoardAndGuess(item, {
        dicePrizeId: args.dicePrizeId,
        diceDisplay: args.diceDisplay,
        diceStock: args.diceStock,
        integralPrizeId: args.integralPrizeId,
        integralDisplay: args.integralDisplay,
        integralStock: args.integralStock,
        integralGridSet,
        guessTaskIds: isOfficial ? createdGuessIds : [],
      });
    });

    // 4) ensure activity time
    const adjustedStartTime = addMinutesShanghaiFromNow(args.startInMin);
    const adjustedEndTime = String(detail.endTime || "") && String(detail.endTime || "") > adjustedStartTime
      ? String(detail.endTime || "")
      : addDaysFromShanghaiDateTime(adjustedStartTime, 30);

    const nextDetail = { ...detail, startTime: adjustedStartTime, endTime: adjustedEndTime, monopolyList: nextMonopolyList };
    await updateActivity(session, buildUpdatePayload(nextDetail));

    // 5) online
    if (args.online) {
      await onlineMonopoly(session, newActivityId, config.googleCode);
    }

    // verify minimal fields
    const after = await getActivityDetail(session, newActivityId);
    const afterList = Array.isArray(after?.monopolyList) ? after.monopolyList : [];
    const official = afterList.find(i => String(i?.channelType) === "OFFICIAL_WEBSITE");
    if (!official) throw new Error("verify failed: OFFICIAL_WEBSITE missing");
    const grids = official?.gridConfig?.grids || [];
    if (!Array.isArray(grids) || grids.length !== 16) throw new Error("verify failed: grids != 16");
    for (let i = 0; i < 16; i++) {
      const gridNo = i + 1;
      const g = grids[i];
      const expectedPrize = integralGridSet.has(gridNo) ? args.integralPrizeId : args.dicePrizeId;
      const expectedDisplay = integralGridSet.has(gridNo) ? args.integralDisplay : args.diceDisplay;
      if (Number(g?.prizeId) !== Number(expectedPrize)) throw new Error(`verify failed: grid ${gridNo} prizeId mismatch`);
      if (Number(g?.rewardDisplayCount) !== Number(expectedDisplay)) throw new Error(`verify failed: grid ${gridNo} rewardDisplayCount mismatch`);
    }
    const guessTasks = official?.taskConfig?.guessTask?.tasks || [];
    if (!Array.isArray(guessTasks) || guessTasks.length !== createdGuessIds.length) throw new Error("verify failed: guessTask count mismatch");

    printJson({
      ...plan,
      copied: { activityId: newActivityId, showUrl: after?.showUrl || "" },
      activityTime: { startTime: after?.startTime || adjustedStartTime, endTime: after?.endTime || adjustedEndTime },
      guessTaskIds: createdGuessIds,
      status: after?.status ?? null,
      stage: after?.stage ?? null,
      onlined: args.online,
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

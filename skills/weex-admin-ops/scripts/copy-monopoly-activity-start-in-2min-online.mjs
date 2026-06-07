#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/copy-monopoly-activity-start-in-2min-online.mjs

Options:
  --source-activity-id <id>   default 9930
  --start-in-min <n>          default 2
  --online                    default true (disable with --no-online)
  --dry-run                   plan only; no writes
  --help                      show help

Notes:
  - Uses /prod-api/activity/config/copy to copy.
  - Then updates startTime (Asia/Shanghai) and ensures endTime > startTime.
  - Finally onlines via /prod-api/activity/monopoly/online.
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

  if (!args.help) {
    if (!Number.isFinite(args.sourceActivityId) || args.sourceActivityId <= 0) throw new Error("--source-activity-id invalid");
    if (!Number.isFinite(args.startInMin) || args.startInMin < 0) throw new Error("--start-in-min invalid");
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

function addMinutesInShanghai(minutes) {
  const ms = Date.now() + Math.max(0, Number(minutes) || 0) * 60 * 1000;
  return formatDateTimeInTimeZone(new Date(ms), "Asia/Shanghai");
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

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ activityId, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
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

async function updateActivity(session, payload) {
  const res = await session.put("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`activity update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

async function copyActivity(session, activityId) {
  const res = await session.post("/prod-api/activity/config/copy", { activityId: Number(activityId) });
  if (res.status >= 400) throw new Error(`copy HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`copy rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function onlineMonopoly(session, activityId, totp) {
  const res = await session.post("/prod-api/activity/monopoly/online", { activityId: Number(activityId), totp: String(totp || "") });
  if (res.status >= 400) throw new Error(`online HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`online rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
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
    const plannedStartTime = addMinutesInShanghai(args.startInMin);
    const plan = {
      ok: true,
      dryRun: args.dryRun,
      sourceActivityId: args.sourceActivityId,
      startInMin: args.startInMin,
      plannedStartTime,
      online: args.online,
    };

    if (args.dryRun) {
      printJson(plan);
      return 0;
    }

    const copied = await copyActivity(session, args.sourceActivityId);
    const newActivityId = Number(copied?.activityId || copied?.data?.activityId || copied?.id || copied?.activity_id || 0);
    if (!Number.isFinite(newActivityId) || newActivityId <= 0) {
      throw new Error(`copy succeeded but new activityId missing: ${JSON.stringify({ keys: Object.keys(copied || {}) })}`);
    }

    const detail = await getActivityDetail(session, newActivityId);
    const nextStartTime = plannedStartTime;
    const nextEndTime = String(detail.endTime || "") && String(detail.endTime || "") > nextStartTime
      ? String(detail.endTime || "")
      : addDaysFromShanghaiDateTime(nextStartTime, 30);

    const nextDetail = { ...detail, startTime: nextStartTime, endTime: nextEndTime };
    await updateActivity(session, buildUpdatePayload(nextDetail));

    if (args.online) {
      await onlineMonopoly(session, newActivityId, config.googleCode);
    }

    const after = await getActivityDetail(session, newActivityId);
    printJson({
      ...plan,
      copied: { activityId: newActivityId, showUrl: after?.showUrl || detail?.showUrl || "" },
      activityTime: { startTime: after?.startTime || nextStartTime, endTime: after?.endTime || nextEndTime },
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


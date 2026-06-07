#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/update-monopoly-guess-task-times-by-activityid-api.mjs --activity-id <id> --deadline-time "YYYY-MM-DD HH:mm:ss" --end-time "YYYY-MM-DD HH:mm:ss"

Options:
  --activity-id <id>           Monopoly activityId (e.g. 9826)
  --channel <type>             OFFICIAL_WEBSITE | CHANNEL (default: OFFICIAL_WEBSITE)
  --deadline-time <datetime>   Guess stop time (guessConfig.deadlineTime)
  --end-time <datetime>        Guess end time (guessConfig.endTime)
  --dry-run                    Print plan only; no API writes
  --help                       Show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  args.activityId = args.activityId != null ? Number(args.activityId) : (args.activity ? Number(args.activity) : NaN);
  args.channel = String(args.channel || "OFFICIAL_WEBSITE").trim();
  args.deadlineTime = String(args.deadlineTime || "").trim();
  args.endTime = String(args.endTime || "").trim();
  if (!args.help) {
    if (!Number.isFinite(args.activityId) || args.activityId <= 0) throw new Error("--activity-id is required");
    if (!args.deadlineTime) throw new Error("--deadline-time is required");
    if (!args.endTime) throw new Error("--end-time is required");
  }
  return args;
}

function pickUpdatePayload(detail) {
  // Mirror the UI update payload shape: include editable fields only.
  const allowed = [
    "id",
    "versionEdit",
    "name",
    "nameI18",
    "content",
    "contentI18",
    "label",
    "labelI18",
    "labelDesc",
    "labelDescI18",
    "remark",
    "activityType",
    "allowRange",
    "conditions",
    "taskRisk",
    "dynamicAuditConfig",
    "kycRiskAreaIds",
    "isLivenessEnabled",
    "livenessConfig",
    "linkTaskId",
    "awardImage",
    "completeTaskGroupCount",
    "taskGroupType",
    "isSameLinkUrl",
    "resetType",
    "resetDay",
    "resetTime",
    "requirement",
    "taskAward",
    "guessConfig",
    // Optional UI/base fields that may exist
    "taskUrlWeb",
    "taskUrlApp",
    "incompleteButton",
    "incompleteButtonI18",
    "isShowLeaderBoard",
    "limitRewardNumber",
    "isTaskCoupon",
  ];
  const out = {};
  for (const key of allowed) {
    if (detail && Object.prototype.hasOwnProperty.call(detail, key)) out[key] = detail[key];
  }
  return out;
}

async function getActivityDetail(session, activityId) {
  const res = await session.get(`/prod-api/activity/config/${encodeURIComponent(String(activityId))}`);
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`activity detail failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function getGuessTaskDetail(session, id) {
  const res = await session.get(`/prod-api/activity/guessTask/${encodeURIComponent(String(id))}`);
  if (res.status >= 400) throw new Error(`guessTask detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guessTask detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updateGuessTask(session, payload) {
  const res = await session.put("/prod-api/activity/guessTask", payload);
  if (res.status >= 400) throw new Error(`guessTask update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guessTask update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function collectGuessTaskIds(activityDetail, channelType) {
  const list = Array.isArray(activityDetail?.monopolyList) ? activityDetail.monopolyList : [];
  const item = list.find(v => String(v?.channelType) === String(channelType));
  if (!item) throw new Error(`channelType=${channelType} not found in monopolyList`);
  const tasks = item?.taskConfig?.guessTask?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error(`guessTask.tasks empty for channelType=${channelType}`);
  return tasks.map(t => Number(t?.taskId)).filter(Boolean);
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
    const activityDetail = await getActivityDetail(session, args.activityId);
    const taskIds = collectGuessTaskIds(activityDetail, args.channel);
    const plan = {
      ok: true,
      dryRun: args.dryRun,
      activityId: args.activityId,
      showUrl: activityDetail?.showUrl || "",
      channelType: args.channel,
      taskIds,
      deadlineTime: args.deadlineTime,
      endTime: args.endTime,
    };
    if (args.dryRun) {
      printJson(plan);
      return 0;
    }

    const updated = [];
    const skipped = [];
    for (const id of taskIds) {
      const detail = await getGuessTaskDetail(session, id);
      const current = detail?.guessConfig || {};
      const nextGuessConfig = { ...current, deadlineTime: args.deadlineTime, endTime: args.endTime };
      const needChange = String(current.deadlineTime || "") !== args.deadlineTime || String(current.endTime || "") !== args.endTime;
      if (!needChange) {
        skipped.push({ id, name: detail?.name || "" });
        continue;
      }
      const payload = pickUpdatePayload({ ...detail, guessConfig: nextGuessConfig });
      await updateGuessTask(session, payload);
      const after = await getGuessTaskDetail(session, id);
      const afterCfg = after?.guessConfig || {};
      if (String(afterCfg.deadlineTime || "") !== args.deadlineTime || String(afterCfg.endTime || "") !== args.endTime) {
        throw new Error(`verify failed for guessTask ${id}`);
      }
      updated.push({ id, name: after?.name || "", deadlineTime: afterCfg.deadlineTime, endTime: afterCfg.endTime });
    }

    printJson({ ...plan, updatedCount: updated.length, skippedCount: skipped.length, updated, skipped });
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


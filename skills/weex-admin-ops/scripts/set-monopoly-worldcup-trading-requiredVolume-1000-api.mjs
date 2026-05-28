#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/set-monopoly-worldcup-trading-requiredVolume-1000-api.mjs

Options:
  --dry-run     Print targets only; no API writes
  --help        Show help

Behavior:
  - Updates only the trading-volume tasks created in this conversation (by fixed task names).
  - Sets requirement[].requiredVolume = 1000 where requirement.type is:
      - TRADING_VOLUME
      - SPOT_TRADING_VOLUME
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  return args;
}

const TARGET_REQUIRED_VOLUME = 1000;
const TARGET_TYPES = new Set(["TRADING_VOLUME", "SPOT_TRADING_VOLUME"]);

const TARGET_TASK_NAMES = [
  // Non-limited tasks created by create-monopoly-worldcup-tasks-bulk-api.mjs
  "合量(每日/活动开始)-虚资-骰子",
  "合量(每日/报名后)-虚资-骰子",
  "现量(每日/活动开始)-虚资-骰子",
  "现量(每日/报名后)-虚资-骰子",
  "合量(仅1次/活动开始)-虚资-骰子",
  "合量(仅1次/报名后)-虚资-骰子",
  "合量(仅1次/活动开始)-虚资-膨胀券",
  "合量(仅1次/报名后)-虚资-膨胀券",
  "现量(仅1次/活动开始)-虚资-膨胀券",
  "现量(仅1次/报名后)-虚资-膨胀券",
  // Limited-time point milestone tasks (week 1) created in this conversation
  "合里程碑(基础限时/活动开始)-虚资-积分",
  "合里程碑(进阶限时/活动开始)-虚资-积分",
  "合里程碑(基础限时/报名后)-虚资-积分",
  "合里程碑(进阶限时/报名后)-虚资-积分",
  // Additional weekly tasks created and appended into activityId=9603
  "合里程碑(基础限时第2周/活动开始)-虚资-积分",
  "合里程碑(进阶限时第2周/活动开始)-虚资-积分",
  "合里程碑(基础限时第2周/报名后)-虚资-积分",
  "合里程碑(进阶限时第2周/报名后)-虚资-积分",
  "合里程碑(基础限时第3周/活动开始)-虚资-积分",
  "合里程碑(进阶限时第3周/活动开始)-虚资-积分",
  "合里程碑(基础限时第3周/报名后)-虚资-积分",
  "合里程碑(进阶限时第3周/报名后)-虚资-积分"
];

async function getTaskDetail(session, id) {
  const res = await session.get(`/prod-api/activity/task/${id}`);
  if (res.status >= 400) throw new Error(`task detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function findTaskByName(session, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "5", activityType: "23", name });
  const res = await session.get(`/prod-api/activity/task/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`task list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`task list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows.find(row => String(row?.name || "") === String(name)) || null;
}

function updateRequiredVolume(requirementList) {
  if (!Array.isArray(requirementList)) return { changed: false, requirement: requirementList };
  let changed = false;
  const next = requirementList.map(item => {
    if (!TARGET_TYPES.has(String(item?.type))) return item;
    if (Number(item?.requiredVolume) !== TARGET_REQUIRED_VOLUME) {
      changed = true;
    }
    return { ...item, requiredVolume: TARGET_REQUIRED_VOLUME };
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
    taskAward: taskDetail.taskAward
  };
}

async function updateTask(session, payload) {
  const res = await session.put("/prod-api/activity/task", payload);
  if (res.status >= 400) throw new Error(`update task HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`update task rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function assertUpdated(taskDetail) {
  const reqList = Array.isArray(taskDetail?.requirement) ? taskDetail.requirement : [];
  for (const req of reqList) {
    if (!TARGET_TYPES.has(String(req?.type))) continue;
    if (Number(req?.requiredVolume) !== TARGET_REQUIRED_VOLUME) {
      throw new Error(`verify failed: requiredVolume != ${TARGET_REQUIRED_VOLUME} for task ${taskDetail?.id} (${taskDetail?.name})`);
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
  const { chromium } = loadPlaywright();
  const session = await createAdminApiSession({ chromium, config });

  try {
    const targets = [];
    for (const name of TARGET_TASK_NAMES) {
      const row = await findTaskByName(session, name);
      if (!row) throw new Error(`task not found by name: ${name}`);
      targets.push({ id: Number(row.id), name: row.name, taskType: row.taskType });
    }

    if (args.dryRun) {
      printJson({ ok: true, dryRun: true, targetRequiredVolume: TARGET_REQUIRED_VOLUME, totalTargets: targets.length, targets });
      return 0;
    }

    const updated = [];
    const skipped = [];
    for (const t of targets) {
      const detail = await getTaskDetail(session, t.id);
      const { changed, requirement } = updateRequiredVolume(detail.requirement);
      if (!changed) {
        assertUpdated(detail);
        skipped.push({ id: t.id, name: t.name });
        continue;
      }
      await updateTask(session, buildUpdatePayload(detail, requirement));
      const after = await getTaskDetail(session, t.id);
      assertUpdated(after);
      updated.push({ id: t.id, name: t.name });
    }

    printJson({ ok: true, targetRequiredVolume: TARGET_REQUIRED_VOLUME, totalTargets: targets.length, updatedCount: updated.length, skippedCount: skipped.length, updated, skipped });
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

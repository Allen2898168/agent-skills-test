#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/clear-monopoly-worldcup-orderTypeList-api.mjs

Options:
  --dry-run     Print plan only; no API writes
  --help        Show help

Behavior:
  - Finds tasks by name (activityType=23) created in this conversation that have TRADING_VOLUME requirements
  - Clears requirement.orderTypeList (sets to [])
  - Updates tasks via PUT /prod-api/activity/task with versionEdit for conflict detection
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  return args;
}

const TARGET_TASK_NAMES = [
  // Non-limited tasks (created by create-monopoly-worldcup-tasks-bulk-api.mjs)
  "合量(每日/活动开始)-虚资-骰子",
  "合量(每日/报名后)-虚资-骰子",
  "合量(仅1次/活动开始)-虚资-骰子",
  "合量(仅1次/报名后)-虚资-骰子",
  "合量(仅1次/活动开始)-虚资-膨胀券",
  "合量(仅1次/报名后)-虚资-膨胀券",
  // Limited-time milestone trading (created by create-monopoly-worldcup-limitedtime-tasks-api.mjs)
  "合里程碑(基础限时/活动开始)-虚资-积分",
  "合里程碑(进阶限时/活动开始)-虚资-积分",
  "合里程碑(基础限时/报名后)-虚资-积分",
  "合里程碑(进阶限时/报名后)-虚资-积分"
];

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

function clearOrderTypeList(requirementList) {
  if (!Array.isArray(requirementList)) return { changed: false, requirement: requirementList };
  let changed = false;
  const next = requirementList.map(item => {
    if (String(item?.type) !== "TRADING_VOLUME") return item;
    const current = Array.isArray(item?.orderTypeList) ? item.orderTypeList : [];
    if (current.length === 0) return { ...item, orderTypeList: [] };
    changed = true;
    return { ...item, orderTypeList: [] };
  });
  return { changed, requirement: next };
}

function buildUpdatePayload(taskDetail, nextRequirement) {
  // Keep payload aligned with create modal "params" shape; include versionEdit for conflict detection.
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

function assertOrderTypeCleared(taskDetail) {
  const requirementList = Array.isArray(taskDetail?.requirement) ? taskDetail.requirement : [];
  const tradingReq = requirementList.find(v => String(v?.type) === "TRADING_VOLUME");
  if (!tradingReq) return;
  const list = Array.isArray(tradingReq.orderTypeList) ? tradingReq.orderTypeList : [];
  if (list.length !== 0) {
    throw new Error(`verify failed: orderTypeList not cleared for task ${taskDetail?.id} (${taskDetail?.name})`);
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
    if (args.dryRun) {
      printJson({ ok: true, dryRun: true, total: TARGET_TASK_NAMES.length, names: TARGET_TASK_NAMES });
      return 0;
    }

    const updated = [];
    const skipped = [];

    for (const name of TARGET_TASK_NAMES) {
      const row = await findTaskByName(session, name);
      if (!row) throw new Error(`task not found by name: ${name}`);

      const detail = await getTaskDetail(session, row.id);
      const { changed, requirement } = clearOrderTypeList(detail.requirement);

      if (!changed) {
        // still verify it's cleared
        assertOrderTypeCleared(detail);
        skipped.push({ id: row.id, name });
        continue;
      }

      const payload = buildUpdatePayload(detail, requirement);
      await updateTask(session, payload);

      const after = await getTaskDetail(session, row.id);
      assertOrderTypeCleared(after);
      updated.push({ id: row.id, name });
    }

    printJson({ ok: true, total: TARGET_TASK_NAMES.length, updatedCount: updated.length, skippedCount: skipped.length, updated, skipped });
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


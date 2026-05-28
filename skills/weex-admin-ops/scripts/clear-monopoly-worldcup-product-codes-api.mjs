#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/clear-monopoly-worldcup-product-codes-api.mjs

Options:
  --dry-run     Print targets only; no API writes
  --help        Show help

Behavior:
  - Clears all \"币对\" selection fields on tasks created in this conversation:
      - requirement.productCodeList = []
      - requirement.productCodeNameList = []
      - requirement.spotProductCodeList = []
      - requirement.spotProductCodeNameList = []
  - Keeps currencySupportType / spotCurrencySupportType unchanged (so activity-level coin requirements stay the same)
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.help = Boolean(args.help);
  return args;
}

const TARGET_TASK_NAMES = [
  // From create-monopoly-worldcup-tasks-bulk-api.mjs (23)
  "合量(每日/活动开始)-虚资-骰子",
  "现量(每日/活动开始)-虚资-骰子",
  "合量(每日/报名后)-虚资-骰子",
  "现量(每日/报名后)-虚资-骰子",
  "合量(仅1次/活动开始)-虚资-骰子",
  "骰子消耗次数(仅1次/活动开始)-虚资-积分",
  "合量(仅1次/报名后)-虚资-骰子",
  "骰子消耗次数(仅1次/报名后)-虚资-积分",
  "邀请(仅1次/报名后)-虚资-骰子",
  "合量(仅1次/活动开始)-虚资-膨胀券",
  "现量(仅1次/活动开始)-虚资-膨胀券",
  "合量(仅1次/报名后)-虚资-膨胀券",
  "现量(仅1次/报名后)-虚资-膨胀券",
  "获得积分(活动开始)-币种-USDT",
  "获得积分(活动开始)-虚资-骰子",
  "获得积分(活动开始)-虚资-合约抵扣金",
  "获得积分(活动开始)-虚资-积分",
  "获得积分(活动开始)-赠金-赠金",
  "获得积分(报名后)-币种-USDT",
  "获得积分(报名后)-虚资-骰子",
  "获得积分(报名后)-虚资-合约抵扣金",
  "获得积分(报名后)-虚资-积分",
  "获得积分(报名后)-赠金-赠金",

  // From create-monopoly-worldcup-limitedtime-tasks-api.mjs (9)
  "报名(限时/活动开始)-虚资-骰子",
  "注册(限时/活动开始)-虚资-骰子",
  "报名(限时/报名后)-虚资-骰子",
  "注册(限时/报名后)-虚资-骰子",
  "充值(限时/报名后)-虚资-骰子",
  "合里程碑(基础限时/活动开始)-虚资-积分",
  "合里程碑(进阶限时/活动开始)-虚资-积分",
  "合里程碑(基础限时/报名后)-虚资-积分",
  "合里程碑(进阶限时/报名后)-虚资-积分",

  // Week 2/3 tasks created for activityId=9603 (8)
  "合里程碑(基础限时第2周/活动开始)-虚资-积分",
  "合里程碑(进阶限时第2周/活动开始)-虚资-积分",
  "合里程碑(基础限时第2周/报名后)-虚资-积分",
  "合里程碑(进阶限时第2周/报名后)-虚资-积分",
  "合里程碑(基础限时第3周/活动开始)-虚资-积分",
  "合里程碑(进阶限时第3周/活动开始)-虚资-积分",
  "合里程碑(基础限时第3周/报名后)-虚资-积分",
  "合里程碑(进阶限时第3周/报名后)-虚资-积分"
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

function clearProductFields(requirementList) {
  if (!Array.isArray(requirementList)) return { changed: false, requirement: requirementList };
  let changed = false;
  const next = requirementList.map(item => {
    if (!item || typeof item !== "object") return item;
    const nextItem = { ...item };
    for (const key of ["productCodeList", "productCodeNameList", "spotProductCodeList", "spotProductCodeNameList"]) {
      if (key in nextItem) {
        const val = nextItem[key];
        if (!Array.isArray(val) || val.length !== 0) changed = true;
      } else {
        // Some APIs omit empty arrays; we still normalize to [].
        changed = true;
      }
      nextItem[key] = [];
    }
    return nextItem;
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

function assertCleared(taskDetail) {
  const reqList = Array.isArray(taskDetail?.requirement) ? taskDetail.requirement : [];
  for (const req of reqList) {
    for (const key of ["productCodeList", "productCodeNameList", "spotProductCodeList", "spotProductCodeNameList"]) {
      const val = req?.[key];
      if (val !== undefined && (!Array.isArray(val) || val.length !== 0)) {
        throw new Error(`verify failed: ${key} not cleared for task ${taskDetail?.id} (${taskDetail?.name})`);
      }
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
      targets.push({ id: Number(row.id), name: row.name });
    }

    if (args.dryRun) {
      printJson({ ok: true, dryRun: true, totalTargets: targets.length, targets });
      return 0;
    }

    const updated = [];
    const skipped = [];
    for (const t of targets) {
      const detail = await getTaskDetail(session, t.id);
      const { changed, requirement } = clearProductFields(detail.requirement);
      if (!changed) {
        assertCleared(detail);
        skipped.push({ id: t.id, name: t.name });
        continue;
      }
      await updateTask(session, buildUpdatePayload(detail, requirement));
      const after = await getTaskDetail(session, t.id);
      assertCleared(after);
      updated.push({ id: t.id, name: t.name });
    }

    printJson({ ok: true, totalTargets: targets.length, updatedCount: updated.length, skippedCount: skipped.length, updated, skipped });
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


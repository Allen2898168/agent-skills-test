#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/set-monopoly-activity-task-pairs-to-wxt-api.mjs --activity-id <id>

Options:
  --activity-id <id>    Monopoly activityId (required), e.g. 9961
  --spot-code <code>    Spot pair code for WXT (default: 90000205 = 现货pro:WXT-USDT)
  --contract-code <c>   Contract pair code for WXT (optional; if omitted, TRADING_VOLUME will be skipped)
  --dry-run             Print plan only; no API writes
  --help                Show help

Behavior:
  - Reads /prod-api/activity/config/{activityId} and collects all taskIds under monopolyList[].taskConfig
  - For tasks with requirements:
      - SPOT_TRADING_VOLUME: set currencySupportType=PARTIALLY_SUPPORT and productCodeList=[spot-code]
      - TRADING_VOLUME: set currencySupportType=PARTIALLY_SUPPORT and productCodeList=[contract-code] (if provided)
  - Keeps other requirement fields unchanged.
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--dry-run"],
    strings: ["--activity-id", "--spot-code", "--contract-code"]
  });
  args.dryRun = Boolean(args.dryRun);
  args.activityId = args.activityId ? Number(args.activityId) : null;
  args.spotCode = String(args.spotCode || "90000205");
  args.contractCode = args.contractCode ? String(args.contractCode) : null;
  return args;
}

const TARGET_REQUIREMENT_TYPES = {
  CONTRACT: "TRADING_VOLUME",
  SPOT: "SPOT_TRADING_VOLUME"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestWithRetry(fn, { maxAttempts = 12, label = "request" } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fn();
      const code = Number(res?.body?.code);
      const msg = String(res?.body?.msg || res?.body?.message || "");
      if (code === 200) return res;
      if (code === 500 && /系统繁忙|busy|稍后再试/i.test(msg)) {
        lastError = new Error(`${label} busy (attempt ${attempt}/${maxAttempts}): ${msg || "code=500"}`);
        await sleep(8000 + 5000 * attempt);
        continue;
      }
      throw new Error(`${label} failed: ${JSON.stringify({ code, msg })}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(5000 + 3000 * attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error(`${label} failed (no error captured)`);
}

async function getActivityDetail(session, activityId) {
  const res = await requestWithRetry(
    () => session.get(`/prod-api/activity/config/${activityId}`),
    { label: "activity detail", maxAttempts: 15 }
  );
  if (res.status >= 400) throw new Error(`activity detail HTTP ${res.status}`);
  return res.body?.data ?? res.body;
}

async function getTaskDetail(session, id) {
  const res = await requestWithRetry(
    () => session.get(`/prod-api/activity/task/${id}`),
    { label: `task detail ${id}`, maxAttempts: 12 }
  );
  if (res.status >= 400) throw new Error(`task detail HTTP ${res.status}`);
  return res.body?.data ?? res.body;
}

function collectMonopolyTaskIds(activityDetail) {
  const monoList = Array.isArray(activityDetail?.monopolyList) ? activityDetail.monopolyList : [];
  const ids = new Set();
  for (const mono of monoList) {
    const taskConfig = mono?.taskConfig || {};
    for (const [key, module] of Object.entries(taskConfig)) {
      if (key === "pointMilestoneTask") {
        for (const [subKey, subModule] of Object.entries(module || {})) {
          const tasks = Array.isArray(subModule?.tasks) ? subModule.tasks : [];
          tasks.forEach(t => t?.taskId && ids.add(Number(t.taskId)));
        }
        continue;
      }
      const tasks = Array.isArray(module?.tasks) ? module.tasks : [];
      tasks.forEach(t => t?.taskId && ids.add(Number(t.taskId)));
    }
  }
  return Array.from(ids).filter(Boolean).sort((a, b) => a - b);
}

function updateRequirementPairSelection(requirementList, { spotCode, contractCode }) {
  if (!Array.isArray(requirementList) || requirementList.length === 0) {
    return { changed: false, requirement: requirementList };
  }
  let changed = false;
  const next = requirementList.map(req => {
    const type = String(req?.type || "");
    if (type === TARGET_REQUIREMENT_TYPES.SPOT) {
      const nextReq = { ...req, currencySupportType: "PARTIALLY_SUPPORT", productCodeList: [spotCode] };
      if (JSON.stringify(nextReq) !== JSON.stringify(req)) changed = true;
      return nextReq;
    }
    if (type === TARGET_REQUIREMENT_TYPES.CONTRACT) {
      if (!contractCode) return req;
      const nextReq = { ...req, currencySupportType: "PARTIALLY_SUPPORT", productCodeList: [contractCode] };
      if (JSON.stringify(nextReq) !== JSON.stringify(req)) changed = true;
      return nextReq;
    }
    return req;
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
  const res = await requestWithRetry(
    () => session.put("/prod-api/activity/task", payload),
    { label: `update task ${payload?.id}`, maxAttempts: 15 }
  );
  if (res.status >= 400) throw new Error(`update task HTTP ${res.status}`);
  return res.body;
}

function assertUpdated(taskDetail, { spotCode, contractCode }) {
  const reqList = Array.isArray(taskDetail?.requirement) ? taskDetail.requirement : [];
  for (const req of reqList) {
    const type = String(req?.type || "");
    if (type === TARGET_REQUIREMENT_TYPES.SPOT) {
      if (String(req?.currencySupportType) !== "PARTIALLY_SUPPORT") throw new Error(`verify failed: spot currencySupportType not updated (task ${taskDetail?.id})`);
      const list = Array.isArray(req?.productCodeList) ? req.productCodeList : [];
      if (list.length !== 1 || String(list[0]) !== String(spotCode)) throw new Error(`verify failed: spot productCodeList not updated (task ${taskDetail?.id})`);
    }
    if (type === TARGET_REQUIREMENT_TYPES.CONTRACT && contractCode) {
      if (String(req?.currencySupportType) !== "PARTIALLY_SUPPORT") throw new Error(`verify failed: contract currencySupportType not updated (task ${taskDetail?.id})`);
      const list = Array.isArray(req?.productCodeList) ? req.productCodeList : [];
      if (list.length !== 1 || String(list[0]) !== String(contractCode)) throw new Error(`verify failed: contract productCodeList not updated (task ${taskDetail?.id})`);
    }
  }
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.activityId || Number.isNaN(args.activityId)) {
    throw new Error("--activity-id is required");
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const { chromium } = loadPlaywright();
  const session = await createAdminApiSession({ chromium, config });

  try {
    const detail = await getActivityDetail(session, args.activityId);
    const taskIds = collectMonopolyTaskIds(detail);

    if (args.dryRun) {
      printJson({
        ok: true,
        dryRun: true,
        activityId: args.activityId,
        totalTaskIds: taskIds.length,
        spotCode: args.spotCode,
        contractCode: args.contractCode,
        taskIds
      });
      return 0;
    }

    const updated = [];
    const skipped = [];
    const contractSkipped = [];
    for (const id of taskIds) {
      const task = await getTaskDetail(session, id);
      const { changed, requirement } = updateRequirementPairSelection(task.requirement, { spotCode: args.spotCode, contractCode: args.contractCode });
      const hasContract = Array.isArray(task?.requirement) && task.requirement.some(r => String(r?.type) === TARGET_REQUIREMENT_TYPES.CONTRACT);
      if (hasContract && !args.contractCode) contractSkipped.push({ id, name: task.name });
      if (!changed) {
        skipped.push({ id, name: task.name });
        continue;
      }
      await updateTask(session, buildUpdatePayload(task, requirement));
      const after = await getTaskDetail(session, id);
      assertUpdated(after, { spotCode: args.spotCode, contractCode: args.contractCode });
      updated.push({ id, name: task.name });
    }

    printJson({
      ok: true,
      activityId: args.activityId,
      totalTaskIds: taskIds.length,
      spotCode: args.spotCode,
      contractCode: args.contractCode,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      contractSkippedCount: contractSkipped.length,
      updated,
      contractSkipped
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

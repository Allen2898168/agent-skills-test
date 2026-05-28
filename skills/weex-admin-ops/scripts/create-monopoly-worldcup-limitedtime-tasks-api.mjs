#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-monopoly-worldcup-limitedtime-tasks-api.mjs

Options:
  --dry-run                 Print plan only; no API writes
  --force                   Create even if same-name task exists
  --help                    Show help

Fixed range:
  - start: 2026-05-26
  - end:   2026-06-30

Notes:
  - Creates LIMITED_TIME tasks for Monopoly modules:
    - limitedTimeTask: APPLY / REGISTER_PASS / RECHARGE (reward must be DICE)
    - pointMilestoneBasicTradingTask & pointMilestoneAdvancedTradingTask: TRADING_VOLUME (reward must be INTEGRAL)
  - Splits tasks by timeType: DURING vs AFTER (RECHARGE only AFTER).
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--force"] });
  args.dryRun = Boolean(args.dryRun);
  args.force = Boolean(args.force);
  return args;
}

const MONOPOLY_ACTIVITY_TYPE = "MONOPOLY_WORLD_CUP";
const ALLOW_RANGE_NONE = "NONE";
const COMPARE = "GREATER_EQUAL";
const REQUIRED_VOLUME = 10;
const AWARD_MIN = 10;
const AWARD_MAX = 100;

const RESET_TYPE_LIMITED = "LIMITED_TIME";

const TIME_TYPES = {
  DURING: "DURING",
  AFTER: "AFTER"
};

// 不配置下单方式：下单方式留空表示不限制
const CONTRACT_ORDER_TYPES = [];
const CONTRACT_VOLUME_COUNT_TYPE = ["FEE"];

const DT_START = "2026-05-26 00:00:00";
const DT_END = "2026-06-30 23:59:59";
const DATE_START = "2026-05-26";
const DATE_END = "2026-06-30";

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
  return {
    resetType: RESET_TYPE_LIMITED,
    resetDay: null,
    resetTime: null
  };
}

function rewardSupportsAmount(prizeSubType) {
  const noAmount = new Set([
    "VIP",
    "POSITION_AIRDROP",
    "MULTIPLIER_COUPON",
    "FINANCIAL_INTEREST_COUPON",
    "DAILY_FIXED_INCOME_COUPON"
  ]);
  return !noAmount.has(String(prizeSubType || ""));
}

function taskAwardFields({ awardPrize }) {
  const supportsAmount = rewardSupportsAmount(awardPrize.prizeSubType);
  return {
    taskAward: {
      awardMode: "SINGLE",
      awardPrizeId: awardPrize.id,
      prizeType: awardPrize.prizeType,
      prizeSubType: awardPrize.prizeSubType,
      multiplier: awardPrize.multiplier ?? null,
      awardAmountMin: supportsAmount ? AWARD_MIN : null,
      awardAmountMax: supportsAmount ? AWARD_MAX : null,
      awardAmount: null,
      dailyLimit: null,
      totalLimit: null,
      compensationRatioType: null,
      rewardOrderCreated: null
    }
  };
}

function buildRequirementBase({ type, timeType, startTime, endTime }) {
  return {
    type,
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
    requiredVolume: REQUIRED_VOLUME
  };
}

function buildLimitedTaskRequirement({ type, timeType }) {
  // APPLY / REGISTER_PASS are unConfigurableValuesTasks: verifyType/requiredVolume should be null to match UI.
  if (type === "APPLY" || type === "REGISTER_PASS") {
    return {
      ...buildRequirementBase({ type, timeType, startTime: DT_START, endTime: DT_END }),
      verifyType: null,
      requiredVolume: null
    };
  }
  // RECHARGE is configurable; keep >= and requiredVolume.
  if (type === "RECHARGE") {
    return buildRequirementBase({ type, timeType, startTime: DT_START, endTime: DT_END });
  }
  throw new Error(`unsupported limitedTimeTask type: ${type}`);
}

function buildLimitedMilestoneTradingRequirement({ timeType }) {
  return {
    // Use datetime to avoid backend "busy" issues observed with date-only values.
    ...buildRequirementBase({ type: "TRADING_VOLUME", timeType, startTime: DT_START, endTime: DT_END }),
    currencySupportType: "ALL_SUPPORTED",
    productCodeList: [],
    productCodeNameList: [],
    volumeCountType: CONTRACT_VOLUME_COUNT_TYPE,
    orderTypeList: CONTRACT_ORDER_TYPES,
    isFirst: 0
  };
}

function buildPlannedTasks({ dicePrize, integralPrize }) {
  const plan = [];

  // limitedTimeTask: APPLY / REGISTER_PASS split by DURING/AFTER; RECHARGE only AFTER
  for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
    plan.push({
      name: `报名(限时/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-骰子`,
      requirement: buildLimitedTaskRequirement({ type: "APPLY", timeType }),
      awardPrize: dicePrize
    });
    plan.push({
      name: `注册(限时/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-骰子`,
      requirement: buildLimitedTaskRequirement({ type: "REGISTER_PASS", timeType }),
      awardPrize: dicePrize
    });
  }
  plan.push({
    name: `充值(限时/报名后)-虚资-骰子`,
    requirement: buildLimitedTaskRequirement({ type: "RECHARGE", timeType: TIME_TYPES.AFTER }),
    awardPrize: dicePrize
  });

  // milestone trading: basic/advanced; each split DURING/AFTER; reward must be INTEGRAL
  for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
    plan.push({
      name: `合里程碑(基础限时/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-积分`,
      requirement: buildLimitedMilestoneTradingRequirement({ timeType }),
      awardPrize: integralPrize
    });
    plan.push({
      name: `合里程碑(进阶限时/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-积分`,
      requirement: buildLimitedMilestoneTradingRequirement({ timeType }),
      awardPrize: integralPrize
    });
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

async function createTask(session, payload) {
  const res = await session.post("/prod-api/activity/task", payload);
  if (res.status >= 400) throw new Error(`create task HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`create task rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTaskWithRetry(session, payload, { maxAttempts = 12 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await session.post("/prod-api/activity/task", payload);
      if (res.status >= 400) throw new Error(`create task HTTP ${res.status}`);
      const code = Number(res.body?.code);
      if (code === 200) return res.body;
      const msg = String(res.body?.msg || res.body?.message || "");
      // transient busy
      if (code === 500 && /系统繁忙|busy|稍后再试/i.test(msg)) {
        lastError = new Error(`create task busy (attempt ${attempt}/${maxAttempts}): ${msg || "code=500"}`);
        // Exponential-ish backoff with a bit more spacing to avoid hammering the service.
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
    const diceRes = await session.get("/prod-api/activity/prize/1040");
    const integralRes = await session.get("/prod-api/activity/prize/1036");
    const dice = diceRes.body?.data || diceRes.body;
    const integral = integralRes.body?.data || integralRes.body;
    const dicePrize = { id: 1040, prizeType: dice?.prizeType, prizeSubType: dice?.prizeSubType, multiplier: dice?.multiplier ?? null };
    const integralPrize = { id: 1036, prizeType: integral?.prizeType, prizeSubType: integral?.prizeSubType, multiplier: integral?.multiplier ?? null };

    const plan = buildPlannedTasks({ dicePrize, integralPrize });
    if (args.dryRun) {
      printJson({ ok: true, dryRun: true, total: plan.length, names: plan.map(v => v.name) });
      return 0;
    }

    const created = [];
    const skipped = [];
    for (const item of plan) {
      const exists = await findTaskByName(session, item.name);
      if (exists && !args.force) {
        skipped.push({ name: item.name, id: exists.id });
        continue;
      }

      const payload = {
        ...baseTaskFields(item.name),
        ...taskRangeFields(),
        ...additionalFields(),
        ...requirementsFormFields(item.requirement),
        ...taskAwardFields({ awardPrize: item.awardPrize })
      };

      const isMilestoneTrading = item.requirement.type === "TRADING_VOLUME";
      await createTaskWithRetry(session, payload, { maxAttempts: isMilestoneTrading ? 30 : 12 });
      // Give backend some breathing room; TRADING_VOLUME LIMITED_TIME is especially heavy.
      await sleep(isMilestoneTrading ? 15000 : 500);
      const verified = await findTaskByName(session, item.name);
      if (!verified) throw new Error(`verify failed: task not found by name ${item.name}`);
      created.push({ name: item.name, id: verified.id, timeType: item.requirement.timeType, taskType: item.requirement.type, awardPrizeId: item.awardPrize.id });
    }

    printJson({ ok: true, total: plan.length, createdCount: created.length, skippedCount: skipped.length, created, skipped });
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

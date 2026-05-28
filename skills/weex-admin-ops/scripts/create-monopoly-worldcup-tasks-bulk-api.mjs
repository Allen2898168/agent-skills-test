#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-monopoly-worldcup-tasks-bulk-api.mjs

Options:
  --dry-run                 Print plan only; no API writes
  --force                   Create even if same-name task exists
  --help                    Show help

Defaults:
  - Activity: MONOPOLY_WORLD_CUP (大富翁世界杯)
  - Compare: GREATER_EQUAL (>=)
  - requiredVolume: 10 (when configurable)
  - awardAmountMin: 10
  - awardAmountMax: 100 (only when reward supports amount; monopoly UI typically disables max but backend may accept it)
  - Contract order types: MANUAL + API + BROKER
  - Excludes LIMITED_TIME tasks by design
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--force"] });
  args.dryRun = Boolean(args.dryRun);
  args.force = Boolean(args.force);
  return args;
}

const COMPARE = "GREATER_EQUAL";
const REQUIRED_VOLUME = 10;
const AWARD_MIN = 10;
const AWARD_MAX = 100;
const MONOPOLY_ACTIVITY_TYPE = "MONOPOLY_WORLD_CUP";
const ALLOW_RANGE_NONE = "NONE";

const TIME_TYPES = {
  DURING: "DURING",
  AFTER: "AFTER"
};

const RESET_TYPES = {
  ONCE: "ONCE",
  DAILY: "DAILY"
};

// 不配置下单方式：下单方式留空表示不限制
const CONTRACT_ORDER_TYPES = [];
const CONTRACT_VOLUME_COUNT_TYPE = ["FEE"];
const SPOT_VOLUME_COUNT_TYPE = ["FEE"];

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

function additionalFields({ resetType, timeType }) {
  const base = {
    resetType,
    resetDay: null,
    resetTime: null,
    timeType,
    startTime: null,
    endTime: null
  };
  if (resetType === RESET_TYPES.DAILY) {
    base.resetTime = "00:00:00";
  }
  return base;
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

function buildRequirement({ type, timeType, resetType, extra = {} }) {
  return {
    type,
    verifyType: COMPARE,
    requiredVolume: REQUIRED_VOLUME,
    timeType,
    startTime: null,
    endTime: null,
    progressType: null,
    linkTaskId: null,
    allowVipWhiteType: null,
    limitVipLevelList: [],
    // monopolyMultiplierCouponFields are derived from taskAward.prizeSubType; backend also receives them in requirement
    // but UI injects them; we set safe defaults here and let backend ignore if not needed.
    isMultiplierCoupon: 0,
    multiplier: null,
    ...extra
  };
}

function buildPlannedTasks({ prizes }) {
  const prizeById = new Map(prizes.map(p => [Number(p.id), p]));
  const getPrize = (id) => {
    const prize = prizeById.get(Number(id));
    if (!prize) throw new Error(`Prize not found in plan: ${id}`);
    return prize;
  };

  const tasks = [];

  // Daily modules (TRADING_VOLUME, SPOT_TRADING_VOLUME) with DURING/AFTER
  for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
    tasks.push({
      name: `合量(每日/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-骰子`,
      resetType: RESET_TYPES.DAILY,
      timeType,
      requirement: buildRequirement({
        type: "TRADING_VOLUME",
        timeType,
        resetType: RESET_TYPES.DAILY,
        extra: {
          currencySupportType: "ALL_SUPPORTED",
          productCodeList: [],
          productCodeNameList: [],
          volumeCountType: CONTRACT_VOLUME_COUNT_TYPE,
          orderTypeList: CONTRACT_ORDER_TYPES,
          isFirst: 0
        }
      }),
      awardPrize: getPrize(1040)
    });
    tasks.push({
      name: `现量(每日/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-骰子`,
      resetType: RESET_TYPES.DAILY,
      timeType,
      requirement: buildRequirement({
        type: "SPOT_TRADING_VOLUME",
        timeType,
        resetType: RESET_TYPES.DAILY,
        extra: {
          currencySupportType: "ALL_SUPPORTED",
          productCodeList: [],
          volumeCountType: SPOT_VOLUME_COUNT_TYPE,
          isFirst: 0
        }
      }),
      awardPrize: getPrize(1040)
    });
  }

  // Accumulated ONCE modules
  for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
    tasks.push({
      name: `合量(仅1次/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-骰子`,
      resetType: RESET_TYPES.ONCE,
      timeType,
      requirement: buildRequirement({
        type: "TRADING_VOLUME",
        timeType,
        resetType: RESET_TYPES.ONCE,
        extra: {
          currencySupportType: "ALL_SUPPORTED",
          productCodeList: [],
          productCodeNameList: [],
          volumeCountType: CONTRACT_VOLUME_COUNT_TYPE,
          orderTypeList: CONTRACT_ORDER_TYPES,
          isFirst: 0
        }
      }),
      awardPrize: getPrize(1040)
    });

    tasks.push({
      name: `骰子消耗次数(仅1次/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-积分`,
      resetType: RESET_TYPES.ONCE,
      timeType,
      requirement: buildRequirement({
        type: "DICE_COUNT",
        timeType,
        resetType: RESET_TYPES.ONCE
      }),
      awardPrize: getPrize(1036)
    });
  }

  // Invite (AFTER only)
  tasks.push({
    name: `邀请(仅1次/报名后)-虚资-骰子`,
    resetType: RESET_TYPES.ONCE,
    timeType: TIME_TYPES.AFTER,
    requirement: buildRequirement({
      type: "INVITE_FRIEND",
      timeType: TIME_TYPES.AFTER,
      resetType: RESET_TYPES.ONCE,
      extra: {
        inviteTaskType: "TRADING_VOLUME",
        inviteTradingVerifyType: COMPARE,
        inviteTradingVolume: REQUIRED_VOLUME,
        inviteNetRechargeVerifyType: COMPARE,
        inviteNetRechargeAmount: REQUIRED_VOLUME
      }
    }),
    awardPrize: getPrize(1040)
  });

  // Multiplier-coupon module (ONCE) with DURING/AFTER; prize=1039
  for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
    tasks.push({
      name: `合量(仅1次/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-膨胀券`,
      resetType: RESET_TYPES.ONCE,
      timeType,
      requirement: buildRequirement({
        type: "TRADING_VOLUME",
        timeType,
        resetType: RESET_TYPES.ONCE,
        extra: {
          currencySupportType: "ALL_SUPPORTED",
          productCodeList: [],
          productCodeNameList: [],
          volumeCountType: CONTRACT_VOLUME_COUNT_TYPE,
          orderTypeList: CONTRACT_ORDER_TYPES,
          isFirst: 0
        }
      }),
      awardPrize: getPrize(1039)
    });

    tasks.push({
      name: `现量(仅1次/${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-虚资-膨胀券`,
      resetType: RESET_TYPES.ONCE,
      timeType,
      requirement: buildRequirement({
        type: "SPOT_TRADING_VOLUME",
        timeType,
        resetType: RESET_TYPES.ONCE,
        extra: {
          currencySupportType: "ALL_SUPPORTED",
          productCodeList: [],
          volumeCountType: SPOT_VOLUME_COUNT_TYPE,
          isFirst: 0
        }
      }),
      awardPrize: getPrize(1039)
    });
  }

  // Obtain integral milestone (ONCE) with DURING/AFTER; 5 prizes
  const obtainPrizes = [
    getPrize(1049),
    getPrize(1040),
    getPrize(1037),
    getPrize(1036),
    getPrize(1033)
  ];
  const obtainPrizeShortName = (prize) => {
    const alias = String(prize.prizeAlias || prize.prizeName || "");
    return alias
      .replace(/^虚拟积分或资格-/, "虚资-")
      .replace(/^币种-/, "币种-")
      .replace(/^赠金-/, "赠金-");
  };
  for (const timeType of [TIME_TYPES.DURING, TIME_TYPES.AFTER]) {
    for (const prize of obtainPrizes) {
      tasks.push({
        name: `获得积分(${timeType === TIME_TYPES.DURING ? "活动开始" : "报名后"})-${obtainPrizeShortName(prize)}`,
        resetType: RESET_TYPES.ONCE,
        timeType,
        requirement: buildRequirement({
          type: "OBTAIN_INTEGRAL",
          timeType,
          resetType: RESET_TYPES.ONCE
        }),
        awardPrize: prize
      });
    }
  }

  return tasks;
}

async function findTaskByName(session, name) {
  // list endpoint uses numeric activityType mapping in query; name filter is "name"
  // For MONOPOLY_WORLD_CUP, mapping is 23.
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
    // Fixed prize set from this conversation
    const prizeIds = [1033, 1036, 1037, 1039, 1040, 1049];
    const prizes = [];
    for (const id of prizeIds) {
      const res = await session.get(`/prod-api/activity/prize/${id}`);
      if (res.status >= 400) throw new Error(`prize detail HTTP ${res.status} for ${id}`);
      const data = res.body?.data || res.body;
      prizes.push({
        id: Number(id),
        prizeType: data?.prizeType,
        prizeSubType: data?.prizeSubType,
        prizeName: data?.prizeName,
        prizeAlias: data?.prizeAlias,
        multiplier: data?.multiplier ?? null
      });
    }

    const plan = buildPlannedTasks({ prizes });
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

      const requirement = item.requirement;
      // Inject multiplier-coupon requirement flags based on awardPrize
      const isMultiplierCoupon = String(item.awardPrize.prizeSubType) === "MULTIPLIER_COUPON";
      requirement.isMultiplierCoupon = isMultiplierCoupon ? 1 : 0;
      requirement.multiplier = isMultiplierCoupon ? (item.awardPrize.multiplier ?? null) : null;

      const payload = {
        ...baseTaskFields(item.name),
        ...taskRangeFields(),
        ...additionalFields({ resetType: item.resetType, timeType: item.timeType }),
        ...requirementsFormFields(requirement),
        ...taskAwardFields({ awardPrize: item.awardPrize })
      };

      await createTask(session, payload);
      const verified = await findTaskByName(session, item.name);
      if (!verified) throw new Error(`verify failed: task not found by name ${item.name}`);
      created.push({ name: item.name, id: verified.id, resetType: item.resetType, timeType: item.timeType, taskType: requirement.type, awardPrizeId: item.awardPrize.id });
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

#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-daily-dice-task-from-scratch-fast-api.mjs --dice-prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-daily-dice-task-from-scratch-fast-api.mjs --dice-prize-id 123 --confirm-create

Options:
  --dice-prize-id <id>    required; 任务奖励绑定的骰子奖品ID（VIRTUAL/DICE）
  --required-volume <n>   default 1
  --name-prefix <text>    default 大富翁_合约交易量_每日_骰子
  --tag-prefix <text>     default mwc_dice_s
  --remark <text>         optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.dicePrizeId = args.dicePrizeId ? Number(args.dicePrizeId) : NaN;
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "大富翁_合约交易量_每日_骰子";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "mwc_dice_s";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

function buildRequirement(requiredVolume) {
  return {
    type: "TRADING_VOLUME",
    guessTaskType: null,
    verifyType: "GREATER_EQUAL",
    requiredVolume: Number(requiredVolume),
    activityId: null,
    showUrl: null,
    requiredCount: null,
    isMultiplierCoupon: 0,
    multiplier: null,
    currencySupportType: "ALL_SUPPORTED",
    productCodeList: [],
    spotCurrencySupportType: null,
    spotProductCodeList: [],
    taskRechargeTypeEnum: [],
    rechargeRecipient: null,
    volumeCountType: ["FEE"],
    orderTypeList: [],
    leverVolumeMin: null,
    leverVolumeMax: null,
    isFirst: 0,
    isFirstStroke: null,
    timeType: "AFTER",
    isKYC: null,
    kycAreaIdList: [],
    holdDays: null,
    coinType: null,
    shareLinkI18: [],
    shareFlag: null,
    inviteTaskType: null,
    inviteTradingVerifyType: null,
    inviteTradingVolume: null,
    inviteNetRechargeVerifyType: null,
    inviteNetRechargeAmount: null,
    inviteIsKYC: null,
    inviteKycAreaIdList: [],
    inviteNeedApply: null,
    inviteAutoAward: null,
    isTwoWayAward: null,
    isBindEmail: null,
    isBindMobile: null,
    netTransferAmount: null,
    taskType: null,
    totalTransferAmount: null,
    totalRechargeAmount: null,
    firstRechargeAmount: null,
    firstTradingAmount: null,
    tradingVolume: null,
    netRechargeAmount: null,
    netInviteFriendAmount: null,
    holdAmount: null,
    profitAmount: null,
    taskObjects: [],
    taskUpdate: null,
    updateTime: null,
    startTime: null,
    endTime: null,
    spotDepositCoin: null,
    isAllProductCode: null,
    productCodeNameList: [],
    limitVipLevelList: [],
    allowVipWhiteType: null,
    mediaPlatformType: null,
    startVipLevel: null,
    targetVipLevel: null,
    vipTaskType: null,
    progressType: null,
    maxLever: null,
    countType: null,
    countZeroEarnings: null,
    trainType: null,
    taskTrainUrl: null,
    taskTrainUrlI18: [],
    taskTrainImage: null,
    taskTrainImageI18: [],
    requiredTimeVolume: null,
    exposurePlate: null,
    exposureStat: null,
    isSameLinkUrl: null,
    postLinkUrl: null,
    postLinkTag: null,
    postLinkAccount: null,
    firstRechargeDefinition: null,
    activityLink: null,
  };
}

function buildTaskAward(dicePrizeId) {
  return {
    awardMode: "SINGLE",
    awardPrizeId: Number(dicePrizeId),
    prizeType: "VIRTUAL",
    prizeSubType: "DICE",
    awardPrizeName: null,
    awardAmountMin: null,
    awardAmountMax: null,
    completionTimeStart: null,
    completionTimeEnd: null,
    limitedStart: null,
    limitedPrizeId: null,
    limitedAmountMin: null,
    limitedAmountMax: null,
    limitAwardOperation: null,
    limitAwardOperationValue: null,
    limitAwardCountdownHours: null,
    statisticalPeriod: null,
    partitionTotal: null,
    partitionBasis: null,
    ratio: null,
    partitionLimit: null,
    firstCome: null,
    rankLevelRewards: [],
    rewardOrderCreated: null,
    vipPrizeType: null,
    vipPrizeSubType: null,
    vipAwardPrizeId: null,
    invitePrizeId: null,
    invitePrizeType: null,
    invitePrizeSubType: null,
    invitePrizeName: null,
    inviteAmountMin: null,
    inviteAmountMax: null,
    compensationRatioType: null,
    totalLimit: null,
    dailyLimit: null,
    awardGearConfigList: [],
    miningRewardType: null,
    miningRewardRate: [],
    miningPriceType: null,
    miningSpecifyPrice: null,
    miningRewardTotal: null,
    miningReward: [],
    picture: null,
    vipLevel: null,
    vipEfficientDay: null,
    vipPicture: null,
    vipLinkUrl: null,
    prizeUnit: null,
    mixAwardPrizeId: null,
    mixPrizeType: null,
    mixPrizeSubType: null,
    mixAwardPrizeName: null,
    mixAwardAmountMin: null,
    mixAwardAmountMax: null,
    mixPicture: null,
    mixPrizeUnit: null,
    awardAmount: null,
    bonusAmount: null,
    randomPercent: null,
    productCode: null,
  };
}

function buildTaskPayload(args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.requiredVolume}u_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  const content = `合约交易量≥${args.requiredVolume}U（每日）`.slice(0, 120);
  return {
    activityType: "MONOPOLY_WORLD_CUP",
    taskType: "TRADING_VOLUME",
    allowRange: ["NONE"],
    completeTaskGroupCount: 1,
    taskGroupType: null,
    taskGroupId: null,
    taskGroup: null,
    resetType: "DAILY",
    resetDay: null,
    resetTime: "00:00:00",
    name,
    nameI18: [{ lang: "zh_CN", name }],
    content,
    contentI18: [{ lang: "zh_CN", name: content }],
    label: tag,
    labelI18: [{ lang: "zh_CN", name: tag }],
    labelDesc: "",
    labelDescI18: [{ lang: "zh_CN", name: "" }],
    incompleteButton: null,
    incompleteButtonI18: [],
    taskUrlWeb: null,
    taskUrlApp: null,
    remark: (args.remark || `自动化-大富翁每日合约交易量任务(${args.requiredVolume}U)`).slice(0, 120),
    conditions: {
      allowAgentList: [],
      allowUserList: [],
      allowAreaList: [],
      newUser: null,
      oldUser: null,
      allowRangeLogic: null,
    },
    requirement: [buildRequirement(args.requiredVolume)],
    taskAward: buildTaskAward(args.dicePrizeId),
    isLivenessEnabled: "NO",
    livenessConfig: {
      limitedRange: [],
      limitedAreaIdList: [],
      isPartialTriggerEnabled: "NO",
      triggerCondition: [],
      triggerProbability: null,
      riskControlLabels: [],
      riskControlTotalScore: null,
      mustTriggerCondition: [],
    },
    dynamicAuditConfig: {
      applyCountryIds: [],
      hardRiskLabels: [],
      scoreRiskLabels: [],
      riskTotalScoreThreshold: null,
      inviteCodes: [],
      agencyGroupIds: [],
      triggerMode: "ANY",
      onRiskServiceError: "TRIGGER_MANUAL",
    },
    taskRisk: ["NONE"],
    kycRiskAreaIds: [],
    order: 0,
    awardImage: "",
    isSameLinkUrl: null,
    configStock: false,
    isTaskCoupon: 0,
    versionEdit: 0,
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.dicePrizeId) || args.dicePrizeId <= 0) throw new Error("--dice-prize-id is required");
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  const payload = buildTaskPayload(args);
  const plan = {
    mode: "headless_api",
    activityType: "MONOPOLY_WORLD_CUP(23)",
    writes: { create: true },
    requiredVolume: args.requiredVolume,
    dicePrizeId: args.dicePrizeId,
    preview: { name: payload.name, label: payload.label, resetType: payload.resetType, resetTime: payload.resetTime },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const created = await api.post("/prod-api/activity/task", payload);
    if (created.body?.code !== 200) throw new Error(`Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);
    const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(payload.name)}&pageNum=1&pageSize=1`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created task not found by name: ${payload.name}`);
    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: String(row.id), name: payload.name, tag: payload.label, requiredVolume: args.requiredVolume, dicePrizeId: args.dicePrizeId },
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

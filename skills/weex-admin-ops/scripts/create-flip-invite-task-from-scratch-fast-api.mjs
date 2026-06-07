#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-flip-invite-task-from-scratch-fast-api.mjs --award-subtype FLIP_CARD --award-prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-flip-invite-task-from-scratch-fast-api.mjs --award-subtype FLIP_CARD --award-prize-id 123 --confirm-create

Options:
  --award-subtype <FLIP_CARD|FLIP_INTEGRAL>  required
  --award-prize-id <id>                      required
  --name-prefix <text>                       default 小丑牌邀请任务
  --tag-prefix <text>                        default flip_inv_s
  --remark <text>                            optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.awardSubtype = args.awardSubtype ? String(args.awardSubtype) : "";
  args.awardPrizeId = args.awardPrizeId ? Number(args.awardPrizeId) : NaN;
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "小丑牌邀请任务";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "flip_inv_s";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

function buildRequirement() {
  return {
    type: "INVITE_FRIEND",
    guessTaskType: null,
    verifyType: "GREATER_EQUAL",
    requiredVolume: 1,
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
    volumeCountType: [],
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
    inviteTaskType: "TOTAL_TRADING_VOLUME",
    inviteTradingVerifyType: "GREATER_EQUAL",
    inviteTradingVolume: 0,
    inviteNetRechargeVerifyType: "GREATER_EQUAL",
    inviteNetRechargeAmount: 0,
    inviteIsKYC: 0,
    inviteKycAreaIdList: [],
    inviteNeedApply: 0,
    inviteAutoAward: 1,
    isTwoWayAward: 1,
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

function buildTaskAward({ awardPrizeId, awardSubtype }) {
  return {
    awardMode: "SINGLE",
    awardPrizeId: Number(awardPrizeId),
    prizeType: "VIRTUAL",
    prizeSubType: String(awardSubtype),
    awardPrizeName: null,
    awardAmountMin: 1,
    awardAmountMax: 1,
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
    invitePrizeId: Number(awardPrizeId),
    invitePrizeType: "VIRTUAL",
    invitePrizeSubType: String(awardSubtype),
    invitePrizeName: null,
    inviteAmountMin: 1,
    inviteAmountMax: 1,
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
  const name = `${args.namePrefix}_${args.awardSubtype}_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  return {
    activityType: "FLIP",
    taskType: "INVITE_FRIEND",
    allowRange: ["NONE"],
    completeTaskGroupCount: 1,
    taskGroupType: null,
    resetType: "ONCE",
    taskGroupId: null,
    taskGroup: null,
    resetDay: null,
    resetTime: null,
    taskAward: buildTaskAward({ awardPrizeId: args.awardPrizeId, awardSubtype: args.awardSubtype }),
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
    label: tag,
    labelI18: [{ lang: "zh_CN", name: tag }],
    labelDesc: "",
    labelDescI18: [{ lang: "zh_CN", name: "" }],
    incompleteButton: null,
    incompleteButtonI18: [],
    taskUrlWeb: null,
    taskUrlApp: null,
    taskRisk: ["NONE"],
    kycRiskAreaIds: [],
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
    status: null,
    name,
    nameI18: [{ lang: "zh_CN", name }],
    content: `邀请好友任务（${args.awardSubtype}）`.slice(0, 120),
    contentI18: [{ lang: "zh_CN", name: `邀请好友任务（${args.awardSubtype}）`.slice(0, 120) }],
    remark: (args.remark || `自动化-小丑牌邀请任务(${args.awardSubtype})`).slice(0, 120),
    conditions: {
      allowAgentList: [],
      allowUserList: [],
      allowAreaList: [],
      newUser: null,
      oldUser: null,
      allowRangeLogic: "UNION",
    },
    requirement: [buildRequirement()],
    order: 0,
    prizeInventoryQuantity: null,
    stock: null,
    configStock: false,
    limitRewardNumber: null,
    guessConfig: null,
    guessResult: null,
    guessStatus: null,
    isSameLinkUrl: null,
    awardImage: "",
    linkTaskId: null,
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
  if (!["FLIP_CARD", "FLIP_INTEGRAL"].includes(args.awardSubtype)) throw new Error("--award-subtype must be FLIP_CARD|FLIP_INTEGRAL");
  if (!Number.isFinite(args.awardPrizeId) || args.awardPrizeId <= 0) throw new Error("--award-prize-id is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const payload = buildTaskPayload(args);
  const plan = {
    mode: "headless_api",
    activityType: "FLIP",
    taskType: payload.taskType,
    awardSubtype: args.awardSubtype,
    awardPrizeId: args.awardPrizeId,
    writes: { create: true },
    preview: { name: payload.name, label: payload.label, resetType: payload.resetType },
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
      created: { id: String(row.id), name: payload.name, tag: payload.label, awardSubtype: args.awardSubtype, awardPrizeId: args.awardPrizeId },
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


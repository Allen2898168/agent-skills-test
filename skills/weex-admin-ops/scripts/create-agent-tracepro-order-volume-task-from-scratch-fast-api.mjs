#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-agent-tracepro-order-volume-task-from-scratch-fast-api.mjs --required-volume 1 --award-prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-agent-tracepro-order-volume-task-from-scratch-fast-api.mjs --required-volume 1 --award-prize-id 123 --confirm-create

Options:
  --required-volume <n>   required; 交易量阈值（USDT）
  --award-prize-id <id>   required; 绑定到任务奖励 taskAward.awardPrizeId
  --award-amount <n>      default 1
  --name-prefix <text>    default 代理小活动_交易量
  --tag-prefix <text>     default atptr_s
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
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : NaN;
  args.awardPrizeId = args.awardPrizeId ? Number(args.awardPrizeId) : NaN;
  args.awardAmount = args.awardAmount ? Number(args.awardAmount) : 1;
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "代理小活动_交易量";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "atptr_s";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function prizeDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Prize detail failed: ${id}`);
  return detail.body.data;
}

function buildRequirement(requiredVolume) {
  return {
    type: "ORDER_VOLUME",
    guessTaskType: null,
    verifyType: "GREATER_EQUAL",
    requiredVolume: Number(requiredVolume),
    activityId: null,
    showUrl: null,
    requiredCount: null,
    isMultiplierCoupon: null,
    multiplier: null,
    currencySupportType: "ALL_SUPPORTED",
    productCodeList: [],
    spotCurrencySupportType: null,
    spotProductCodeList: [],
    taskRechargeTypeEnum: [],
    rechargeRecipient: null,
    volumeCountType: ["FEE", "NO_FEE"],
    orderTypeList: [],
    leverVolumeMin: null,
    leverVolumeMax: null,
    isFirst: 2,
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
    taskObjects: ["ORDER", "FOLLOW"],
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

function buildTaskAwardSingle({ prize, awardAmount }) {
  return {
    awardMode: "SINGLE",
    awardPrizeId: Number(prize?.id),
    prizeType: prize?.prizeType ?? null,
    prizeSubType: prize?.prizeSubType ?? null,
    awardPrizeName: null,
    awardAmountMin: Number(awardAmount),
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
    rewardOrderCreated: "FINISHED",
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

function buildTaskPayload(args, prize) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${args.requiredVolume}u_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  const content = `交易量≥${args.requiredVolume}U`.slice(0, 120);
  return {
    activityType: "AGENT_TRACE_PRO",
    taskType: "ORDER_VOLUME",
    allowRange: ["NONE"],
    completeTaskGroupCount: 1,
    taskGroupType: null,
    resetType: "ONCE",
    taskGroupId: null,
    taskGroup: null,
    resetDay: null,
    resetTime: null,
    taskAward: buildTaskAwardSingle({ prize, awardAmount: args.awardAmount }),
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
    labelDesc: null,
    labelDescI18: [],
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
    content,
    contentI18: [{ lang: "zh_CN", name: content }],
    remark: (args.remark || `自动化-代理小活动交易量任务(${args.requiredVolume}U)`).slice(0, 120),
    conditions: {
      allowAgentList: [],
      allowUserList: [],
      allowAreaList: [],
      newUser: null,
      oldUser: null,
      allowRangeLogic: null,
    },
    requirement: [buildRequirement(args.requiredVolume)],
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

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume is required and must be > 0");
  if (!Number.isFinite(args.awardPrizeId) || args.awardPrizeId <= 0) throw new Error("--award-prize-id is required and must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = { mode: "headless_api", activityType: "AGENT_TRACE_PRO(21)", taskType: "ORDER_VOLUME", requiredVolume: args.requiredVolume, awardPrizeId: args.awardPrizeId, awardAmount: args.awardAmount, writes: { create: true } };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const prize = await prizeDetail(api, args.awardPrizeId);
    const payload = buildTaskPayload(args, prize);
    const created = await api.post("/prod-api/activity/task", payload);
    if (created.body?.code !== 200) throw new Error(`Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);

    const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(payload.name)}&pageNum=1&pageSize=1`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created task not found by name: ${payload.name}`);
    const detail = await taskDetail(api, row.id);

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: String(row.id), name: payload.name, tag: payload.label, requiredVolume: args.requiredVolume, awardPrizeId: args.awardPrizeId, awardAmount: args.awardAmount },
      createdTaskDetail: detail,
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


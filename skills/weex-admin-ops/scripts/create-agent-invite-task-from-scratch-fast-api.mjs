#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-agent-invite-task-from-scratch-fast-api.mjs --award-prize-id 123 --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-agent-invite-task-from-scratch-fast-api.mjs --award-prize-id 123 --confirm-create

Options:
  --award-prize-id <id>        required; 邀请任务奖励奖品 ID（通常为赠金奖品）
  --award-amount <n>           default 1
  --invite-trading-volume <n>  default 1
  --invite-net-recharge <n>    default 1
  --name-prefix <text>         default 人人代理_邀请(从零)
  --invited-name-prefix <text> default 人人代理_被邀请(从零)
  --tag-prefix <text>          default agiv_s
  --invited-tag-prefix <text>  default agbe_s
  --remark <text>              optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.awardPrizeId = args.awardPrizeId ? Number(args.awardPrizeId) : NaN;
  args.awardAmount = args.awardAmount ? Number(args.awardAmount) : 1;
  args.inviteTradingVolume = args.inviteTradingVolume ? Number(args.inviteTradingVolume) : 1;
  args.inviteNetRecharge = args.inviteNetRecharge ? Number(args.inviteNetRecharge) : 1;
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "人人代理_邀请(从零)";
  args.invitedNamePrefix = args.invitedNamePrefix ? String(args.invitedNamePrefix) : "人人代理_被邀请(从零)";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "agiv_s";
  args.invitedTagPrefix = args.invitedTagPrefix ? String(args.invitedTagPrefix) : "agbe_s";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

function buildRequirementInvited() {
  return {
    type: "INVITED",
    guessTaskType: null,
    verifyType: null,
    requiredVolume: null,
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
    volumeCountType: [],
    orderTypeList: [],
    leverVolumeMin: null,
    leverVolumeMax: null,
    isFirst: 0,
    isFirstStroke: null,
    timeType: "DURING",
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

function buildRequirementInvite(args) {
  return {
    type: "INVITE_FRIEND",
    guessTaskType: null,
    verifyType: null,
    requiredVolume: 1,
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
    volumeCountType: [],
    orderTypeList: [],
    leverVolumeMin: null,
    leverVolumeMax: null,
    isFirst: 0,
    isFirstStroke: null,
    timeType: "AFTER",
    isKYC: null,
    kycAreaIdList: [],
    holdDays: 1,
    coinType: null,
    shareLinkI18: [],
    shareFlag: null,
    inviteTaskType: "TRADING_VOLUME",
    inviteTradingVerifyType: "GREATER_EQUAL",
    inviteTradingVolume: Number(args.inviteTradingVolume),
    inviteNetRechargeVerifyType: "GREATER_EQUAL",
    inviteNetRechargeAmount: Number(args.inviteNetRecharge),
    inviteIsKYC: null,
    inviteKycAreaIdList: [],
    inviteNeedApply: null,
    inviteAutoAward: 1,
    isTwoWayAward: 0,
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
    progressType: "REPEAT_INVITE",
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

function buildTaskAwardSingleGiftCash({ awardPrizeId, awardAmount }) {
  return {
    awardMode: "SINGLE",
    awardPrizeId: Number(awardPrizeId),
    prizeType: "GIFT_CASH",
    prizeSubType: "GIFT_CASH",
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

function basePayloadCommon({ activityType, taskType, name, tag, content, remark, taskAward, requirement }) {
  return {
    activityType,
    taskType,
    allowRange: ["NONE"],
    completeTaskGroupCount: 1,
    taskGroupType: null,
    resetType: "ONCE",
    taskGroupId: null,
    taskGroup: null,
    resetDay: null,
    resetTime: null,
    taskAward,
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
    remark,
    conditions: {
      allowAgentList: [],
      allowUserList: [],
      allowAreaList: [],
      newUser: null,
      oldUser: null,
      allowRangeLogic: null,
    },
    requirement: [requirement],
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

async function pickBeginnerTaskGroupId(api) {
  const res = await api.get("/prod-api/activity/taskGroup/list?pageNum=1&pageSize=200");
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  const pick =
    rows.find(r => Number(r?.isBeginner || 0) === 1 && String(r?.groupLevel || "") === "TWO" && Number(r?.status || 0) === 1 && Number(r?.isHide || 0) === 0)
    || rows.find(r => Number(r?.isBeginner || 0) === 1 && String(r?.groupLevel || "") === "TWO" && Number(r?.status || 0) === 1)
    || rows.find(r => Number(r?.isBeginner || 0) === 1 && String(r?.groupLevel || "") === "TWO")
    || rows.find(r => Number(r?.isBeginner || 0) === 1 && Number(r?.status || 0) === 1 && Number(r?.isHide || 0) === 0)
    || rows.find(r => Number(r?.isBeginner || 0) === 1)
    || rows.find(r => r?.id);
  const id = pick?.id ? Number(pick.id) : 0;
  if (!id) throw new Error("未找到可用的 BEGINNER_TASK 任务分组(taskGroupId)；请先在后管配置新手任务Tab/分组。");
  return id;
}

function buildInvitedPayload(args, { taskGroupId }) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.invitedNamePrefix}_${ts}_${short}`.slice(0, 48);
  const tag = `${args.invitedTagPrefix}${short}`.slice(0, 30);
  const content = "被邀请任务".slice(0, 120);
  const remark = (args.remark || `自动化-人人代理被邀请任务_${short}`).slice(0, 120);
  const payload = basePayloadCommon({
    activityType: "BEGINNER_TASK",
    taskType: "INVITED",
    name,
    tag,
    content,
    remark,
    taskAward: {
      awardMode: null,
      awardPrizeId: null,
      prizeType: null,
      prizeSubType: null,
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
    },
    requirement: buildRequirementInvited(),
  });
  payload.taskGroupId = Number(taskGroupId);
  payload.taskGroup = null;
  payload.taskRisk = ["NONE", "AUTO"];
  payload.labelDescI18 = [{ lang: "zh_CN", name: null }];
  return payload;
}

function buildInvitePayload(args, { linkTaskId }) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  const content = "邀请任务".slice(0, 120);
  const remark = (args.remark || `自动化-人人代理邀请任务_${short}`).slice(0, 120);
  const payload = basePayloadCommon({
    activityType: "AGENT",
    taskType: "INVITE_FRIEND",
    name,
    tag,
    content,
    remark,
    taskAward: buildTaskAwardSingleGiftCash({ awardPrizeId: args.awardPrizeId, awardAmount: args.awardAmount }),
    requirement: buildRequirementInvite(args),
  });
  payload.linkTaskId = Number(linkTaskId);
  return payload;
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

async function findCreatedIdByName(api, name) {
  const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(String(name))}&pageNum=1&pageSize=1`);
  const row = firstRow(verify);
  return row?.id ? String(row.id) : null;
}

async function createTask(api, payload) {
  const created = await api.post("/prod-api/activity/task", payload);
  if (created.body?.code !== 200) {
    throw new Error(`Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);
  }
  const id = await findCreatedIdByName(api, payload.name);
  if (!id) throw new Error(`Created task not found by name: ${payload.name}`);
  const detail = await taskDetail(api, id);
  return { id, detail, name: payload.name, tag: payload.label, activityType: payload.activityType, taskType: payload.taskType };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.awardPrizeId) || args.awardPrizeId <= 0) throw new Error("--award-prize-id is required and must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = {
    mode: "headless_api",
    writes: { create: true, createsTwoTasks: true },
    deps: { awardPrizeId: args.awardPrizeId },
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
    const taskGroupId = await pickBeginnerTaskGroupId(api);
    const invitedPayload = buildInvitedPayload(args, { taskGroupId });
    const invited = await createTask(api, invitedPayload);
    const invitePayload = buildInvitePayload(args, { linkTaskId: invited.id });
    const invite = await createTask(api, invitePayload);

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: invite.id, name: invite.name, tag: invite.tag, linkTaskId: invited.id },
      createdTaskDetail: invite.detail,
      createdLinked: { id: invited.id, name: invited.name, tag: invited.tag, activityType: invited.activityType, taskType: invited.taskType },
      createdLinkedTaskDetail: invited.detail,
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

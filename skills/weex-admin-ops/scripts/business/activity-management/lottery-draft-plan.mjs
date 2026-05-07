import { timestamp } from "../../lib/cli.mjs";

export const LOTTERY_DRAFT_DEFAULTS = {
  configType: "正式活动",
  owner: "auto",
  category: "通用",
  platformActivity: "否",
  preorder: "支持",
  calendarEntry: "是",
  calendarSync: "同步",
  lotteryStyle: "圆形转盘",
  prizeRows: 8,
  prizeAmountUsdt: "1",
  prizeStock: "100",
  prizeWeight: "12.5",
  redSignWeight: "12.5",
  whiteSignWeight: "12.5",
  accumulatedDrawCount: "5",
  taskSortCoefficient: "1",
  language: "en_US",
  faqLanguage: "en_US",
};

export function buildLotteryDraftPlan(args = {}) {
  const stamp = args.timestamp || timestamp();
  const titlePrefix = args.titlePrefix || "严格UI转盘抽奖草稿";
  const aliasPrefix = args.aliasPrefix || "strict-ui-lottery";
  const start = args.start || "2026-06-10 00:00:00";
  const end = args.end || "2026-06-30 23:59:59";
  const writeEnabled = Boolean(args.visible && !args.dryRun);
  return {
    timestamp: stamp,
    mode: args.visible ? "visible_browser" : "invisible_browser",
    writeEnabled,
    targetUrl: "/activities/lottery/add",
    listUrl: "/activities/lottery",
    type: "LOTTERY",
    title: `${titlePrefix}${stamp}`,
    alias: `${aliasPrefix}-${stamp}`,
    activityTime: { start, end },
    defaults: LOTTERY_DRAFT_DEFAULTS,
    dependencies: {
      guideTemplate: "Select the first available 转盘抽奖 guide-flow template.",
      registrationTemplate: "Select the first compatible activity registration template.",
      prizes: "Select eight prize records from activity-list prize configuration options.",
      task: "Select one existing 转盘抽奖 activity task, click the module + button, then set sort coefficient.",
      images: "Use the configured default upload image for header/share/prize/FAQ-related image fields.",
    },
    sections: [
      "活动基本信息",
      "抽奖样式配置",
      "抽奖奖品配置",
      "抽奖权重配置",
      "颜色签配置",
      "配置分享信息",
      "奖品每日限制配置",
      "累计次数再权重配置",
      "活动任务信息",
      "多语言",
      "常见问题",
      "活动日历",
    ],
    assertions: [
      "POST /prod-api/activity/config returns HTTP 200 and business code=200.",
      "Search /prod-api/activity/config/list by alias and type=LOTTERY returns total=1.",
      "Created row remains in DRAFT status.",
    ],
    notes: [
      "奖品池ID保持 1-8，不能被通用 input 循环覆盖。",
      "抽奖权重复杂风控行本轮未添加；无业务收益的未配置页面探测已从缓存路径中移除。",
      "多语言与 FAQ 语言选择必须限定在各自模块容器内。",
      "预报名字段真实 label 是 预报名模版；选择支持后必须快速配置模版、开始时间、结束时间。",
      "奖品表按真实列序填写：奖金金额(USDT)、总库存数量、权重（%)；跳过禁用的有效期列。",
    ],
  };
}

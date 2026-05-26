import { timestamp } from "../../lib/cli.mjs";

function buildShortLotteryAlias(prefixValue, stampValue, maxLength = 10) {
  const numericStamp = String(stampValue || "").replace(/\D+/g, "") || "00000000";
  const cleanPrefix = String(prefixValue || "lt")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "lt";
  const suffixLength = cleanPrefix.length <= 2 ? Math.min(8, Math.max(4, maxLength - cleanPrefix.length)) : 4;
  const suffix = numericStamp.slice(-suffixLength).padStart(suffixLength, "0");
  const prefix = cleanPrefix.slice(0, Math.max(1, maxLength - suffix.length));
  return `${prefix}${suffix}`.slice(0, maxLength);
}

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
  const title = args.titleExact || `${titlePrefix}${stamp}`;
  const subtitle = args.subtitle || "严格 UI 复杂配置副标题";
  const aliasPrefix = args.aliasPrefix || "lt";
  const alias = args.aliasExact || buildShortLotteryAlias(aliasPrefix, stamp);
  const defaultWindow = buildDefaultActivityWindow();
  const start = args.start || defaultWindow.start;
  const end = args.end || defaultWindow.end;
  const writeEnabled = Boolean(args.visible && !args.dryRun);
  return {
    timestamp: stamp,
    mode: args.visible ? "visible_browser" : "invisible_browser",
    writeEnabled,
    targetUrl: "/activities/lottery/add",
    listUrl: "/activities/lottery",
    type: "LOTTERY",
    title,
    subtitle,
    alias,
    activityTime: { start, end },
    defaults: LOTTERY_DRAFT_DEFAULTS,
    dependencies: {
      guideTemplate: "Select the first available 转盘抽奖 guide-flow template.",
      registrationTemplate: "Select fixed registration template 【2729】 自动化报名模板_auto_manual_20260505161031 for 用户报名模版.",
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
      "默认活动别名必须控制在 10 个字符以内；只有别名边界值测试才允许显式传入更长 alias。",
      "多任务活动可通过 --activity-task-labels 或 LOTTERY_ACTIVITY_TASK_LABELS 传入，分隔符支持 | 或逗号。",
    ],
  };
}

function buildDefaultActivityWindow() {
  const now = new Date();
  const start = new Date(now.getTime() + 4 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function formatDateTimeInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

import { timestamp } from "../../lib/cli.mjs";

export const GUIDE_ACTIVITY_TYPES = {
  trading_competition: { label: "交易大赛", value: "TRADING_COMPETITION", supported: true },
  race_competition: { label: "交易竞速赛", value: "RACE_COMPETITION", supported: true },
  beginner_task: { label: "新手活动", value: "BEGINNER_TASK", supported: true },
  lottery: { label: "转盘抽奖", value: "LOTTERY", supported: true },
  trace_pro: { label: "小活动型活动", value: "TRACE_PRO", supported: true },
  customized: { label: "定制化活动", value: "CUSTOMIZED", supported: true },
  recharge_trans_task: { label: "充值交易活动", value: "RECHARGE_TRANS_TASK", supported: true },
  agent: { label: "人人代理活动", value: "AGENT", supported: true },
  contract_mining: { label: "合约挖矿活动", value: "CONTRACT_MINING", supported: true },
  flip: { label: "小丑牌活动", value: "FLIP", supported: true },
  guess: { label: "竞猜大赛", value: "GUESS", supported: true },
  agent_trace_pro: { label: "代理小活动", value: "AGENT_TRACE_PRO", supported: true },
  none: { label: "暂无特殊配置", value: "NONE", supported: false, blockedReason: "POST /activity/guideTemplate returns code=500" },
};

export const GUIDE_FREQUENCIES = {
  every_visit: { label: "每次访问", value: "EVERY_VISIT" },
  daily_first: { label: "每日首次访问", value: "DAILY_FIRST" },
  user_first: { label: "用户首次访问", value: "USER_FIRST" },
};

const DEFAULT_STATIC_IMAGE = "https://s3.weexstg.com/otc/images/commonFile/0bc69943370645596e200bdff7d653dc481591a50f60892bdc08c3c107b9f1ee.webp";
const DEFAULT_GIF = "https://s3.weexstg.com/otc/images/commonFile/26e097c2fe06787609919a8984ca591ec02bc9ab4c111a10833dc1718440d832.gif";

export function buildGuideTemplatePlan(args = {}) {
  const stamp = args.timestamp || timestamp();
  const modeLabel = args.modeLabel || (args.visible ? "浏览器" : "无浏览器");
  const includeNone = Boolean(args.includeNone);
  if (args.activityTypes || args.frequencies || args.steps) {
    return buildCustomPlan(args, { stamp, modeLabel, includeNone });
  }
  const records = [];
  let index = 1;
  for (const type of Object.values(GUIDE_ACTIVITY_TYPES)) {
    if (!type.supported && !includeNone) continue;
    records.push(buildRecord({ modeLabel, type, frequency: GUIDE_FREQUENCIES.every_visit, steps: 1, index: index++, stamp }));
  }
  records.push(buildRecord({ modeLabel, type: GUIDE_ACTIVITY_TYPES.trading_competition, frequency: GUIDE_FREQUENCIES.daily_first, steps: 1, index: index++, stamp }));
  records.push(buildRecord({ modeLabel, type: GUIDE_ACTIVITY_TYPES.trading_competition, frequency: GUIDE_FREQUENCIES.user_first, steps: 1, index: index++, stamp }));
  records.push(buildRecord({ modeLabel, type: GUIDE_ACTIVITY_TYPES.trading_competition, frequency: GUIDE_FREQUENCIES.every_visit, steps: 2, index: index++, stamp }));
  return records;
}

export function guideActivityTypeCatalog() {
  return Object.entries(GUIDE_ACTIVITY_TYPES).map(([key, value]) => ({ key, ...value }));
}

export function guideFrequencyCatalog() {
  return Object.entries(GUIDE_FREQUENCIES).map(([key, value]) => ({ key, ...value }));
}

export function guidePayload(record) {
  const payload = {
    activityType: record.activityType,
    templateName: record.name,
    displayFrequency: record.displayFrequency,
    step1I18nConfig: guideStepConfig(record, 1),
  };
  if (record.steps >= 2) payload.step2I18nConfig = guideStepConfig(record, 2);
  if (record.steps >= 3) payload.step3I18nConfig = guideStepConfig(record, 3);
  return payload;
}

function buildRecord({ modeLabel, type, frequency, steps, index, stamp }) {
  return {
    modeLabel,
    typeLabel: type.label,
    activityType: type.value,
    frequencyLabel: frequency.label,
    displayFrequency: frequency.value,
    steps,
    no: String(index).padStart(2, "0"),
    timestamp: stamp,
    supported: type.supported,
    blockedReason: type.blockedReason,
    name: `${modeLabel}_${type.label}_${frequency.label}_${steps}步_${String(index).padStart(2, "0")}_${stamp}`,
  };
}

function buildCustomPlan(args, { stamp, modeLabel, includeNone }) {
  const types = parseCatalogList(args.activityTypes, GUIDE_ACTIVITY_TYPES, "activity type")
    || Object.values(GUIDE_ACTIVITY_TYPES).filter(type => type.supported || includeNone);
  const frequencies = parseCatalogList(args.frequencies, GUIDE_FREQUENCIES, "frequency")
    || [GUIDE_FREQUENCIES.every_visit];
  const stepsList = parseSteps(args.steps || "1");
  const records = [];
  let index = 1;
  for (const type of types) {
    if (!type.supported && !includeNone) continue;
    for (const frequency of frequencies) {
      for (const steps of stepsList) {
        records.push(buildRecord({ modeLabel, type, frequency, steps, index: index++, stamp }));
      }
    }
  }
  return records;
}

function parseCatalogList(value, catalog, label) {
  if (!value) return null;
  const values = value.split(",").map(item => item.trim()).filter(Boolean);
  return values.map(item => {
    const normalized = normalize(item);
    const entry = Object.entries(catalog).find(([key, def]) => (
      normalize(key) === normalized || normalize(def.value) === normalized || normalize(def.label) === normalized
    ));
    if (!entry) throw new Error(`Unknown guide ${label}: ${item}`);
    return entry[1];
  });
}

function parseSteps(value) {
  const steps = value.split(",").map(item => Number(item.trim())).filter(Number.isFinite);
  const bad = steps.filter(item => item < 1 || item > 3 || !Number.isInteger(item));
  if (!steps.length || bad.length) throw new Error("--steps must contain integers between 1 and 3");
  return steps;
}

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function guideStepConfig(record, stepNo) {
  const base = `${record.modeLabel}-${record.typeLabel}-${record.frequencyLabel}-步骤${stepNo}`;
  return {
    en_US: {
      title: `${base} title`,
      content: `${base} content`,
      buttonText: `Button ${stepNo}`,
      h5Image: DEFAULT_STATIC_IMAGE,
      h5Gif: DEFAULT_GIF,
      webImage: DEFAULT_STATIC_IMAGE,
      webGif: DEFAULT_GIF,
    },
  };
}

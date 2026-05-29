import fs from "node:fs";
import path from "node:path";

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function ensureActivityWebDir(repoRoot) {
  const candidates = [
    process.env.ACTIVITY_WEB_DIR,
    path.join(repoRoot, "activity-web"),
    path.resolve(repoRoot, "../activity-web"),
    path.resolve(repoRoot, "../../activity-web"),
  ].filter(Boolean);
  for (const activityWebDir of candidates) {
    if (fs.existsSync(activityWebDir)) return activityWebDir;
  }
  throw new Error(`activity-web not found: ${candidates.join(" or ")}`);
}

export function extractLotteryRaffleStyles(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/lottery/components/styleForm.vue");
  const text = readFileSafe(filePath);
  const styles = [];
  const re = /value:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g;
  for (const match of text.matchAll(re)) styles.push({ value: match[1], label: match[2] });
  return { filePath, styles };
}

export function extractActivityTaskListTypes(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/const/index.js");
  const text = readFileSafe(filePath);
  const start = text.indexOf("export const ACTIVITY_TASK_LIST_TYPE");
  if (start < 0) return { filePath, options: [] };
  const braceStart = text.indexOf("{", start);
  if (braceStart < 0) return { filePath, options: [] };
  const braceEnd = text.indexOf("}\n", braceStart);
  if (braceEnd < 0) return { filePath, options: [] };
  const chunk = text.slice(braceStart, braceEnd + 1);
  const options = [];
  const re = /([A-Z0-9_]+)\s*:\s*\{\s*label:\s*'([^']+)'\s*,\s*value:\s*'([^']+)'\s*\}/g;
  for (const match of chunk.matchAll(re)) {
    options.push({ key: match[1], label: match[2], value: match[3] });
  }
  return { filePath, options };
}

function extractElCardHeader(filePath) {
  const text = readFileSafe(filePath);
  const match = text.match(/<el-card[^>]*\sheader="([^"]+)"[^>]*>/m);
  return match?.[1] ? String(match[1]).trim() : "";
}

function extractDefinePropsDefaultTitle(filePath) {
  const text = readFileSafe(filePath);
  // match: defineProps({ title: { ..., default: '用户报名' } ... })
  const match = text.match(/defineProps\s*\(\s*\{\s*[\s\S]*?\btitle\s*:\s*\{\s*[\s\S]*?\bdefault\s*:\s*'([^']+)'\s*[\s\S]*?\}\s*[\s\S]*?\}\s*\)\s*/m);
  return match?.[1] ? String(match[1]).trim() : "";
}

function extractHeaderFromConditionalExpression(filePath) {
  const text = readFileSafe(filePath);
  // match: :header="showCard ? '奖池配置' : undefined"
  const match = text.match(/:header\s*=\s*"[^"]*?\?\s*'([^']+)'\s*:\s*undefined[^"]*?"/m);
  return match?.[1] ? String(match[1]).trim() : "";
}

function extractElCardHeaderSmart(filePath) {
  return (
    extractElCardHeader(filePath)
    || extractDefinePropsDefaultTitle(filePath)
    || extractHeaderFromConditionalExpression(filePath)
  );
}

export function extractNewbieActivityModuleNameMap(activityWebDir) {
  const sources = {
    base: "activity-ui/src/views/activity/newbie/components/baseForm.vue",
    userApply: "activity-ui/src/views/activity/newbie/components/userApply.vue",
    tasks: "activity-ui/src/views/activity/newbie/components/taskForm/index.vue",
    resourceCard: "activity-ui/src/views/activity/newbie/components/ResourceCardForm.vue",
    i18n: "activity-ui/src/views/activity/newbie/components/i18nConfigForm.vue",
    faq: "activity-ui/src/views/activity/lottery/components/FAQForm.vue",
  };
  const moduleNameMap = {};
  for (const [key, rel] of Object.entries(sources)) {
    const filePath = path.join(activityWebDir, rel);
    const header = extractElCardHeaderSmart(filePath);
    moduleNameMap[key] = header || "";
  }
  return { activityWebDir, sources, moduleNameMap };
}

export function extractCompetitionActivityModuleNameMap(activityWebDir) {
  const sources = {
    base: "activity-ui/src/views/activity/competition/components/baseInfo.vue",
    schedule: "activity-ui/src/views/activity/competition/components/eventSchedule.vue",
    userApply: "activity-ui/src/views/activity/competition/components/userApply.vue",
    prize: "activity-ui/src/views/activity/competition/components/prizeManage.vue",
    contract: "activity-ui/src/views/activity/competition/components/contractInfo.vue",
    rankingReward: "activity-ui/src/views/activity/competition/components/rewardRanking.vue",
    teamAwardSetting: "activity-ui/src/views/activity/competition/components/TeamAwardSetting.vue",
    virtualRanking: "activity-ui/src/views/activity/competition/components/virtualRanking.vue",
    team: "activity-ui/src/views/activity/competition/components/team/index.vue",
    pageSetting: "activity-ui/src/views/activity/competition/components/pageSetting.vue",
    i18n: "activity-ui/src/views/activity/competition/components/langContentSetting.vue",
    faq: "activity-ui/src/views/activity/lottery/components/FAQForm.vue",
    calendar: "activity-ui/src/views/activity/commonTool/ActivityCalendarConfig.vue",
    additionalAward: "activity-ui/src/views/activity/competition/components/compoundCompetition/additionalAwardConfig.vue",
    activityShowType: "activity-ui/src/views/activity/competition/components/compoundCompetition/team/ActivityShowTypeSelector.vue",
    poolDivision: "activity-ui/src/views/activity/competition/components/simulate/poolDivision.vue",
    simulateBonusPool: "activity-ui/src/views/activity/competition/components/simulate/simulateContractInfo.vue",
  };
  const moduleNameMap = {};
  for (const [key, rel] of Object.entries(sources)) {
    const filePath = path.join(activityWebDir, rel);
    const header = extractElCardHeaderSmart(filePath);
    moduleNameMap[key] = header || "";
  }
  return { activityWebDir, sources, moduleNameMap };
}

export function resolveOptionValue(input, options) {
  const normalized = normalizeToken(input);
  if (!normalized) return "";
  const hit = (options || []).find(item => (
    normalizeToken(item.value) === normalized
    || normalizeToken(item.key) === normalized
    || normalizeToken(item.label) === normalized
  ));
  return hit ? String(hit.value) : String(input ?? "");
}

export function labelForValue(value, options) {
  const normalized = normalizeToken(value);
  if (!normalized) return "";
  const hit = (options || []).find(item => normalizeToken(item.value) === normalized);
  return hit ? String(hit.label) : "";
}

export function decorateValue(value, options) {
  const label = labelForValue(value, options);
  if (!label) return String(value ?? "");
  const asString = String(value ?? "");
  return label === asString ? asString : `${asString}(${label})`;
}

export function decorateCsvValues(value, options) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  return raw
    .split(",")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => decorateValue(resolveOptionValue(item, options), options))
    .join(",");
}

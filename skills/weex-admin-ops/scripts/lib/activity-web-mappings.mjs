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
    const header = extractElCardHeader(filePath);
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

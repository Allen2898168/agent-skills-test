#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  if (!args.action && !args.help) throw new Error("--action is required");
  args.action = String(args.action || "");
  args.dryRun = Boolean(args.dryRun);
  args.activityAlias = args.activityAlias ? String(args.activityAlias) : "";
  args.activityId = args.activityId ? String(args.activityId) : "";
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "";
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "";
  args.titleExact = args.titleExact ? String(args.titleExact) : "";
  args.aliasExact = args.aliasExact ? String(args.aliasExact) : "";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  return args;
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

function activityWindow(offsetSeconds = 1800, endDays = 30) {
  const start = new Date(Date.now() + Number(offsetSeconds) * 1000);
  const end = new Date(start.getTime() + Number(endDays) * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

async function listByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=BEGINNER_TASK&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function listById(api, id) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=BEGINNER_TASK&activityId=${encodeURIComponent(id)}`);
  return firstRow(list);
}

async function detailById(api, id) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return detail.body.data;
}

async function resolveTarget(api, args) {
  if (args.activityId) {
    const detail = await detailById(api, args.activityId);
    return { id: String(args.activityId), alias: String(detail.showUrl || ""), detail };
  }
  if (!args.activityAlias) throw new Error("--activity-alias or --activity-id is required");
  const row = await listByAlias(api, args.activityAlias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Activity not found by alias: ${args.activityAlias}`);
  const detail = await detailById(api, id);
  return { id: String(id), alias: String(args.activityAlias), detail };
}

function pickStringField(item, keys) {
  for (const key of keys) {
    if (!item || typeof item !== "object") continue;
    if (!(key in item)) continue;
    const hit = String(item[key] ?? "").trim();
    if (hit) return hit;
  }
  return "";
}

function pickI18nRecord(detail, preferredLangs = []) {
  const i18n = Array.isArray(detail?.activityConfigI18n) ? detail.activityConfigI18n : [];
  if (!i18n.length) return null;
  for (const lang of preferredLangs) {
    const hit = i18n.find(item => String(item?.lang || "").toLowerCase() === String(lang || "").toLowerCase());
    if (hit) return hit;
  }
  return i18n[0] || null;
}

function summarizeActivityDetail(item) {
  const resolvedTitle = pickStringField(item, ["title", "activityTitle", "name"]);
  const resolvedSubtitle = pickStringField(item, ["subTitle", "subtitle", "sub_title", "activitySubTitle"]);
  return {
    id: item.id || item.activityId || "",
    activityId: item.activityId || item.id || "",
    type: item.type || "",
    showUrl: item.showUrl || "",
    title: resolvedTitle,
    subTitle: resolvedSubtitle,
    status: item.status || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    periodValidity: item.periodValidity || "",
    multiLanguageTemplateId: item.multiLanguageTemplateId ?? null,
    guideTemplateId: item.guideTemplateId ?? null,
    applyConfigId: item.applyConfigId ?? null,
    taskPackageId: item.taskPackageId ?? null,
    routineTaskPackageId: item.routineTaskPackageId ?? null,
    taskConfigCount: Array.isArray(item.taskConfig) ? item.taskConfig.length : 0,
    routineTaskConfigCount: Array.isArray(item.routineTaskConfig) ? item.routineTaskConfig.length : 0,
    resourceConfigCount: Array.isArray(item.resourceConfig) ? item.resourceConfig.length : 0,
    questionsCount: Array.isArray(item.questions) ? item.questions.length : 0,
    activityConfigI18nCount: Array.isArray(item.activityConfigI18n) ? item.activityConfigI18n.length : 0,
  };
}

function sortedKeys(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).sort();
}

function summarizeArrayShape(value) {
  if (!Array.isArray(value)) return { ok: false, count: 0, itemKeys: [] };
  return { ok: true, count: value.length, itemKeys: sortedKeys(value[0] || {}) };
}

async function snapshot(api, args) {
  const target = await resolveTarget(api, args);
  const item = target.detail || {};
  const detail = summarizeActivityDetail(item);
  const i18n = pickI18nRecord(item, ["zh_CN", "zh-cn", "zh_cn"]);
  const i18nTitle = pickStringField(i18n, ["title", "activityTitle", "name"]);
  const i18nSubtitle = pickStringField(i18n, ["subTitle", "subtitle", "sub_title", "activitySubTitle"]);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    snapshot: {
      title: String(i18nTitle || detail.title || ""),
      subtitle: String(i18nSubtitle || detail.subTitle || ""),
      status: detail.status,
      taskMode: detail.taskPackageId ? "taskPackage" : "custom",
      taskPackageId: detail.taskPackageId,
      taskConfigCount: detail.taskConfigCount,
      routineTaskConfigCount: detail.routineTaskConfigCount,
      resourceConfigCount: detail.resourceConfigCount,
      questionsCount: detail.questionsCount,
      i18nCount: detail.activityConfigI18nCount,
    },
    snapshotMeta: {
      i18nLangUsed: i18n?.lang || null,
      i18nAvailableLangs: Array.isArray(item?.activityConfigI18n)
        ? item.activityConfigI18n.map(record => String(record?.lang || "")).filter(Boolean)
        : [],
    },
  };
}

async function inspectTemplate(api, args) {
  const target = await resolveTarget(api, args);
  const detail = target.detail || {};
  const baseHints = {};
  for (const key of [
    "configType",
    "activityOwner",
    "multiLanguageTemplateId",
    "guideTemplateId",
    "channelCategory",
    "signId",
    "priority",
    "showUrl",
    "startTime",
    "endTime",
    "periodValidity",
    "webBannerUrl",
    "appBannerUrl",
    "shareContent",
    "agentShareContent",
    "intro",
  ]) {
    if (key in detail) baseHints[key] = detail[key];
  }
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    topLevelKeys: sortedKeys(detail),
    moduleKeyHints: {
      base: { keys: sortedKeys(baseHints), sample: baseHints },
      userApply: { applyConfigId: detail.applyConfigId ?? null },
      tasks: {
        taskPackageId: detail.taskPackageId ?? null,
        routineTaskPackageId: detail.routineTaskPackageId ?? null,
        taskConfig: summarizeArrayShape(detail.taskConfig),
        routineTaskConfig: summarizeArrayShape(detail.routineTaskConfig),
      },
      resourceCard: summarizeArrayShape(detail.resourceConfig),
      i18n: summarizeArrayShape(detail.activityConfigI18n),
      faq: summarizeArrayShape(detail.questions),
    },
    summary: summarizeActivityDetail(detail),
  };
}

async function createDraft(api, args) {
  const templateId = String(args.templateId || "");
  const templateAlias = String(args.templateAlias || "");
  if (!templateId && !templateAlias) throw new Error("--template-id/--template-alias is required for create-draft (use an existing full-config newbie activity as template)");
  const templateRow = templateId ? await listById(api, templateId) : await listByAlias(api, templateAlias);
  const resolvedTemplateId = templateRow?.activityId || templateRow?.id;
  if (!resolvedTemplateId) throw new Error(`Template activity not found: ${templateId || templateAlias}`);
  const template = await detailById(api, resolvedTemplateId);

  const ts = buildSuffix();
  const alias = String(args.aliasExact || `${args.aliasPrefix || "nb"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix || "新手全配"}${ts.slice(-6)}`).slice(0, 60);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(template);
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if ("periodValidity" in payload && payload.periodValidity) payload.periodValidity = "";
  if (Array.isArray(payload.periods) && payload.periods[0]) {
    if ("startTime" in payload.periods[0]) payload.periods[0].startTime = window.start;
    if ("endTime" in payload.periods[0]) payload.periods[0].endTime = window.end;
  }
  if ("type" in payload) payload.type = "BEGINNER_TASK";

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create newbie activity draft failed: ${JSON.stringify(created.body)}`);
  const row = await listByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created newbie activity not found: ${alias}`);
  const verifyFirst = summarizeActivityDetail(await detailById(api, id));
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    activityId: String(id),
    alias,
    title,
    createBody: { code: created.body.code, msg: created.body.msg || "" },
    verifyFirst,
  };
}

async function draftChecks(api, args) {
  const target = await resolveTarget(api, args);
  const item = target.detail;
  const summary = summarizeActivityDetail(item);
  const mode = summary.taskPackageId ? "taskPackage" : "custom";
  const hasTasks = mode === "taskPackage"
    ? Boolean(summary.taskPackageId || summary.routineTaskPackageId)
    : summary.taskConfigCount > 0 || summary.routineTaskConfigCount > 0;
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    activityId: target.id,
    alias: target.alias || summary.showUrl || "",
    status: summary.status || "",
    fullConfigChecks: {
      hasMultiLanguageTemplateId: Boolean(summary.multiLanguageTemplateId),
      hasApplyConfigId: Boolean(summary.applyConfigId),
      hasTasks,
      hasResourceCards: summary.resourceConfigCount > 0,
      hasI18n: summary.activityConfigI18nCount > 0,
      hasFaq: summary.questionsCount > 0,
    },
    summary,
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/beginner/online", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() === "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    target: { activityId: target.id, activityAlias: target.alias },
    onlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/beginner/offline", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() !== "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    target: { activityId: target.id, activityAlias: target.alias },
    offlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function remove(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/beginner/delete", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const remaining = target.alias ? await listByAlias(api, target.alias) : null;
  return {
    ok: result.body?.code === 200 && !remaining,
    mode: "headless_api",
    finalUrl: "/activities/newbie",
    target: { activityId: target.id, activityAlias: target.alias },
    deleteBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    rowAbsentAfterSearch: !remaining,
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/newbie-activity-fast-api.mjs --action snapshot|inspect-template|create-draft|draft-checks|online|offline|delete [--activity-alias alias]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const handlers = { snapshot, "inspect-template": inspectTemplate, "create-draft": createDraft, "draft-checks": draftChecks, online, offline, delete: remove };
    const handler = handlers[String(args.action)];
    if (!handler) throw new Error(`Unsupported --action: ${String(args.action)}`);
    const payload = await handler(api, args, config);
    printJson({ ...payload, durationMs: Date.now() - startedAt }, payload.ok ? process.stdout : process.stderr);
    return payload.ok ? 0 : 1;
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


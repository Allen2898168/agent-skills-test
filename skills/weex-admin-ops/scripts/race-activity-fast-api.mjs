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
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=RACE_COMPETITION&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function listById(api, id) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=RACE_COMPETITION&activityId=${encodeURIComponent(id)}`);
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
  return {
    activityId: item.activityId || item.id || "",
    id: item.id || item.activityId || "",
    type: item.type || "",
    showUrl: item.showUrl || "",
    title: pickStringField(item, ["title", "activityTitle", "name"]),
    subTitle: pickStringField(item, ["subTitle", "subtitle", "sub_title", "activitySubTitle"]),
    status: item.status || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    guideTemplateId: item.guideTemplateId ?? null,
    applyConfigId: item.applyConfigId ?? item.applyConfig?.id ?? null,
    requirementsCount: Array.isArray(item.requirements) ? item.requirements.length : 0,
    stageCount: Array.isArray(item.raceFixBonusPoolParams) ? item.raceFixBonusPoolParams.length : 0,
    i18nCount: Array.isArray(item.activityConfigI18n) ? item.activityConfigI18n.length : 0,
    questionsCount: Array.isArray(item.questions) ? item.questions.length : 0,
    ogImageUrl: item.ogImageUrl || "",
    rankType: item.rankType || item.raceParams?.rankType || "",
    isShowLeaderboard: item.raceRankingParams?.isShow ?? 0,
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
  const detail = summarizeActivityDetail(target.detail || {});
  const i18n = pickI18nRecord(target.detail, ["zh_CN", "zh-cn", "zh_cn"]);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    target: { activityId: target.id, activityAlias: target.alias },
    snapshot: {
      title: pickStringField(i18n, ["title"]) || detail.title,
      subtitle: pickStringField(i18n, ["subTitle", "subtitle"]) || detail.subTitle,
      status: detail.status,
      rankType: detail.rankType,
      stageCount: detail.stageCount,
      requirementCount: detail.requirementsCount,
      i18nCount: detail.i18nCount,
      questionsCount: detail.questionsCount,
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
    "channelCategory",
    "guideTemplateId",
    "showUrl",
    "periods",
    "showCountdown",
    "startTime",
    "endTime",
    "tradingType",
    "showActivityCalendar",
    "isPreApply",
    "preApplyConfigId",
    "preApplyStartTime",
    "preApplyEndTime",
  ]) {
    if (key in detail) baseHints[key] = detail[key];
  }
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    topLevelKeys: sortedKeys(detail),
    moduleKeyHints: {
      base: { keys: sortedKeys(baseHints), sample: baseHints },
      userApply: { applyConfigId: detail.applyConfigId ?? detail.applyConfig?.id ?? null },
      speedConfig: {
        requirements: summarizeArrayShape(detail.requirements),
        raceParams: detail.raceParams ? { ok: true, keys: sortedKeys(detail.raceParams) } : { ok: false, keys: [] },
      },
      prizePool: summarizeArrayShape(detail.raceFixBonusPoolParams),
      leaderboard: detail.raceRankingParams ? { ok: true, keys: sortedKeys(detail.raceRankingParams) } : { ok: false, keys: [] },
      pageSetting: { ogImageUrl: detail.ogImageUrl || "" },
      i18n: summarizeArrayShape(detail.activityConfigI18n),
      faq: summarizeArrayShape(detail.questions),
    },
    summary: summarizeActivityDetail(detail),
  };
}

async function createDraft(api, args) {
  const templateId = String(args.templateId || "");
  const templateAlias = String(args.templateAlias || "");
  if (!templateId && !templateAlias) throw new Error("--template-id/--template-alias is required for create-draft");
  const templateRow = templateId ? await listById(api, templateId) : await listByAlias(api, templateAlias);
  const resolvedTemplateId = templateRow?.activityId || templateRow?.id;
  if (!resolvedTemplateId) throw new Error(`Template activity not found: ${templateId || templateAlias}`);
  const template = await detailById(api, resolvedTemplateId);

  const ts = buildSuffix();
  const alias = String(args.aliasExact || `${args.aliasPrefix || "sr"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix || "竞速赛回归"}${ts.slice(-6)}`).slice(0, 60);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(template);
  payload.title = title;
  payload.showUrl = alias;
  payload.type = "RACE_COMPETITION";
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if ("periodValidity" in payload && payload.periodValidity) payload.periodValidity = "";
  if (Array.isArray(payload.periods) && payload.periods[0]) {
    if ("startTime" in payload.periods[0]) payload.periods[0].startTime = window.start;
    if ("endTime" in payload.periods[0]) payload.periods[0].endTime = window.end;
  }
  if (Array.isArray(payload.activityConfigI18n)) {
    payload.activityConfigI18n = payload.activityConfigI18n.map((item, index) => ({
      ...item,
      title: index === 0 ? title : (item.title || `${title}-${item.lang || index}`),
    }));
  }

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create race activity draft failed: ${JSON.stringify(created.body)}`);
  const row = await listByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created race activity not found: ${alias}`);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    activityId: String(id),
    alias,
    title,
    createBody: { code: created.body.code, msg: created.body.msg || "" },
    verifyFirst: summarizeActivityDetail(await detailById(api, id)),
  };
}

async function draftChecks(api, args) {
  const target = await resolveTarget(api, args);
  const summary = summarizeActivityDetail(target.detail);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    activityId: target.id,
    alias: target.alias || summary.showUrl || "",
    status: summary.status || "",
    fullConfigChecks: {
      hasGuideTemplateId: Boolean(summary.guideTemplateId),
      hasApplyConfigId: Boolean(summary.applyConfigId),
      hasRequirements: summary.requirementsCount > 0,
      hasStageList: summary.stageCount > 0,
      hasI18n: summary.i18nCount > 0,
      hasFaq: summary.questionsCount > 0,
      hasOgImage: Boolean(summary.ogImageUrl),
    },
    summary,
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/competition/online", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() === "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    target: { activityId: target.id, activityAlias: target.alias },
    onlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/competition/offline", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() !== "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    target: { activityId: target.id, activityAlias: target.alias },
    offlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function remove(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/competition/delete", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const remaining = target.alias ? await listByAlias(api, target.alias) : null;
  return {
    ok: result.body?.code === 200 && !remaining,
    mode: "headless_api",
    finalUrl: "/activities/speedRace",
    target: { activityId: target.id, activityAlias: target.alias },
    deleteBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    rowAbsentAfterSearch: !remaining,
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/race-activity-fast-api.mjs --action snapshot|inspect-template|create-draft|draft-checks|online|offline|delete [--activity-alias alias]\n");
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

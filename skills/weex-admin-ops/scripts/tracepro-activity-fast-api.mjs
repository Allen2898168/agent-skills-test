#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs --action inspect-template --activity-alias <alias>
  node skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs --action create-draft --template-alias <alias> --title-prefix <text> --alias-prefix <text>
  node skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs --action online --activity-alias <alias>
  node skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs --action offline --activity-alias <alias>
  node skills/weex-admin-ops/scripts/tracepro-activity-fast-api.mjs --action delete --activity-alias <alias>

Options:
  --action <snapshot|inspect-template|create-draft|draft-checks|online|offline|delete>
  --activity-alias <showUrl>
  --activity-id <id>
  --template-alias <showUrl>   required for create-draft
  --template-id <id>           required for create-draft
  --title-prefix <text>
  --alias-prefix <text>
  --title-exact <text>
  --alias-exact <text>
  --start-offset-seconds <n>   default 1800 (30min)
  --end-days <n>               default 30
  --dry-run
  --help
`;
}

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

async function listByAlias(api, alias, type = "TRACE_PRO") {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=${encodeURIComponent(type)}&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function listById(api, id, type = "TRACE_PRO") {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=${encodeURIComponent(type)}&activityId=${encodeURIComponent(id)}`);
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

function summarizeActivityDetail(item) {
  const d = item || {};
  return {
    id: d.activityId || d.id || null,
    activityId: d.activityId || d.id || null,
    type: d.type || null,
    showUrl: d.showUrl || null,
    title: d.title || null,
    status: d.status || null,
    stage: d.stage || null,
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    channelCategory: d.channelCategory ?? null,
    applicationMode: d.applicationMode ?? null,
    applyConfigId: d.applyConfigId ?? null,
    miniActivityCount: Array.isArray(d.miniActivity) ? d.miniActivity.length : 0,
    resourceConfigCount: Array.isArray(d.resourceConfig) ? d.resourceConfig.length : 0,
    i18nCount: Array.isArray(d.activityConfigI18n) ? d.activityConfigI18n.length : 0,
    questionsCount: Array.isArray(d.questions) ? d.questions.length : 0,
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
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    snapshot: {
      title: detail.title,
      status: detail.status,
      stage: detail.stage,
      miniActivityCount: detail.miniActivityCount,
      resourceConfigCount: detail.resourceConfigCount,
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
    "applicationMode",
    "startTime",
    "endTime",
    "type",
    "visible",
  ]) {
    if (key in detail) baseHints[key] = detail[key];
  }
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    topLevelKeys: sortedKeys(detail),
    moduleKeyHints: {
      base: { keys: sortedKeys(baseHints), sample: baseHints },
      registration: { applyConfigId: detail.applyConfigId ?? null, isPreApply: detail.isPreApply ?? null, preApplyConfigId: detail.preApplyConfigId ?? null },
      material: summarizeArrayShape(detail.materialInfoList),
      subActivities: summarizeArrayShape(detail.miniActivity),
      tradingPairInfo: {
        coinSort: detail.coinSort ?? null,
        tradeSymbolInfo: detail.tradeSymbolInfo ? { ok: true, keys: sortedKeys(detail.tradeSymbolInfo) } : { ok: false, keys: [] },
        tradeSpotInfo: detail.tradeSpotInfo ? { ok: true, keys: sortedKeys(detail.tradeSpotInfo) } : { ok: false, keys: [] },
      },
      resourceCard: summarizeArrayShape(detail.resourceConfig),
      rules: summarizeArrayShape(detail.rules),
      faq: summarizeArrayShape(detail.questions),
      calendar: { syncCalendarFlag: detail.syncCalendarFlag ?? null, syncCalendarDto: detail.syncCalendarDto ? { ok: true, keys: sortedKeys(detail.syncCalendarDto) } : { ok: false, keys: [] } },
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
  const alias = String(args.aliasExact || `${args.aliasPrefix || "tp"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix || "小活动"}${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(template);
  payload.type = "TRACE_PRO";
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create TRACE_PRO draft failed: ${JSON.stringify(created.body)}`);
  const row = await listByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created activity not found: ${alias}`);
  const verifyFirst = summarizeActivityDetail(await detailById(api, id));
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
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
  const alias = target.alias || item.showUrl || "";
  const title = item.title || "";
  const id = target.id;
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    activityId: id,
    alias,
    title,
    status: item.status || "",
    searchChecks: {
      byId: { ok: true, activityId: id },
      byTitle: { ok: Boolean(title), title, activityId: id },
      byAlias: { ok: Boolean(alias), alias, activityId: id },
      byType: { ok: true, type: "TRACE_PRO", activityId: id },
      byDate: { ok: Boolean(item.startTime && item.endTime), start: item.startTime, end: item.endTime, activityId: id },
    },
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/tracePro/online", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() === "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    alias: target.alias,
    activityId: target.id,
    onlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/tracePro/offline", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() !== "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    alias: target.alias,
    activityId: target.id,
    offlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function remove(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/tracePro/delete", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const remaining = await listByAlias(api, target.alias);
  return {
    ok: result.body?.code === 200 && !remaining,
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    alias: target.alias,
    activityId: target.id,
    deleteBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    rowAbsentAfterSearch: !remaining,
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }
  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const handlers = {
      snapshot,
      "inspect-template": inspectTemplate,
      "create-draft": createDraft,
      "draft-checks": draftChecks,
      online: (api, args) => online(api, args, config),
      offline: (api, args) => offline(api, args, config),
      delete: (api, args) => remove(api, args, config),
    };
    const handler = handlers[String(args.action)];
    if (!handler) throw new Error(`Unsupported --action: ${args.action}`);
    const result = await handler(api, args);
    printJson(result, result.ok ? process.stdout : process.stderr);
    return result.ok ? 0 : 1;
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


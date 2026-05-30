#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

const LIST_TYPE = "TRACE_PRO";
const CHANNEL_CATEGORY_AGENT = "AGENT";

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs --action inspect-template --activity-alias <alias>
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs --action create-draft --template-alias <alias> --title-prefix <text> --alias-prefix <text>
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs --action online --activity-alias <alias>
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs --action offline --activity-alias <alias>
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-fast-api.mjs --action delete --activity-alias <alias>

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

async function listByAlias(api, alias, type = LIST_TYPE) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", type: String(type), showUrl: String(alias), channelCategory: CHANNEL_CATEGORY_AGENT });
  const list = await api.get(`/prod-api/activity/config/list?${qs.toString()}`);
  return firstRow(list);
}

async function listById(api, id, type = LIST_TYPE) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", type: String(type), activityId: String(id), channelCategory: CHANNEL_CATEGORY_AGENT });
  const list = await api.get(`/prod-api/activity/config/list?${qs.toString()}`);
  return firstRow(list);
}

async function listTemplateByAlias(api, alias, type = LIST_TYPE) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", type: String(type), showUrl: String(alias) });
  const list = await api.get(`/prod-api/activity/config/list?${qs.toString()}`);
  return firstRow(list);
}

async function listTemplateById(api, id, type = LIST_TYPE) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", type: String(type), activityId: String(id) });
  const list = await api.get(`/prod-api/activity/config/list?${qs.toString()}`);
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

function sortedKeys(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).sort();
}

function summarizeArrayShape(value) {
  if (!Array.isArray(value)) return { ok: false, count: 0, itemKeys: [] };
  return { ok: true, count: value.length, itemKeys: sortedKeys(value[0] || {}) };
}

function summarizeActivityDetail(item) {
  const d = item || {};
  return {
    id: d.activityId || d.id || null,
    activityId: d.activityId || d.id || null,
    type: d.type || null,
    title: d.title || null,
    showUrl: d.showUrl || null,
    status: d.status ?? null,
    stage: d.stage ?? null,
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    channelCategory: d.channelCategory ?? null,
    applyConfigId: d.applyConfigId ?? null,
    miniActivityCount: Array.isArray(d.miniActivity) ? d.miniActivity.length : null,
    resourceConfigCount: Array.isArray(d.resourceConfig) ? d.resourceConfig.length : null,
    i18nCount: d.activityConfigI18n ? Object.keys(d.activityConfigI18n || {}).length : null,
    questionsCount: Array.isArray(d.questions) ? d.questions.length : null,
  };
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
      channelCategory: detail.channelCategory,
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
      entry: { portalInfo: detail.portalInfo ? { ok: true, keys: sortedKeys(detail.portalInfo) } : { ok: false, keys: [] } },
      activityData: { activityData: detail.activityData ? { ok: true, keys: sortedKeys(detail.activityData) } : { ok: false, keys: [] } },
      userData: { userData: detail.userData ? { ok: true, keys: sortedKeys(detail.userData) } : { ok: false, keys: [] } },
    },
    summary: summarizeActivityDetail(detail),
  };
}

async function createDraft(api, args) {
  const templateId = String(args.templateId || "");
  const templateAlias = String(args.templateAlias || "");
  if (!templateId && !templateAlias) throw new Error("--template-id/--template-alias is required for create-draft");
  const templateRow = templateId ? await listTemplateById(api, templateId, LIST_TYPE) : await listTemplateByAlias(api, templateAlias, LIST_TYPE);
  const resolvedTemplateId = templateRow?.activityId || templateRow?.id;
  if (!resolvedTemplateId) throw new Error(`Template activity not found: ${templateId || templateAlias}`);
  const template = await detailById(api, resolvedTemplateId);

  const ts = buildSuffix();
  const alias = String(args.aliasExact || `${args.aliasPrefix || "atp"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix || "代理小活动"}${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(template);
  payload.type = LIST_TYPE;
  payload.channelCategory = CHANNEL_CATEGORY_AGENT;
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create AGENT_TRACE_PRO draft failed: ${JSON.stringify(created.body)}`);
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
  const id = target.id;
  const item = await detailById(api, id);
  const alias = target.alias || item.showUrl || "";
  const title = item.title || "";
  const detail = summarizeActivityDetail(item);
  const issues = [];
  if (detail.channelCategory !== CHANNEL_CATEGORY_AGENT) issues.push(`channelCategory expected ${CHANNEL_CATEGORY_AGENT}, got ${detail.channelCategory ?? "<missing>"}`);
  if (!detail.startTime || !detail.endTime) issues.push("missing startTime/endTime");
  if (!detail.applyConfigId) issues.push("missing applyConfigId (用户报名模板)");
  if (!Array.isArray(item.miniActivity) || item.miniActivity.length < 1) issues.push("miniActivity empty");
  return {
    ok: issues.length === 0,
    mode: "headless_api",
    finalUrl: "/activities/copyTrading",
    activityId: id,
    alias,
    title,
    verifyHints: detail,
    issues,
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const id = target.id;
  const res = await api.post("/prod-api/activity/tracePro/online", { activityId: Number(id), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, mode: "headless_api", finalUrl: "/activities/copyTrading", activityId: id, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const id = target.id;
  const res = await api.post("/prod-api/activity/tracePro/offline", { activityId: Number(id), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, mode: "headless_api", finalUrl: "/activities/copyTrading", activityId: id, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function remove(api, args, config) {
  const target = await resolveTarget(api, args);
  const id = target.id;
  const res = await api.post("/prod-api/activity/tracePro/delete", { activityId: Number(id), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, mode: "headless_api", finalUrl: "/activities/copyTrading", activityId: id, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
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
    printJson({ ok: true, dryRun: true, plan: { action: args.action, activityAlias: args.activityAlias || null, activityId: args.activityId || null, templateAlias: args.templateAlias || null, templateId: args.templateId || null } });
    return 0;
  }

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const action = String(args.action || "");
    if (action === "snapshot") printJson(await snapshot(api, args));
    else if (action === "inspect-template") printJson(await inspectTemplate(api, args));
    else if (action === "create-draft") printJson(await createDraft(api, args));
    else if (action === "draft-checks") printJson(await draftChecks(api, args));
    else if (action === "online") printJson(await online(api, args, config));
    else if (action === "offline") printJson(await offline(api, args, config));
    else if (action === "delete") printJson(await remove(api, args, config));
    else throw new Error(`Unknown --action: ${action}`);
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

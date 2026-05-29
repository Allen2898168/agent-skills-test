#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs --action inspect-template --activity-alias <alias>
  node skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs --action create-draft --template-alias <alias> --title-prefix <text> --alias-prefix <text>
  node skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs --action online --activity-alias <alias>
  node skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs --action offline --activity-alias <alias>
  node skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs --action delete --activity-alias <alias>

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

async function listByAlias(api, alias, type = "CONTRACT_MINING") {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=${encodeURIComponent(type)}&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function listById(api, id, type = "CONTRACT_MINING") {
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
  const miningListCount = Array.isArray(d.miningList) ? d.miningList.length : null;
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
    applyConfigId: d.applyConfigId ?? null,
    showActivityCalendar: d.showActivityCalendar ?? null,
    miningListCount,
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
    finalUrl: "/activities/contractMining/index",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    snapshot: {
      title: detail.title,
      status: detail.status,
      stage: detail.stage,
      miningListCount: detail.miningListCount,
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
    "startTime",
    "endTime",
    "type",
    "visible",
    "applyConfigId",
    "showActivityCalendar",
  ]) {
    if (key in detail) baseHints[key] = detail[key];
  }
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/contractMining/edit",
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    topLevelKeys: sortedKeys(detail),
    moduleKeyHints: {
      base: { keys: sortedKeys(baseHints), sample: baseHints },
      notLoggedDescription: detail.miningList?.[0]?.descriptionContent ? { ok: true, keys: sortedKeys(detail.miningList[0].descriptionContent) } : { ok: false, keys: [] },
      channelConfigs: summarizeArrayShape(detail.miningList),
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
  const alias = String(args.aliasExact || `${args.aliasPrefix || "cm"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix || "合约挖矿"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(template);
  payload.type = "CONTRACT_MINING";
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create CONTRACT_MINING draft failed: ${JSON.stringify(created.body)}`);
  const row = await listByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created activity not found: ${alias}`);
  const verifyFirst = summarizeActivityDetail(await detailById(api, id));
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/contractMining/index",
    activityId: String(id),
    alias,
    title,
    subTitle,
    createBody: { code: created.body.code, msg: created.body.msg || "" },
    verifyFirst,
  };
}

async function draftChecks(api, args) {
  const target = await resolveTarget(api, args);
  const item = target.detail;
  const id = target.id;
  const miningList = Array.isArray(item.miningList) ? item.miningList : [];
  const checklist = [
    { ok: item.type === "CONTRACT_MINING", key: "type", expected: "CONTRACT_MINING", actual: item.type ?? null },
    { ok: Boolean(item.showUrl), key: "showUrl", expected: "non-empty", actual: item.showUrl ?? null },
    { ok: Boolean(item.title), key: "title", expected: "non-empty", actual: item.title ?? null },
    { ok: Boolean(item.startTime), key: "startTime", expected: "non-empty", actual: item.startTime ?? null },
    { ok: Boolean(item.endTime), key: "endTime", expected: "non-empty", actual: item.endTime ?? null },
    { ok: Boolean(item.applyConfigId), key: "applyConfigId", expected: "non-empty", actual: item.applyConfigId ?? null },
    { ok: miningList.length >= 1, key: "miningList", expected: ">=1", actual: miningList.length },
    { ok: miningList.length ? Array.isArray(miningList[0]?.taskConfig) && miningList[0].taskConfig.length >= 1 : true, key: "miningList[0].taskConfig", expected: ">=1", actual: miningList[0]?.taskConfig?.length ?? null },
  ];
  const ok = checklist.every(item => item.ok);
  return {
    ok,
    mode: "headless_api",
    finalUrl: "/activities/contractMining/edit",
    activityId: id,
    alias: target.alias || item.showUrl || "",
    summary: summarizeActivityDetail(item),
    draftChecks: checklist,
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const res = await api.post("/prod-api/activity/mining/online", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  return {
    ok: res.body?.code === 200,
    mode: "headless_api",
    finalUrl: "/activities/contractMining/index",
    target: { activityId: target.id, activityAlias: target.alias },
    response: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
  };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const res = await api.post("/prod-api/activity/mining/offline", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  return {
    ok: res.body?.code === 200,
    mode: "headless_api",
    finalUrl: "/activities/contractMining/index",
    target: { activityId: target.id, activityAlias: target.alias },
    response: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
  };
}

async function del(api, args, config) {
  const target = await resolveTarget(api, args);
  const res = await api.post("/prod-api/activity/mining/delete", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  return {
    ok: res.body?.code === 200,
    mode: "headless_api",
    finalUrl: "/activities/contractMining/index",
    target: { activityId: target.id, activityAlias: target.alias },
    response: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
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

  const plan = {
    mode: "headless_api",
    action: args.action,
    target: { activityAlias: args.activityAlias || null, activityId: args.activityId || null },
    writes: ["create-draft", "online", "offline", "delete"].includes(args.action),
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }

  const startedAt = Date.now();
  let api = null;
  try {
    const needsLogin = ["snapshot", "inspect-template", "create-draft", "draft-checks", "online", "offline", "delete"].includes(args.action);
    if (needsLogin) assertAdminLoginConfig(config);
    api = await createAdminApiSession({ config, requireApiLogin: true });

    if (args.action === "snapshot") return printJson(await snapshot(api, args));
    if (args.action === "inspect-template") return printJson(await inspectTemplate(api, args));
    if (args.action === "create-draft") return printJson(await createDraft(api, args));
    if (args.action === "draft-checks") return printJson(await draftChecks(api, args));
    if (args.action === "online") return printJson(await online(api, args, config));
    if (args.action === "offline") return printJson(await offline(api, args, config));
    if (args.action === "delete") return printJson(await del(api, args, config));
    throw new Error(`Unknown --action: ${args.action}`);
  } finally {
    if (api) await api.close();
    const durationMs = Date.now() - startedAt;
    if (process.env.WEEX_DEBUG_DURATION === "1") {
      process.stderr.write(`durationMs=${durationMs}\n`);
    }
  }
}

try {
  await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


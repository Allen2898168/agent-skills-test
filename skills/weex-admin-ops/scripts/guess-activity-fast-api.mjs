#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/guess-activity-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/guess-activity-fast-api.mjs --action inspect-template --activity-alias <alias>
  node skills/weex-admin-ops/scripts/guess-activity-fast-api.mjs --action create-draft --template-alias <alias> --title-prefix <text> --alias-prefix <text>
  node skills/weex-admin-ops/scripts/guess-activity-fast-api.mjs --action online --activity-alias <alias>
  node skills/weex-admin-ops/scripts/guess-activity-fast-api.mjs --action offline --activity-alias <alias>
  node skills/weex-admin-ops/scripts/guess-activity-fast-api.mjs --action delete --activity-alias <alias>

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

async function listByAlias(api, alias, type = "GUESS") {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=${encodeURIComponent(type)}&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function listById(api, id, type = "GUESS") {
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

function sortedKeys(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj).sort();
}

function summarizeActivityDetail(item) {
  const d = item || {};
  const guessList = Array.isArray(d.guessList) ? d.guessList : (Array.isArray(d.guessConfigList) ? d.guessConfigList : []);
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
    guessListCount: guessList.length,
    showActivityCalendar: d.showActivityCalendar ?? null,
    syncCalendarFlag: d.syncCalendarFlag ?? null,
  };
}

async function snapshot(api, args, config) {
  const target = await resolveTarget(api, args);
  const detail = summarizeActivityDetail(target.detail || {});
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/guessCompetition`,
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    snapshot: {
      title: detail.title,
      status: detail.status,
      stage: detail.stage,
      guessListCount: detail.guessListCount,
    },
  };
}

async function inspectTemplate(api, args, config) {
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
    "applyConfigId",
    "showActivityCalendar",
  ]) {
    if (key in detail) baseHints[key] = detail[key];
  }
  const guessList = Array.isArray(detail.guessList) ? detail.guessList : (Array.isArray(detail.guessConfigList) ? detail.guessConfigList : []);
  const firstGuess = guessList[0] || null;
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/guessCompetition`,
    target: { activityId: target.id, activityAlias: target.alias },
    activityId: target.id,
    alias: target.alias,
    topLevelKeys: sortedKeys(detail),
    moduleKeyHints: {
      base: { keys: sortedKeys(baseHints), sample: baseHints },
      guessConfigs: { guessListCount: guessList.length, firstGuessKeys: firstGuess ? sortedKeys(firstGuess) : [] },
      calendar: {
        syncCalendarFlag: detail.syncCalendarFlag ?? null,
        syncCalendarDto: detail.syncCalendarDto ? { ok: true, keys: sortedKeys(detail.syncCalendarDto) } : { ok: false, keys: [] },
      },
    },
    summary: summarizeActivityDetail(detail),
  };
}

function patchTopLevelI18(payload, key, value) {
  const i18Key = `${key}I18`;
  if (Array.isArray(payload[i18Key])) {
    payload[i18Key] = payload[i18Key].map(item => ({ ...item, name: value }));
  }
}

async function createDraft(api, args, config) {
  const templateId = String(args.templateId || "");
  const templateAlias = String(args.templateAlias || "");
  if (!templateId && !templateAlias) throw new Error("--template-id/--template-alias is required for create-draft");
  const templateRow = templateId ? await listById(api, templateId) : await listByAlias(api, templateAlias);
  const resolvedTemplateId = templateRow?.activityId || templateRow?.id;
  if (!resolvedTemplateId) throw new Error(`Template activity not found: ${templateId || templateAlias}`);
  const template = await detailById(api, resolvedTemplateId);

  const ts = buildSuffix();
  const alias = String(args.aliasExact || `${args.aliasPrefix || "guess"}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix || "竞猜大赛"}${ts.slice(-6)}`).slice(0, 120);
  const subTitle = String(`自动化副标题_${ts.slice(-6)}`).slice(0, 120);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);

  const payload = stripCloneFields(template);
  payload.type = "GUESS";
  payload.title = title;
  payload.subTitle = subTitle;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  patchTopLevelI18(payload, "title", title);
  patchTopLevelI18(payload, "subTitle", subTitle);

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create GUESS draft failed: ${JSON.stringify(created.body)}`);
  const row = await listByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created activity not found: ${alias}`);
  const verifyFirst = summarizeActivityDetail(await detailById(api, id));
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/guessCompetition`,
    activityId: String(id),
    alias,
    title,
    subTitle,
    createBody: { code: created.body.code, msg: created.body.msg || "" },
    verifyFirst,
  };
}

async function draftChecks(api, args, config) {
  const target = await resolveTarget(api, args);
  const item = target.detail;
  const guessList = Array.isArray(item.guessList) ? item.guessList : (Array.isArray(item.guessConfigList) ? item.guessConfigList : []);
  const checklist = [
    { ok: item.type === "GUESS", key: "type", expected: "GUESS", actual: item.type ?? null },
    { ok: Boolean(item.showUrl), key: "showUrl", expected: "non-empty", actual: item.showUrl ?? null },
    { ok: Boolean(item.title), key: "title", expected: "non-empty", actual: item.title ?? null },
    { ok: Boolean(item.startTime), key: "startTime", expected: "non-empty", actual: item.startTime ?? null },
    { ok: Boolean(item.endTime), key: "endTime", expected: "non-empty", actual: item.endTime ?? null },
    { ok: Boolean(item.applyConfigId), key: "applyConfigId", expected: "non-empty", actual: item.applyConfigId ?? null },
    { ok: guessList.length >= 1, key: "guessList", expected: ">=1", actual: guessList.length },
    { ok: item.showActivityCalendar === 0 || item.showActivityCalendar === 1, key: "showActivityCalendar", expected: "0/1", actual: item.showActivityCalendar ?? null },
  ];
  const failed = checklist.filter(item => !item.ok);
  return {
    ok: failed.length === 0,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/guessCompetition`,
    target: { activityId: target.id, activityAlias: target.alias || item.showUrl || "" },
    checks: checklist,
    failed,
    summary: summarizeActivityDetail(item),
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const res = await api.post("/prod-api/activity/guess/online", { activityId: Number(target.id) });
  if (res.body?.code !== 200) throw new Error(`Online GUESS failed: ${JSON.stringify(res.body)}`);
  return { ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/guessCompetition`, activityId: target.id, alias: target.alias, response: { code: res.body.code, msg: res.body.msg || "" } };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const res = await api.post("/prod-api/activity/guess/offline", { activityId: Number(target.id) });
  if (res.body?.code !== 200) throw new Error(`Offline GUESS failed: ${JSON.stringify(res.body)}`);
  return { ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/guessCompetition`, activityId: target.id, alias: target.alias, response: { code: res.body.code, msg: res.body.msg || "" } };
}

async function del(api, args, config) {
  const target = await resolveTarget(api, args);
  const res = await api.post("/prod-api/activity/guess/delete", { activityId: Number(target.id) });
  if (res.body?.code !== 200) throw new Error(`Delete GUESS failed: ${JSON.stringify(res.body)}`);
  return { ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/guessCompetition`, activityId: target.id, alias: target.alias, response: { code: res.body.code, msg: res.body.msg || "" } };
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
    printJson({ ok: true, dryRun: true, action: args.action, args });
    return 0;
  }

  if (["snapshot", "inspect-template"].includes(args.action)) {
    assertAdminLoginConfig(config);
    const api = await createAdminApiSession({ config, requireApiLogin: true });
    try {
      const out = args.action === "snapshot" ? await snapshot(api, args, config) : await inspectTemplate(api, args, config);
      printJson(out);
      return 0;
    } finally {
      await api.close();
    }
  }

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    if (args.action === "create-draft") {
      printJson(await createDraft(api, args, config));
      return 0;
    }
    if (args.action === "draft-checks") {
      printJson(await draftChecks(api, args, config));
      return 0;
    }
    if (args.action === "online") {
      printJson(await online(api, args, config));
      return 0;
    }
    if (args.action === "offline") {
      printJson(await offline(api, args, config));
      return 0;
    }
    if (args.action === "delete") {
      printJson(await del(api, args, config));
      return 0;
    }
    throw new Error(`Unsupported action: ${args.action}`);
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


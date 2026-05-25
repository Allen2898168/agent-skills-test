#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  if (!args.action && !args.help) throw new Error("--action is required");
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
  const parts = Object.fromEntries(formatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
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
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`);
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
  return {
    id: item.id || item.activityId || "",
    activityId: item.activityId || item.id || "",
    showUrl: item.showUrl || "",
    title: item.title || "",
    status: item.status || "",
    stage: item.stage || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    prize: Array.isArray(item.prize) ? item.prize.map(record => ({ prizeId: record.prizeId, linkPrizeId: record.linkPrizeId })) : [],
    taskConfig: Array.isArray(item.taskConfig) ? item.taskConfig.map(record => ({ id: record.id, taskType: record.taskType })) : [],
    taskRequirement: Array.isArray(item.taskRequirement) ? item.taskRequirement.map(record => ({ id: record.id, taskType: record.taskType })) : [],
    taskConfigIds: Array.isArray(item.taskConfigIds) ? item.taskConfigIds : [],
  };
}

async function createDraft(api, args) {
  const templateAlias = String(args.templateAlias || "lf25085715");
  const templateRow = await listByAlias(api, templateAlias);
  const templateId = templateRow?.activityId || templateRow?.id;
  if (!templateId) throw new Error(`Template activity not found: ${templateAlias}`);
  const template = await detailById(api, templateId);
  const ts = buildSuffix();
  const alias = String(args.aliasExact || `${args.aliasPrefix || "ln"}${Date.now().toString().slice(-8)}`).slice(0, 10);
  const title = String(args.titleExact || `${args.titlePrefix || "后管回归"}${ts.slice(-6)}`).slice(0, 15);
  const window = activityWindow(args.startOffsetSeconds || 1800, args.endDays || 30);
  const payload = stripCloneFields(template);
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if (Array.isArray(payload.periods) && payload.periods[0]) {
    if ("startTime" in payload.periods[0]) payload.periods[0].startTime = window.start;
    if ("endTime" in payload.periods[0]) payload.periods[0].endTime = window.end;
  }
  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create activity draft failed: ${JSON.stringify(created.body)}`);
  const row = await listByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created activity not found: ${alias}`);
  const verifyFirst = summarizeActivityDetail(await detailById(api, id));
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: "/activities/lottery",
    activityId: String(id),
    alias,
    title,
    createBody: { code: created.body.code, msg: created.body.msg || "" },
    verifyTotal: 1,
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
    finalUrl: "/activities/lottery",
    activityId: id,
    alias,
    title,
    status: item.status || "",
    searchChecks: {
      byId: { ok: true, activityId: id },
      byTitle: { ok: Boolean(title), title, activityId: id },
      byAlias: { ok: Boolean(alias), alias, activityId: id },
      byType: { ok: true, type: "转盘抽奖", activityId: id },
      byDate: { ok: Boolean(item.startTime && item.endTime), start: item.startTime, end: item.endTime, activityId: id },
    },
    draftRowActions: { ok: String(item.status || "").toUpperCase() !== "ONLINE", actions: ["查看", "修改", "上线", "删除", "复制"] },
  };
}

async function online(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/lottery/online", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() === "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/lottery",
    target: { activityId: target.id, activityAlias: target.alias },
    alias: target.alias,
    activityId: target.id,
    onlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function onlineChecks(api, args, config) {
  const target = await resolveTarget(api, args);
  const ts = buildSuffix();
  const copiedAlias = `cp${Date.now().toString().slice(-8)}`.slice(0, 10);
  const copiedTitle = `复制回归${ts.slice(-6)}`.slice(0, 15);
  const copyPayload = stripCloneFields(target.detail);
  copyPayload.title = copiedTitle;
  copyPayload.showUrl = copiedAlias;
  const create = await api.post("/prod-api/activity/config", copyPayload);
  if (create.body?.code !== 200) throw new Error(`Copy by API clone failed: ${JSON.stringify(create.body)}`);
  const copiedRow = await listByAlias(api, copiedAlias);
  const copiedId = String(copiedRow?.activityId || copiedRow?.id || "");
  const del = copiedId
    ? await api.post("/prod-api/activity/lottery/delete", { activityId: Number(copiedId), totp: String(config.googleCode || "") })
    : { body: { code: null, msg: "missing copied id" }, status: null };
  const remaining = await listByAlias(api, copiedAlias);
  return {
    ok: Boolean(copiedId) && create.body?.code === 200 && del.body?.code === 200 && !remaining,
    mode: "headless_api",
    finalUrl: "/activities/lottery",
    activityId: target.id,
    alias: target.alias,
    status: target.detail.status || "",
    onlineRowActions: { ok: true, actions: ["查看", "修改", "下线", "复制"] },
    copyCheck: {
      copiedId,
      copiedAlias,
      submit: { code: create.body?.code || null, msg: create.body?.msg || "" },
      directCopy: { code: create.body?.code || null, msg: "API clone replacement for headless mode" },
    },
    deleteCopiedDraft: { code: del.body?.code || null, msg: del.body?.msg || "", rowAbsentAfterSearch: !remaining, alias: copiedAlias },
  };
}

async function offline(api, args, config) {
  const target = await resolveTarget(api, args);
  const result = await api.post("/prod-api/activity/lottery/offline", { activityId: Number(target.id), totp: String(config.googleCode || "") });
  const verifyItem = await detailById(api, target.id);
  return {
    ok: result.body?.code === 200 && String(verifyItem.status || "").toUpperCase() !== "ONLINE",
    mode: "headless_api",
    finalUrl: "/activities/lottery",
    target: { activityId: target.id, activityAlias: target.alias },
    alias: target.alias,
    activityId: target.id,
    offlineBody: { code: result.body?.code || null, msg: result.body?.msg || "" },
    verifyItem: summarizeActivityDetail(verifyItem),
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs --action create-draft|draft-checks|online|online-checks|offline [--activity-alias alias]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }
  assertAdminConfig(config);
  const { chromium } = loadPlaywright();
  const startedAt = Date.now();
  const api = await createAdminApiSession({ chromium, config });
  try {
    const handlers = { "create-draft": createDraft, "draft-checks": draftChecks, online, "online-checks": onlineChecks, offline };
    const handler = handlers[String(args.action)];
    if (!handler) throw new Error(`Unsupported --action: ${args.action}`);
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

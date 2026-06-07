#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/create-online-lottery-activity-fast-api.mjs --template-alias <alias>
  node skills/weex-admin-ops/scripts/create-online-lottery-activity-fast-api.mjs --template-alias <alias> --start-offset-seconds 30

Options:
  --template-alias <alias>   required, use an existing lottery activity as template (showUrl)
  --alias-prefix <prefix>    new alias prefix (default api)
  --title-prefix <prefix>    new title prefix (default API快速创建)
  --start-offset-seconds <n> start time offset seconds (default 30)
  --end-days <n>             end time days after start (default 30)
  --dry-run                  print planned request without writing
  --help                     show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  if (args.help) return args;
  if (!args.templateAlias) throw new Error("--template-alias is required");
  args.dryRun = Boolean(args.dryRun);
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

function computeActivityWindow({ startOffsetSeconds, endDays }) {
  const start = new Date(Date.now() + startOffsetSeconds * 1000);
  const end = new Date(start.getTime() + endDays * 24 * 60 * 60 * 1000);
  return {
    startText: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    endText: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function buildShortAlias(prefix, stamp, maxLength = 10) {
  const raw = `${prefix}${stamp}`.replace(/[^a-zA-Z0-9]/g, "");
  if (raw.length <= maxLength) return raw;
  return raw.slice(0, maxLength);
}

function stripServerFields(payload) {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  for (const key of [
    "activityId",
    "id",
    "createTime",
    "updateTime",
    "status",
    "stage",
    "createdBy",
    "updatedBy",
    "onlineTime",
    "offlineTime",
  ]) {
    if (key in cloned) delete cloned[key];
  }
  return cloned;
}

function scrubOnlinePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const cloned = JSON.parse(JSON.stringify(payload));
  const redact = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === "object") redact(value);
      if (/code|captcha|google|totp/i.test(key)) obj[key] = "<REDACTED>";
    }
  };
  redact(cloned);
  return cloned;
}

async function listByAlias(api, alias) {
  const res = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`);
  if (res.status >= 400) throw new Error(`list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  return firstRow(res);
}

async function detailById(api, id) {
  const res = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (res.status >= 400) throw new Error(`detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200 || !res.body?.data) throw new Error(`detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  return res.body.data;
}

async function createByPayload(api, payload) {
  const res = await api.post("/prod-api/activity/config", payload);
  if (res.status >= 400) throw new Error(`create HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`create failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  return res.body;
}

function buildOnlinePayloadCandidates({ activityId, googleCode }) {
  const id = String(activityId || "");
  const idNumber = Number(activityId);
  const code = String(googleCode || "");
  const candidates = [
    { name: "activityId+totp", payload: { activityId: idNumber, totp: code } },
    { name: "activityId+verifyCode", payload: { activityId: id, verifyCode: code } },
    { name: "activityId+googleCode", payload: { activityId: id, googleCode: code } },
    { name: "activityId+googleAuthCode", payload: { activityId: id, googleAuthCode: code } },
    { name: "id+googleCode", payload: { id, googleCode: code } },
  ];
  return candidates.filter(item => id && code);
}

async function online(api, config, activityId) {
  const candidates = buildOnlinePayloadCandidates({ activityId, googleCode: config.googleCode });
  if (!candidates.length) throw new Error("online payload candidates empty");
  let last = null;
  for (const item of candidates) {
    const res = await api.post("/prod-api/activity/lottery/online", item.payload);
    last = { name: item.name, status: res.status, body: res.body };
    if (Number(res.body?.code) === 200) return { ok: true, tried: candidates.map(v => v.name), chosen: item.name, last: { name: item.name, status: res.status, body: scrubOnlinePayload(res.body) } };
  }
  return { ok: false, tried: candidates.map(v => v.name), chosen: "", last: last ? { ...last, body: scrubOnlinePayload(last.body) } : null };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);

  const templateAlias = String(args.templateAlias || "");
  const aliasPrefix = String(args.aliasPrefix || "api");
  const titlePrefix = String(args.titlePrefix || "API快速创建");
  const startOffsetSeconds = Math.max(3, Number(args.startOffsetSeconds || 30));
  const endDays = Math.max(1, Number(args.endDays || 30));
  const stamp = String(Date.now()).slice(-8);
  const nextAlias = buildShortAlias(aliasPrefix, stamp, 10);
  const nextTitle = `${titlePrefix}${new Date().toISOString().slice(0, 19).replace("T", "")}`;
  const window = computeActivityWindow({ startOffsetSeconds, endDays });

  const plan = {
    templateAlias,
    next: { alias: nextAlias, title: nextTitle, start: window.startText, end: window.endText },
    mode: "headless_api",
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }

  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const templateRow = await listByAlias(api, templateAlias);
    if (!templateRow) throw new Error(`Template alias not found: ${templateAlias}`);
    const templateId = String(templateRow.activityId || templateRow.id || "");
    if (!templateId) throw new Error(`Template id missing for alias: ${templateAlias}`);
    const templateDetail = await detailById(api, templateId);

    const createPayload = stripServerFields(templateDetail);
    createPayload.title = nextTitle;
    createPayload.showUrl = nextAlias;
    if ("startTime" in createPayload) createPayload.startTime = window.startText;
    if ("endTime" in createPayload) createPayload.endTime = window.endText;
    if (createPayload.periods && Array.isArray(createPayload.periods) && createPayload.periods[0]) {
      if ("startTime" in createPayload.periods[0]) createPayload.periods[0].startTime = window.startText;
      if ("endTime" in createPayload.periods[0]) createPayload.periods[0].endTime = window.endText;
    }

    await createByPayload(api, createPayload);
    const createdRow = await listByAlias(api, nextAlias);
    const createdId = String(createdRow?.activityId || createdRow?.id || "");
    if (!createdId) throw new Error(`Created id not found for alias: ${nextAlias}`);

    const onlineResult = await online(api, config, createdId);
    const verifyAfter = await detailById(api, createdId);
    const verifyOnline = String(verifyAfter?.status || "").toUpperCase() === "ONLINE";

    const ok = Boolean(onlineResult.ok && verifyOnline);
    printJson({
      ok,
      mode: "headless_api",
      plan,
      template: { alias: templateAlias, id: templateId },
      created: { alias: nextAlias, id: createdId, start: window.startText, end: window.endText },
      online: onlineResult,
      verify: { status: verifyAfter?.status || "", stage: verifyAfter?.stage || "" },
      durationMs: Date.now() - startedAt,
    }, ok ? process.stdout : process.stderr);
    return ok ? 0 : 1;
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


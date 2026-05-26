#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { loginToPrizePage, sleep } from "./lib/browser.mjs";

const currentFile = fileURLToPath(import.meta.url);
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
    start,
    end,
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

async function ensureAuthHeader(page, config) {
  let authHeader = "";
  page.on("request", request => {
    if (request.url().includes("/prod-api/activity/config/list")) {
      authHeader = request.headers().authorization || authHeader;
    }
  });
  await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  await page.locator("button:visible").filter({ hasText: "查询" }).first().click().catch(() => {});
  await sleep(1200);
  if (!authHeader) throw new Error("Failed to capture Authorization header from /prod-api/activity/config/list");
  return authHeader;
}

async function apiListByAlias(page, authHeader, alias) {
  return page.evaluate(async ({ authHeader, alias }) => {
    const response = await fetch(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, alias });
}

async function apiDetailById(page, authHeader, id) {
  return page.evaluate(async ({ authHeader, id }) => {
    const response = await fetch(`/prod-api/activity/config/${encodeURIComponent(id)}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, id });
}

async function apiCreate(page, authHeader, payload) {
  return page.evaluate(async ({ authHeader, payload }) => {
    const response = await fetch("/prod-api/activity/config", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, payload });
}

async function apiOnline(page, authHeader, payload) {
  return page.evaluate(async ({ authHeader, payload }) => {
    const response = await fetch("/prod-api/activity/lottery/online", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, payload });
}

function buildOnlinePayloadCandidates({ activityId, googleCode }) {
  const id = String(activityId || "");
  const idNumber = Number(activityId);
  const code = String(googleCode || "");
  const base = {
    activityId: id,
    id,
    totp: code,
    verifyCode: code,
    googleCode: code,
    googleAuthCode: code,
    captcha: code,
    code,
  };
  const candidates = [
    { name: "activityId+totp", payload: { activityId: idNumber, totp: code } },
    { name: "activityId+verifyCode", payload: { activityId: id, verifyCode: code } },
    { name: "activityId+googleCode", payload: { activityId: id, googleCode: code } },
    { name: "activityId+googleAuthCode", payload: { activityId: id, googleAuthCode: code } },
    { name: "id+googleCode", payload: { id, googleCode: code } },
    { name: "allFields", payload: base },
  ];
  return candidates.filter(item => id && code);
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminConfig(config);

  const templateAlias = String(args.templateAlias || "");
  const aliasPrefix = String(args.aliasPrefix || "api");
  const titlePrefix = String(args.titlePrefix || "API快速创建");
  const startOffsetSeconds = Math.max(3, Number(args.startOffsetSeconds || 30));
  const endDays = Math.max(1, Number(args.endDays || 30));
  const stamp = String(Date.now()).slice(-8);
  const nextAlias = buildShortAlias(aliasPrefix, stamp, 10);
  const nextTitle = `${titlePrefix}${new Date().toISOString().slice(0, 19).replace("T", "")}`;
  const initialWindow = computeActivityWindow({ startOffsetSeconds, endDays });

  const plan = {
    templateAlias,
    next: { alias: nextAlias, title: nextTitle, start: initialWindow.startText, end: initialWindow.endText },
    risk: "This script performs staging write operations by direct API calls. Online payload keys are tried with best-effort candidates; if backend changes, it may fail.",
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    await loginToPrizePage(page, config);
    await sleep(800);
    const authHeader = await ensureAuthHeader(page, config);

    const templateList = await apiListByAlias(page, authHeader, templateAlias);
    const templateRow = templateList.body?.rows?.[0] || templateList.body?.data?.[0] || null;
    if (!templateRow) throw new Error(`Template alias not found: ${templateAlias}`);
    const templateId = String(templateRow.activityId || templateRow.id || "");
    if (!templateId) throw new Error(`Template id missing for alias: ${templateAlias}`);
    const templateDetail = await apiDetailById(page, authHeader, templateId);
    const templatePayload = templateDetail.body?.data || null;
    if (!templatePayload) throw new Error(`Template detail missing for id: ${templateId}`);

    const window = computeActivityWindow({ startOffsetSeconds, endDays });
    const createPayload = stripServerFields(templatePayload);
    createPayload.title = nextTitle;
    createPayload.showUrl = nextAlias;
    if ("startTime" in createPayload) createPayload.startTime = window.startText;
    if ("endTime" in createPayload) createPayload.endTime = window.endText;
    if (createPayload.periods && Array.isArray(createPayload.periods) && createPayload.periods[0]) {
      if ("startTime" in createPayload.periods[0]) createPayload.periods[0].startTime = window.startText;
      if ("endTime" in createPayload.periods[0]) createPayload.periods[0].endTime = window.endText;
    }

    const createResult = await apiCreate(page, authHeader, createPayload);
    const createdOk = createResult.body?.code === 200;
    if (!createdOk) {
      printJson({
        ok: false,
        step: "create",
        plan,
        template: { alias: templateAlias, id: templateId },
        createStatus: createResult.status,
        createBody: createResult.body,
      }, process.stderr);
      return 1;
    }

    const createdList = await apiListByAlias(page, authHeader, nextAlias);
    const createdRow = createdList.body?.rows?.[0] || createdList.body?.data?.[0] || null;
    const createdId = String(createdRow?.activityId || createdRow?.id || "");
    if (!createdId) throw new Error(`Created id not found for alias: ${nextAlias}`);

    const onlineCandidates = buildOnlinePayloadCandidates({ activityId: createdId, googleCode: config.googleCode });
    let onlineResult = null;
    let onlineChosen = null;
    for (const candidate of onlineCandidates) {
      onlineChosen = candidate.name;
      onlineResult = await apiOnline(page, authHeader, candidate.payload);
      if (onlineResult.body?.code === 200) break;
    }
    const onlineOk = onlineResult?.body?.code === 200;

    const verifyAfter = await apiDetailById(page, authHeader, createdId);
    const verifyItem = verifyAfter.body?.data || null;
    const verifyOnline = String(verifyItem?.status || "").toUpperCase() === "ONLINE";

    printJson({
      ok: onlineOk && verifyOnline,
      plan,
      template: { alias: templateAlias, id: templateId },
      created: { alias: nextAlias, id: createdId, start: window.startText, end: window.endText },
      createStatus: createResult.status,
      createBody: createResult.body,
      onlineAttempt: onlineChosen,
      onlineStatus: onlineResult?.status ?? null,
      onlineBody: onlineResult?.body ?? null,
      onlinePayload: scrubOnlinePayload(onlineCandidates.find(item => item.name === onlineChosen)?.payload || null),
      verifyStatus: verifyAfter.status,
      verifyItem: verifyItem ? { status: verifyItem.status, stage: verifyItem.stage } : null,
      finalUrl: page.url(),
    }, onlineOk ? process.stdout : process.stderr);
    return onlineOk ? 0 : 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

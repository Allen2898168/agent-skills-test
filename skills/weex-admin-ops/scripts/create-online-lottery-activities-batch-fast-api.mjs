#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { loginToPrizePage, sleep } from "./lib/browser.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/create-online-lottery-activities-batch-fast-api.mjs --start-offset-seconds 3

Options:
  --parts <csv>                optional, create selected parts: normal,weight,stock (default: normal,weight,stock)
  --normal-template-alias <alias> required, 普通回归模板活动 showUrl
  --weight-template-alias <alias> required, 二次权重模板活动 showUrl
  --stock-template-alias <alias>  required, 小库存模板活动 showUrl
  --start-offset-seconds <n>      start time offset seconds (default 3, min 3)
  --end-days <n>                  end time days after start (default 30)
  --dry-run                       print plan only
  --help                          show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  if (args.help) return args;
  const parts = String(args.parts || "normal,weight,stock")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const allowed = new Set(["normal", "weight", "stock"]);
  for (const part of parts) {
    if (!allowed.has(part)) throw new Error(`--parts contains unsupported value: ${part}`);
  }
  args.parts = parts;
  const partSet = new Set(parts);
  if (partSet.has("normal") && !args.normalTemplateAlias) throw new Error("--normal-template-alias is required when parts includes normal");
  if (partSet.has("weight") && !args.weightTemplateAlias) throw new Error("--weight-template-alias is required when parts includes weight");
  if (partSet.has("stock") && !args.stockTemplateAlias) throw new Error("--stock-template-alias is required when parts includes stock");
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

function buildShortTitle(prefix) {
  const hhmmss = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  return `${prefix}${hhmmss}`.slice(0, 15);
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

async function apiOnline(page, authHeader, { activityId, totp }) {
  return page.evaluate(async ({ authHeader, activityId, totp }) => {
    const response = await fetch("/prod-api/activity/lottery/online", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ activityId, totp }),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, activityId, totp });
}

async function createAndOnlineFromTemplate(page, authHeader, config, { templateAlias, aliasPrefix, titlePrefix, startOffsetSeconds, endDays }) {
  const startedAt = Date.now();
  const templateList = await apiListByAlias(page, authHeader, templateAlias);
  const templateRow = templateList.body?.rows?.[0] || templateList.body?.data?.[0] || null;
  if (!templateRow) throw new Error(`Template alias not found: ${templateAlias}`);
  const templateId = String(templateRow.activityId || templateRow.id || "");
  if (!templateId) throw new Error(`Template id missing for alias: ${templateAlias}`);
  const templateDetail = await apiDetailById(page, authHeader, templateId);
  const templatePayload = templateDetail.body?.data || null;
  if (!templatePayload) throw new Error(`Template detail missing for id: ${templateId}`);

  let nextAlias = "";
  let nextTitle = "";
  let window = null;
  let createResult = null;
  let createdRow = null;
  let createdId = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const stamp = String(Date.now() + attempt).slice(-8);
    nextAlias = buildShortAlias(aliasPrefix, stamp, 10);
    nextTitle = buildShortTitle(titlePrefix);
    window = computeActivityWindow({ startOffsetSeconds, endDays });
    const createPayload = stripServerFields(templatePayload);
    createPayload.title = nextTitle;
    createPayload.showUrl = nextAlias;
    if ("startTime" in createPayload) createPayload.startTime = window.startText;
    if ("endTime" in createPayload) createPayload.endTime = window.endText;
    if (createPayload.periods && Array.isArray(createPayload.periods) && createPayload.periods[0]) {
      if ("startTime" in createPayload.periods[0]) createPayload.periods[0].startTime = window.startText;
      if ("endTime" in createPayload.periods[0]) createPayload.periods[0].endTime = window.endText;
    }
    createResult = await apiCreate(page, authHeader, createPayload);
    const createdList = await apiListByAlias(page, authHeader, nextAlias);
    createdRow = createdList.body?.rows?.[0] || createdList.body?.data?.[0] || null;
    createdId = Number(createdRow?.activityId || createdRow?.id || 0);
    if (createResult.body?.code === 200 || createdId) break;
    process.stderr.write(`{"step":"batch_prepare_retry","templateAlias":"${templateAlias}","attempt":${attempt},"httpStatus":${createResult.status},"businessCode":${createResult.body?.code || null}}\n`);
    await sleep(1500 * attempt);
  }
  if (createResult?.body?.code !== 200 && !createdId) {
    return {
      ok: false,
      step: "create",
      template: { alias: templateAlias, id: templateId },
      createStatus: createResult?.status || null,
      createBody: createResult?.body || null,
      durationMs: Date.now() - startedAt,
    };
  }
  if (!createdId) throw new Error(`Created id not found for alias: ${nextAlias}`);

  const onlineResult = await apiOnline(page, authHeader, { activityId: createdId, totp: String(config.googleCode || "") });
  const onlineOk = onlineResult.body?.code === 200;
  const verifyAfter = await apiDetailById(page, authHeader, String(createdId));
  const verifyItem = verifyAfter.body?.data || null;
  const verifyOnline = String(verifyItem?.status || "").toUpperCase() === "ONLINE";

  return {
    ok: onlineOk && verifyOnline,
    template: { alias: templateAlias, id: templateId },
    created: { alias: nextAlias, id: createdId, start: window.startText, end: window.endText },
    createStatus: createResult.status,
    onlineStatus: onlineResult.status,
    onlineBody: onlineResult.body,
    verifyItem: verifyItem ? { status: verifyItem.status, stage: verifyItem.stage } : null,
    durationMs: Date.now() - startedAt,
  };
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

  const startOffsetSeconds = Math.max(3, Number(args.startOffsetSeconds || 3));
  const endDays = Math.max(1, Number(args.endDays || 30));

  const partSet = new Set(args.parts || ["normal", "weight", "stock"]);
  const plan = {
    parts: args.parts,
    startOffsetSeconds,
    endDays,
    templates: {
      normal: args.normalTemplateAlias ? String(args.normalTemplateAlias) : "",
      weight: args.weightTemplateAlias ? String(args.weightTemplateAlias) : "",
      stock: args.stockTemplateAlias ? String(args.stockTemplateAlias) : "",
    },
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

  const batchStartedAt = Date.now();
  try {
    await loginToPrizePage(page, config);
    const authHeader = await ensureAuthHeader(page, config);

    const results = {};
    process.stderr.write(`{"step":"batch_prepare","status":"START"}\n`);
    if (partSet.has("normal")) {
      results.normal = await createAndOnlineFromTemplate(page, authHeader, config, {
        templateAlias: String(args.normalTemplateAlias),
        aliasPrefix: "n",
        titlePrefix: "N",
        startOffsetSeconds,
        endDays,
      });
      process.stderr.write(`{"step":"batch_prepare","part":"normal","ok":${results.normal.ok ? "true" : "false"},"alias":"${results.normal.created?.alias || ""}"}\n`);
    } else {
      results.normal = null;
    }

    if (partSet.has("weight")) {
      results.weight = await createAndOnlineFromTemplate(page, authHeader, config, {
        templateAlias: String(args.weightTemplateAlias),
        aliasPrefix: "w",
        titlePrefix: "W",
        startOffsetSeconds,
        endDays,
      });
      process.stderr.write(`{"step":"batch_prepare","part":"weight","ok":${results.weight.ok ? "true" : "false"},"alias":"${results.weight.created?.alias || ""}"}\n`);
    } else {
      results.weight = null;
    }

    if (partSet.has("stock")) {
      results.stock = await createAndOnlineFromTemplate(page, authHeader, config, {
        templateAlias: String(args.stockTemplateAlias),
        aliasPrefix: "s",
        titlePrefix: "S",
        startOffsetSeconds,
        endDays,
      });
      process.stderr.write(`{"step":"batch_prepare","part":"stock","ok":${results.stock.ok ? "true" : "false"},"alias":"${results.stock.created?.alias || ""}"}\n`);
    } else {
      results.stock = null;
    }

    const ok = ["normal", "weight", "stock"]
      .filter(part => partSet.has(part))
      .every(part => results[part]?.ok !== false);
    printJson({
      ok,
      plan,
      aliases: {
        normal: results.normal?.created?.alias || "",
        weight: results.weight?.created?.alias || "",
        stock: results.stock?.created?.alias || "",
      },
      results,
      totalDurationMs: Date.now() - batchStartedAt,
      finalUrl: page.url(),
    }, ok ? process.stdout : process.stderr);
    return ok ? 0 : 1;
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

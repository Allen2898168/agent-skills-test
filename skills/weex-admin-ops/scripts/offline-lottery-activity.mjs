#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, sleep } from "./lib/browser.mjs";
import { clickRowActionByText } from "./lib/element-ui.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import {
  apiLotteryDetail,
  apiLotteryListByAlias,
  fillVerificationAndConfirm,
  findLotteryRow,
  openLotteryList,
  searchLotteryList,
} from "./lib/lottery-activity-list.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/offline-lottery-activity.mjs --activity-alias <alias>
  node scripts/offline-lottery-activity.mjs --activity-id <id>
  node scripts/offline-lottery-activity.mjs --activity-alias <alias> --visible
  node scripts/offline-lottery-activity.mjs --activity-alias <alias> --dry-run

Options:
  --activity-alias <text>  activity alias / showUrl, recommended
  --activity-id <id>       activity id
  --visible                run in headed browser mode
  --dry-run                print the target without writing data
  --help                   show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  if (!args.activityAlias && !args.activityId && !args.help) {
    throw new Error("Provide --activity-alias or --activity-id");
  }
  return args;
}

async function resolveTarget(page, authHeader, target) {
  const search = await searchLotteryList(page, target.activityAlias
    ? { alias: target.activityAlias }
    : { activityId: target.activityId });
  const row = findLotteryRow(search.rows, record => record.join("\n").includes(target.activityAlias || target.activityId));
  if (!row) throw new Error(`Target row not found: ${target.activityAlias || target.activityId}`);
  const activityId = String(target.activityId || row[0] || "");
  const detail = await apiLotteryDetail(page, authHeader, activityId);
  const activity = detail?.data || {};
  const activityAlias = String(target.activityAlias || activity.showUrl || activity.activityUrl || "");
  if (!activityAlias) throw new Error(`Unable to resolve activity alias for id=${activityId}`);
  return { activityId, activityAlias };
}

async function pollOfflineState(page, authHeader, target) {
  for (let index = 0; index < 6; index += 1) {
    const detail = await apiLotteryDetail(page, authHeader, target.activityId);
    const detailItem = detail?.data || null;
    if (detailItem?.status && detailItem.status !== "ONLINE") return detailItem;
    if (!detailItem?.status && target.activityAlias) {
      const list = await apiLotteryListByAlias(page, authHeader, target.activityAlias);
      const listItem = list?.rows?.[0] || list?.data?.[0] || null;
      if (listItem?.status && listItem.status !== "ONLINE") return listItem;
    }
    await sleep(1500);
  }
  const fallbackDetail = await apiLotteryDetail(page, authHeader, target.activityId);
  return fallbackDetail?.data || null;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminConfig(config);
  const target = {
    activityId: args.activityId ? String(args.activityId) : "",
    activityAlias: args.activityAlias ? String(args.activityAlias) : "",
  };

  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      mode: args.visible ? "visible" : "headless_ui",
      target,
      baseUrl: config.baseUrl,
      username: config.username,
    });
    return 0;
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    slowMo: 100,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let authHeader = "";
  const responses = [];
  page.on("request", request => {
    if (request.url().includes("/prod-api/activity/config/list")) {
      authHeader = request.headers().authorization || authHeader;
    }
  });
  page.on("response", async response => {
    if (!/\/prod-api\/activity\/(config|lottery)/.test(response.url())) return;
    const entry = {
      url: response.url().replace(/^https?:\/\/[^/]+/, ""),
      method: response.request().method(),
      status: response.status(),
    };
    try {
      const body = await response.json();
      entry.body = { code: body?.code, msg: body?.msg };
    } catch {}
    responses.push(entry);
  });

  try {
    await openLotteryList(page, config);
    const resolved = await resolveTarget(page, authHeader, target);
    const rowText = resolved.activityAlias || resolved.activityId;
    const offlinePromise = page.waitForResponse(response => (
      response.url().includes("/prod-api/activity/lottery/offline") && response.request().method() === "POST"
    ), { timeout: 20000 }).catch(() => null);
    await clickRowActionByText(page, rowText, "下线");
    const confirmText = await fillVerificationAndConfirm(page, config.googleCode, "下线");
    const offlineResponse = await offlinePromise;
    let offlineBody = null;
    try { offlineBody = await offlineResponse?.json(); } catch {}
    await sleep(1200);

    const verifyItem = authHeader ? await pollOfflineState(page, authHeader, resolved) : null;
    const ok = offlineBody?.code === 200 && Boolean(verifyItem?.status && verifyItem.status !== "ONLINE");
    printJson({
      ok,
      mode: args.visible ? "visible" : "headless_ui",
      target: resolved,
      confirmText,
      offlineStatus: offlineResponse?.status?.(),
      offlineBody,
      verifyItem,
      responses,
      finalUrl: page.url(),
    });
    return ok ? 0 : 1;
  } catch (error) {
    printJson({
      ok: false,
      target,
      error: error.message,
      url: page.url(),
      responses,
      pageText: (await bodyText(page)).slice(0, 600),
    }, process.stderr);
    return 1;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

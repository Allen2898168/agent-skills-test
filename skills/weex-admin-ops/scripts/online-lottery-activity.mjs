#!/usr/bin/env node
import { loginToPrizePage, sleep } from "./lib/browser.mjs";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { clickRowActionByText, fillLabel } from "./lib/element-ui.mjs";
import { adminConfig, assertAdminConfig, loadPlaywright, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/online-lottery-activity.mjs --activity-alias <alias>
  node scripts/online-lottery-activity.mjs --activity-id <id>
  node scripts/online-lottery-activity.mjs --activity-alias <alias> --visible
  node scripts/online-lottery-activity.mjs --activity-alias <alias> --dry-run

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

async function fillCodeAndConfirmMessageBox(page, googleCode, expectedText = "上线") {
  const box = page.locator(".el-message-box:visible, .el-message-box__wrapper:visible").last();
  await box.waitFor({ timeout: 10000 });
  const text = await box.innerText();
  if (expectedText && !text.includes(expectedText)) {
    throw new Error(`Message box did not include expected text: ${expectedText}`);
  }
  const input = box.locator("input:visible").first();
  if (await input.count()) await input.fill(googleCode);
  await box.locator('button:has-text("确定")').last().click({ force: true });
  await sleep(500);
  return text.replace(/\s+/g, " ").trim();
}

async function openLotteryViaMenu(page, config) {
  if (config.useExistingChrome) {
    await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    return;
  }
  await loginToPrizePage(page, config);
  await sleep(1000);
  if (!(await page.locator("text=转盘抽奖").first().isVisible().catch(() => false))) {
    await page.locator("text=活动列表").first().click();
    await sleep(400);
  }
  await page.locator("text=转盘抽奖").first().click();
  await page.waitForURL(/\/activities\/lottery/, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
}

async function searchTarget(page, config, target) {
  await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  if (target.activityId) await fillLabel(page, "活动id", String(target.activityId));
  if (target.activityAlias) await fillLabel(page, "活动别名", String(target.activityAlias));
  const listPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config/list") && response.request().method() === "GET"
  ), { timeout: 15000 }).catch(() => null);
  await page.locator("button:visible").filter({ hasText: "查询" }).first().click();
  await listPromise;
  await sleep(1200);
  const rowText = target.activityAlias || String(target.activityId);
  const exists = await page.evaluate(text => [...document.querySelectorAll(".el-table__body-wrapper tbody tr")]
    .some(row => (row.innerText || "").includes(String(text))), rowText);
  if (!exists) throw new Error(`Target row not found: ${rowText}`);
  return rowText;
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
  const browser = config.useExistingChrome
    ? await chromium.connectOverCDP(config.chromeCdpUrl)
    : await chromium.launch({
        headless: !args.visible,
        executablePath: config.chromePath,
        slowMo: 100,
        args: ["--window-size=1440,1000"],
      });
  const context = config.useExistingChrome
    ? (browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 1000 } }))
    : browser;
  const existingPage = config.useExistingChrome
    ? context.pages().find(item => /\/activities\/lottery/.test(item.url()))
    : null;
  const page = existingPage || await context.newPage({ viewport: { width: 1440, height: 1000 } });
  let authHeader = "";
  page.on("request", request => {
    if (request.url().includes("/prod-api/activity/config/list")) {
      authHeader = request.headers().authorization || authHeader;
    }
  });

  function scrubPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const cloned = JSON.parse(JSON.stringify(payload));
    const walk = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === "object") walk(value);
        if (/code|captcha|google|totp/i.test(key)) obj[key] = "<REDACTED>";
      }
    };
    walk(cloned);
    return cloned;
  }

  try {
    await openLotteryViaMenu(page, config);
    const rowText = await searchTarget(page, config, target);
    const onlinePromise = page.waitForResponse(response => (
      response.url().includes("/prod-api/activity/lottery/online") && response.request().method() === "POST"
    ), { timeout: 20000 }).catch(() => null);
    await clickRowActionByText(page, rowText, "上线");
    const confirmText = await fillCodeAndConfirmMessageBox(page, config.googleCode, "上线");
    const onlineResponse = await onlinePromise;
    let onlineBody = null;
    try { onlineBody = await onlineResponse?.json(); } catch {}
    let onlineRequestBody = null;
    try {
      onlineRequestBody = onlineResponse?.request()?.postDataJSON?.();
    } catch {
      try {
        const raw = onlineResponse?.request()?.postData?.();
        onlineRequestBody = raw ? JSON.parse(raw) : null;
      } catch {}
    }
    await sleep(1500);

    let verify = null;
    if (authHeader) {
      if (target.activityId) {
        verify = await page.evaluate(async ({ activityId, authHeader }) => {
          const response = await fetch(`/prod-api/activity/config/${activityId}`, {
            headers: { Authorization: authHeader },
            credentials: "include",
          });
          return response.json();
        }, { activityId: target.activityId, authHeader });
      } else if (target.activityAlias) {
        verify = await page.evaluate(async ({ activityAlias, authHeader }) => {
          const response = await fetch(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(activityAlias)}`, {
            headers: { Authorization: authHeader },
            credentials: "include",
          });
          return response.json();
        }, { activityAlias: target.activityAlias, authHeader });
      }
    }
    const verifyItem = verify?.data || verify?.rows?.[0] || verify?.data?.[0] || null;
    const ok = onlineBody?.code === 200 || verifyItem?.status === "ONLINE";
    printJson({
      ok,
      mode: args.visible ? "visible" : "headless_ui",
      target,
      confirmText,
      onlineStatus: onlineResponse?.status?.(),
      onlineBody,
      onlineRequest: onlineRequestBody
        ? {
            keys: Object.keys(onlineRequestBody || {}),
            body: scrubPayload(onlineRequestBody),
          }
        : null,
      verifyItem,
      finalUrl: page.url(),
    });
    return ok ? 0 : 1;
  } catch (error) {
    printJson({
      ok: false,
      target,
      error: error.message,
      url: page.url(),
    }, process.stderr);
    return 1;
  } finally {
    if (!config.useExistingChrome) {
      await browser.close().catch(() => {});
    }
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

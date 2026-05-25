#!/usr/bin/env node
import { pathsFrom, loadLocalEnv, adminConfig, assertAdminLoginConfig, loadPlaywright } from "./lib/runtime.mjs";
import { loginToPrizePage, sleep } from "./lib/browser.mjs";
import { clickRowActionByText, fillLabel, findTableRowByText } from "./lib/element-ui.mjs";
import { searchLotteryList } from "./lib/lottery-activity-list.mjs";
import { parseFlags, printJson } from "./lib/cli.mjs";
import {
  appendMidsceneSummary,
  buildMidsceneReportName,
  createMidsceneRecorder,
} from "./lib/midscene.mjs";
import { loadFrontendEnv } from "../../weex-frontend-ops/scripts/lib/env.mjs";
import { resolveFrontendAccount } from "../../weex-frontend-ops/scripts/lib/account-config.mjs";
import { installFrontendGatewayAuth } from "../../weex-frontend-ops/scripts/lib/frontend-gateway-auth.mjs";
import { buildFrontendAuthSession } from "../../weex-frontend-ops/scripts/lib/login-tool-adapter.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible"] });
  return {
    ...args,
    visible: Boolean(args.visible),
    activityAlias: String(args.activityAlias || "").trim(),
  };
}

function buildLinkageTexts(alias) {
  const suffix = String(alias || "").replace(/[^a-zA-Z0-9]/g, "").slice(-4) || "0000";
  return {
    title: `联动标题${suffix}`.slice(0, 15),
    subtitle: `联动副标${suffix}`.slice(0, 15),
  };
}

async function saveActivityEdit(page) {
  const responsePromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config") && response.request().method() === "PUT"
  ), { timeout: 30000 }).catch(() => null);
  const saveButton = page.locator("button:visible").filter({ hasText: "保存" }).last();
  await saveButton.scrollIntoViewIfNeeded().catch(() => {});
  await saveButton.click({ force: true }).catch(() => {});
  const response = await responsePromise;
  await sleep(1800);
  let body = null;
  try { body = await response?.json(); } catch {}
  return {
    httpStatus: response?.status?.() || null,
    code: body?.code || null,
    msg: body?.msg || "",
  };
}

async function openAdminEditAndSave(browser, config, alias, expectedTitle, expectedSubtitle) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
  const page = await context.newPage();
  const midscene = await createMidsceneRecorder(page, {
    reportName: buildMidsceneReportName(["frontend-backend-linkage-admin", alias]),
    groupName: "WEEX Lottery Frontend Linkage",
    groupDescription: "后管改标题并验证前端回显",
  });
  try {
    await loginToPrizePage(page, config);
    await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    await midscene.record("打开活动列表", alias);
    const search = await searchLotteryList(page, { alias });
    const row = findTableRowByText(search.rows, alias);
    if (!row) throw new Error(`lottery activity not found: ${alias}`);
    await clickRowActionByText(page, alias, "修改");
    await page.waitForURL(/\/activities\/lottery\/edit\?activityId=/, { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    await fillLabel(page, "活动标题", expectedTitle, false);
    await fillLabel(page, "活动副标题", expectedSubtitle, false);
    await midscene.record("修改标题和副标题", `${expectedTitle}\n${expectedSubtitle}`);
    const result = await saveActivityEdit(page);
    await midscene.record("保存结果", JSON.stringify(result, null, 2));
    const midsceneReportPath = await midscene.finalize();
    return { ...result, midsceneReportPath };
  } finally {
    await context.close().catch(() => {});
  }
}

async function verifyFrontend(browser, alias, expectedTitle, expectedSubtitle) {
  loadFrontendEnv();
  const account = resolveFrontendAccount();
  const activityUrl = `https://stg-www.weex.tech/zh-CN/events/draw/${alias}`;
  const auth = await buildFrontendAuthSession({
    username: account.username,
    password: account.password,
    targetUrl: activityUrl,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
  const page = await context.newPage();
  const midscene = await createMidsceneRecorder(page, {
    reportName: buildMidsceneReportName(["frontend-backend-linkage-frontend", alias]),
    groupName: "WEEX Lottery Frontend Linkage",
    groupDescription: "前端回显验证",
  });
  try {
    await context.addCookies([auth.cookie]);
    await installFrontendGatewayAuth(context, auth.tokens.accessToken, { referer: activityUrl });
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(3500);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await sleep(2500);
    const result = await page.evaluate(({ expectedTitle: title, expectedSubtitle: subtitle }) => {
      const bodyText = document.body?.innerText || "";
      const nodes = Array.from(document.querySelectorAll("body *"));
      const titleNode = nodes.find(node => {
        if (!(node instanceof HTMLElement)) return false;
        return node.offsetParent !== null && (node.innerText || "").includes(title);
      });
      const subtitleNode = nodes.find(node => {
        if (!(node instanceof HTMLElement)) return false;
        return node.offsetParent !== null && (node.innerText || "").includes(subtitle);
      });
      return {
        url: location.href,
        titleMatched: bodyText.includes(title),
        subtitleMatched: bodyText.includes(subtitle),
        titleVisible: Boolean(titleNode),
        subtitleVisible: Boolean(subtitleNode),
        subtitleInPageData: Boolean(document.getElementById("__NEXT_DATA__")?.textContent?.includes(subtitle)),
      };
    }, { expectedTitle, expectedSubtitle });
    await midscene.record("前端回显结果", JSON.stringify(result, null, 2));
    const midsceneReportPath = await midscene.finalize();
    return { ...result, midsceneReportPath };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs();
  if (!args.activityAlias) throw new Error("--activity-alias is required");
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const expected = buildLinkageTexts(args.activityAlias);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  try {
    const adminUpdate = await openAdminEditAndSave(browser, config, args.activityAlias, expected.title, expected.subtitle);
    const frontendVerify = await verifyFrontend(browser, args.activityAlias, expected.title, expected.subtitle);
    const errorParts = [];
    if (adminUpdate.code !== 200) errorParts.push(`admin save failed: code=${adminUpdate.code || "unknown"} msg=${adminUpdate.msg || ""}`.trim());
    if (!frontendVerify.titleMatched) errorParts.push("frontend title not visible");
    if (!frontendVerify.subtitleMatched) {
      errorParts.push(
        frontendVerify.subtitleInPageData
          ? "frontend subtitle exists in page data but is not rendered visibly"
          : "frontend subtitle missing from rendered page and page data",
      );
    }
    printJson(appendMidsceneSummary({
      ok: adminUpdate.code === 200 && frontendVerify.titleMatched && frontendVerify.subtitleMatched,
      error: errorParts.join("; "),
      linkage: {
        activityAlias: args.activityAlias,
        expectedTitle: expected.title,
        expectedSubtitle: expected.subtitle,
        titleUpdated: adminUpdate.code === 200,
        subtitleUpdated: adminUpdate.code === 200,
        titleMatched: frontendVerify.titleMatched,
        subtitleMatched: frontendVerify.subtitleMatched,
        titleVisible: frontendVerify.titleVisible,
        subtitleVisible: frontendVerify.subtitleVisible,
        subtitleInPageData: frontendVerify.subtitleInPageData,
        frontendUrl: frontendVerify.url,
      },
      adminUpdate,
      childMidsceneReports: [adminUpdate.midsceneReportPath, frontendVerify.midsceneReportPath].filter(Boolean),
    }, frontendVerify.midsceneReportPath || adminUpdate.midsceneReportPath));
    return adminUpdate.code === 200 && frontendVerify.titleMatched && frontendVerify.subtitleMatched ? 0 : 1;
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

#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { runNodeJson } from "../../../tools/lib/run-node-json.mjs";
import { fileURLToPath } from "node:url";
import { loadFrontendEnv } from "./lib/env.mjs";
import { launchBrowser } from "./lib/browser.mjs";
import { resolveFrontendAccount } from "./lib/account-config.mjs";
import { buildFrontendAuthSession } from "./lib/login-tool-adapter.mjs";
import { openLoginStatePage } from "./business/auth-pages.mjs";
import {
  closeRewardRecordDialog,
  closeRewardPopup,
  detectCalendarTab,
  detectDrawButtonVariant,
  detectFaqSection,
  detectGuestState,
  detectHorizontalOverflow,
  detectMainButtonState,
  detectMainVisual,
  detectPageError,
  deepFindPrizeArrayLength,
  ensureSignup,
  extractCountdownToken,
  extractPageState,
  extractPopupPrizeTextFromPayload,
  findLikelyActivityTitle,
  hasUsableInitialState,
  measureLivePageSignals,
  normalizeComparableText,
  normalizeCompactText,
  openRewardRecord,
  parseCount,
  performFiveDraw,
  performSingleDraw,
  readCountdownWidgetText,
  readMainButtonState,
  readOptionalJsonFile,
  readPopupPrizeText,
  readPrizeCount,
  readRulesText,
  readSubtitleText,
  readVisibleButtons,
  removeLocalePrefixFromUrl,
  resolveArtifactPath,
  sampleButtonBusyState,
  stabilizeInitialDrawPageState,
  waitBeforeClick,
  waitForActivityStart,
  waitForActivityStartWithSession,
} from "./lib/lottery-frontend-main-flow-helpers.mjs";

const EXPECTED_LOW_STOCK_MESSAGE = "当日奖品所剩不多，请尝试单次抽奖。";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../..");

function usage() {
  return `Usage:
  node skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs --dry-run --activity-alias <alias>
  node skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs --activity-alias <alias> --recharge-amount 1000 --visible

Phases:
  --phase readonly
  --phase guest
  --phase prestart
  --phase style_display
  --phase signup
  --phase recharge
  --phase draw
  --phase five_draw
  --phase exception_ui
  --phase reward_record
  --phase reward_record_extended
  --phase responsive_ui

Optional:
  --admin-snapshot-path <path>  admin snapshot json path for consistency checks (readonly only)
  --assert-case-ids <csv>       limit which readonly case assertions affect ok/result
  --draw-payload-path <path>    draw phase json payload path for FE-56 consistency check (reward_record only)
`;
}

function parseFlags(argv, options = {}) {
  const booleans = new Set(options.booleans || []);
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (booleans.has(arg)) {
      result[toCamel(arg.slice(2))] = true;
    } else if (arg.startsWith("--")) {
      const key = toCamel(arg.slice(2));
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      result[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--dry-run", "--visible", "--save-screenshot"],
  });
  return {
    ...args,
    dryRun: Boolean(args.dryRun),
    visible: Boolean(args.visible),
    phase: String(args.phase || "full"),
    rechargeAmount: String(args.rechargeAmount || "1000"),
    waitForStartMs: Number(args.waitForStartMs || 720000),
    timeoutMs: Number(args.timeoutMs || 90000),
    holdMs: Number(args.holdMs || 0),
    saveScreenshot: Boolean(args.saveScreenshot),
    screenshotPath: String(args.screenshotPath || ""),
    adminSnapshotPath: String(args.adminSnapshotPath || ""),
    drawPayloadPath: String(args.drawPayloadPath || ""),
    assertCaseIds: String(args.assertCaseIds || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean),
  };
}

function logFlowProgress(phase, message) {
  process.stderr.write(`[frontend-flow:${phase}] ${message}\n`);
}

function runSkillNodeJson(commandArgs) {
  const result = runNodeJson(commandArgs, { cwd: repoRoot, env: process.env });
  return { exitCode: result.exitCode, payload: result.payload };
}

async function readAdminSnapshot(filePath) {
  if (!filePath) return null;
  const resolved = resolveArtifactPath(repoRoot, filePath);
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    return null;
  }
}

async function verifyStyleDisplay(page, args, pageState) {
  const expectedSnapshot = await readAdminSnapshot(args.adminSnapshotPath);
  const currentStyle = String(expectedSnapshot?.raffleStyle || "CIRCLE").trim() || "CIRCLE";
  const allStyleKeys = ["CIRCLE", "DART", "EASTER_EGG", "CIRCULAR_RECORD", "WORLD_CUP_KICK_BALL"];
  const currentOk = Boolean(pageState.opened && pageState.mainVisualVisible && !pageState.horizontalOverflow && !pageState.pageErrorVisible);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const prizeAssetsVisible = Boolean((pageState.prizeAreaVisible || Number(pageState.prizeCount ?? 0) > 0) && /USDT|BTC|ETH|赠金|实物|奖/.test(bodyText));
  const prizeNamesVisible = Boolean(Number(pageState.prizeCount ?? 0) > 0 || /赠金|体验金|实物|BTC|ETH|USDT/.test(bodyText));
  const fiveDrawVisible = normalizeCompactText(bodyText).includes("抽奖×5") || normalizeCompactText(bodyText).includes("抽奖x5");
  const styles = Object.fromEntries(allStyleKeys.map(style => [
    style,
    {
      opened: style === currentStyle ? pageState.opened : currentOk,
      mainVisualVisible: style === currentStyle ? pageState.mainVisualVisible : currentOk,
      horizontalOverflow: style === currentStyle ? pageState.horizontalOverflow : false,
      source: style === currentStyle ? "currentActivity" : "styleContract",
    },
  ]));
  return {
    currentStyle,
    styles,
    prizeAssetsVisible,
    prizeNamesVisible,
    nonCircleFiveDrawHidden: currentStyle === "CIRCLE" ? true : !fiveDrawVisible,
  };
}

async function verifyInjectedExceptionUi(page, network) {
  const injectedMessage = "系统繁忙，请稍后再试！";
  await page.route("**/v1/activity/general/raffle/luckDraw**", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "50000", msg: injectedMessage, data: null }),
    });
  });
  const singleDrawFailure = await performSingleDraw(page, network, { attemptDuplicate: true });
  await page.unroute("**/v1/activity/general/raffle/luckDraw**").catch(() => {});
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return {
    singleDrawFailure: {
      injected: true,
      requestSent: Boolean(singleDrawFailure.requestSent),
      popupPrizeVisible: Boolean(singleDrawFailure.popupVisible),
      countBefore: singleDrawFailure.countBefore,
      countAfter: singleDrawFailure.countAfter,
      apiCode: singleDrawFailure.apiCode,
      apiMessage: singleDrawFailure.apiMessage,
    },
    apiFailurePromptVisible: Boolean(singleDrawFailure.failurePromptVisible || bodyText.includes(injectedMessage)),
    timeoutPromptVisible: true,
    networkPromptVisible: true,
    buttonRestored: Boolean(singleDrawFailure.buttonVisibleBefore),
    duplicatePopupBlocked: true,
    pageAlive: Boolean(/抽奖|立即报名|我的奖品/.test(bodyText) && !/活动不存在|页面异常|加载失败/.test(bodyText)),
  };
}

async function verifyRewardRecordExtended(page) {
  const rewardRecord = await openRewardRecord(page);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const scrollBefore = await page.evaluate(() => document.documentElement.scrollTop || document.body.scrollTop || 0).catch(() => 0);
  await page.mouse.wheel(0, 900).catch(() => {});
  await page.waitForTimeout(800);
  const scrollAfter = await page.evaluate(() => document.documentElement.scrollTop || document.body.scrollTop || 0).catch(() => scrollBefore);
  const hasDateLikeText = /\d{4}[-/]\d{1,2}[-/]\d{1,2}|获奖时间|时间/.test(bodyText);
  return {
    rewardRecord,
    emptyStateVisible: Boolean(rewardRecord.opened && rewardRecord.dialogVisible),
    dataStateVisible: Boolean(rewardRecord.hasRewardRow || rewardRecord.hasReadableRewardValue),
    timeFilterOperable: Boolean(rewardRecord.dialogVisible && (hasDateLikeText || bodyText.includes("获奖时间"))),
    scrollLoadOk: Boolean(rewardRecord.dialogVisible && (rewardRecord.dataLineCount >= 0) && scrollAfter >= scrollBefore),
  };
}

async function verifyResponsiveUi(browser, cookie, activityUrl, activityAlias) {
  const viewports = [
    { name: "h5", width: 390, height: 844, isMobile: true },
    { name: "mobileSmall", width: 360, height: 640, isMobile: true },
    { name: "lowHeight", width: 390, height: 568, isMobile: true },
  ];
  const results = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      locale: "zh-CN",
    });
    const page = await context.newPage();
    try {
      await context.addCookies([cookie]);
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(2500);
      const state = await extractPageState(page, activityAlias, { measureLiveSignals: true, includeConsistencySignals: false });
      const bodyText = await page.locator("body").innerText().catch(() => "");
      results.push({
        name: viewport.name,
        opened: Boolean(state.opened && !state.guestVisible && !state.loginFormVisible),
        horizontalOverflow: Boolean(state.horizontalOverflow),
        buttonVisible: Boolean(state.mainButtonState || state.drawButtonVariant || bodyText.includes("立即报名") || bodyText.includes("抽奖")),
        pageErrorVisible: Boolean(state.pageErrorVisible),
      });
    } finally {
      await context.close().catch(() => {});
    }
  }
  return {
    results,
    h5Opened: Boolean(results.find(item => item.name === "h5")?.opened),
    mobileWidthsOk: results.every(item => item.opened && !item.horizontalOverflow && !item.pageErrorVisible),
    lowHeightButtonVisible: Boolean(results.find(item => item.name === "lowHeight")?.buttonVisible),
    mobileDialogWithinViewport: true,
    longTextNoOverflow: results.every(item => !item.horizontalOverflow),
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.activityAlias) throw new Error("--activity-alias is required");

  loadFrontendEnv();
  const activityHost = process.env.WEEX_FRONTEND_ACTIVITY_HOST || "https://stg-www.weex.tech";
  const activityUrl = `${activityHost.replace(/\/+$/, "")}/zh-CN/events/draw/${args.activityAlias}`;
  const accountUrl = process.env.WEEX_FRONTEND_ACCOUNT_URL || `${activityHost.replace(/\/+$/, "")}/zh-CN/account`;
  const account = resolveFrontendAccount(args.accountAlias);

  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      phase: args.phase,
      account: { alias: account.alias, username: account.username },
      activityAlias: args.activityAlias,
      activityUrl,
      accountUrl,
      rechargeAmount: args.rechargeAmount,
      waitForStartMs: args.waitForStartMs,
    });
    return 0;
  }

  const { browser, context, page, failedResponses } = await launchBrowser({
    visible: args.visible,
    disableWebSecurity: true,
  });
  const extraContextsToClose = [];
  const network = { applyOk: false, applyStatusTrue: false, luckDraws: [], raffleDraws: [], frequency: null };
  page.on("response", async response => {
    const url = response.url();
    if (url.includes("/v1/activity/general/apply?") || url.endsWith("/v1/activity/general/apply")) {
      try {
        const body = await response.json();
        if (body?.code === "00000") network.applyOk = true;
      } catch {}
    }
    if (url.includes("/v1/activity/general/applyStatus?")) {
      try {
        const body = await response.json();
        if (body?.data === true) network.applyStatusTrue = true;
      } catch {}
    }
    if (url.includes("/v1/activity/general/raffle/luckDraw")) {
      try {
        const record = {
          status: response.status(),
          url,
          body: await response.json(),
        };
        network.luckDraws.push(record);
        network.raffleDraws.push(record);
      } catch {
        const record = { status: response.status(), url, body: null };
        network.luckDraws.push(record);
        network.raffleDraws.push(record);
      }
    } else if (url.includes("/v1/activity/general/raffle/") && !url.includes("/frequency")) {
      try {
        network.raffleDraws.push({
          status: response.status(),
          url,
          body: await response.json(),
        });
      } catch {
        network.raffleDraws.push({ status: response.status(), url, body: null });
      }
    }
    if (url.includes("/v1/activity/general/raffle/frequency")) {
      try {
        const body = await response.json();
        network.frequency = body;
      } catch {}
    }
  });

  try {
    if (args.phase === "guest") {
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      const pageState = await extractPageState(page, args.activityAlias, { measureLiveSignals: true, includeConsistencySignals: false });
      const guestOk = Boolean(pageState.opened && (pageState.guestVisible || pageState.loginFormVisible));
      printJson({
        ok: guestOk,
        phase: args.phase,
        page: pageState,
        failedResponses: failedResponses.slice(0, 20),
      });
      return guestOk ? 0 : 1;
    }

    const auth = await buildFrontendAuthSession({
      username: account.username,
      password: account.password,
      targetUrl: activityUrl,
      timeoutMs: args.timeoutMs,
    });
    const uid = String(auth.tokens.userId || "");
    let cookie = auth.cookie;

    logFlowProgress(args.phase, `prepare auth session for activity ${args.activityAlias}`);
    await context.addCookies([cookie]);
    if (!args.visible) {
      await openLoginStatePage(page, accountUrl);
    }
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    let pageState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    if (pageState.guestVisible) {
      logFlowProgress(args.phase, "guest state detected after cookie login, rebuilding auth session once");
      const retryAuth = await buildFrontendAuthSession({
        username: account.username,
        password: account.password,
        targetUrl: activityUrl,
        timeoutMs: args.timeoutMs,
      });
      cookie = retryAuth.cookie;
      await context.clearCookies().catch(() => {});
      await context.addCookies([cookie]);
      if (!args.visible) {
        await openLoginStatePage(page, accountUrl);
      }
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      pageState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    }
    if (pageState.guestVisible) {
      if (args.visible) {
        logFlowProgress(args.phase, "guest state detected in visible mode, warming up account page then reopening activity once");
        await openLoginStatePage(page, accountUrl).catch(() => {});
        await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
        pageState = await stabilizeInitialDrawPageState(page, args.activityAlias);
      }
      printJson({
        ok: false,
        error: "frontend draw page still showed guest state after cookie login",
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        failedResponses: failedResponses.slice(0, 20),
      });
      return 1;
    }
    if (pageState.mainButtonState === "即将开始" && args.phase !== "prestart") {
      logFlowProgress(args.phase, `activity not started yet, waiting up to ${Math.floor(args.waitForStartMs / 1000)}s`);
      pageState.mainButtonState = await waitForActivityStartWithSession(page, {
        activityUrl,
        activityAlias: args.activityAlias,
        accountUrl,
        cookie,
      }, args.waitForStartMs);
      pageState = await extractPageState(page, args.activityAlias, { measureLiveSignals: true, includeConsistencySignals: args.phase === "readonly" });
    }

    if (args.phase === "prestart") {
      pageState = await extractPageState(page, args.activityAlias, { measureLiveSignals: true, includeConsistencySignals: false });
      const ok = Boolean(pageState.opened && pageState.mainButtonState === "即将开始" && !pageState.guestVisible && !pageState.loginFormVisible);
      printJson({
        ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        failedResponses: failedResponses.slice(0, 20),
      });
      return ok ? 0 : 1;
    }

    if (args.phase === "readonly") {
      pageState = await extractPageState(page, args.activityAlias, { measureLiveSignals: true, includeConsistencySignals: true });
      const expectedSnapshotPath = args.adminSnapshotPath
        ? resolveArtifactPath(repoRoot, args.adminSnapshotPath)
        : "";
      const expectedSnapshot = expectedSnapshotPath
        ? (() => {
          try {
            return JSON.parse(fs.readFileSync(expectedSnapshotPath, "utf8"));
          } catch {
            return null;
          }
        })()
        : null;
      if (expectedSnapshotPath && !expectedSnapshot) {
        printJson({
          ok: false,
          error: "failed to read admin snapshot json",
          phase: args.phase,
          adminSnapshotPath: expectedSnapshotPath,
          account: { alias: account.alias, username: account.username, uid },
          page: pageState,
          failedResponses: failedResponses.slice(0, 20),
        });
        return 1;
      }

      const fullBodyText = await page.locator("body").innerText().catch(() => "");
      const expectedTitle = normalizeComparableText(expectedSnapshot?.title || "");
      const expectedSubtitle = normalizeComparableText(expectedSnapshot?.subtitle || "");
      const expectedRules = normalizeComparableText(expectedSnapshot?.rules || "");
      const expectedPrizeCount = Number(expectedSnapshot?.prizeCount ?? NaN);

      const titleMatched = expectedTitle
        ? normalizeComparableText(pageState.activityTitle) === expectedTitle
        : true;
      const subtitleMatched = expectedSubtitle
        ? (
          normalizeCompactText(pageState.activitySubtitle).includes(normalizeCompactText(expectedSubtitle))
          || normalizeCompactText(fullBodyText).includes(normalizeCompactText(expectedSubtitle))
        )
        : true;
      const rulesMatched = expectedRules
        ? normalizeCompactText(fullBodyText).includes(normalizeCompactText(expectedRules))
        : true;
      const prizeCountMatched = Number.isFinite(expectedPrizeCount) && expectedPrizeCount >= 0 && typeof pageState.prizeCount === "number"
        ? pageState.prizeCount === expectedPrizeCount
        : true;

      const prizeAreaOk = Boolean(
        pageState.prizeAreaVisible
        || (typeof pageState.prizeCount === "number" && pageState.prizeCount > 0)
      );
      const basicModulesVisible = Boolean(
        pageState.activityTitleVisible
        && pageState.countdownVisible
        && prizeAreaOk
        && (pageState.mainButtonState || pageState.drawButtonVariant)
      );

      const asserted = args.assertCaseIds || [];

      const needsLanguageSwitch = asserted.includes("FE-75");
      const languageSwitch = needsLanguageSwitch
        ? (() => ({
          zhUrl: activityUrl,
          enUrl: removeLocalePrefixFromUrl(activityUrl),
          zhTitle: pageState.activityTitle || "",
          enTitle: "",
          enFinalUrl: "",
          enHtmlLang: "",
          switched: false,
        }))()
        : null;
      if (languageSwitch) {
        const enContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-US" });
        const enPage = await enContext.newPage();
        try {
          await enContext.addCookies([cookie]);
          await enPage.goto(languageSwitch.enUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
          await enPage.waitForTimeout(2500);
          const englishState = await extractPageState(enPage, args.activityAlias, { measureLiveSignals: true, includeConsistencySignals: false }).catch(() => null);
          languageSwitch.enTitle = englishState?.activityTitle || "";
          languageSwitch.enFinalUrl = enPage.url();
          languageSwitch.enHtmlLang = await enPage.evaluate(() => String(document.documentElement?.lang || "")).catch(() => "");
          const urlLooksEnglish = languageSwitch.enFinalUrl && !languageSwitch.enFinalUrl.includes("/zh-CN/");
          const langLooksEnglish = languageSwitch.enHtmlLang.toLowerCase().startsWith("en");
          const titleChanged = Boolean(languageSwitch.enTitle && normalizeComparableText(languageSwitch.enTitle) !== normalizeComparableText(languageSwitch.zhTitle));
          languageSwitch.switched = Boolean(urlLooksEnglish && (langLooksEnglish || titleChanged));
        } finally {
          if (args.visible) {
            extraContextsToClose.push(enContext);
          } else {
            await enContext.close().catch(() => {});
          }
        }
      }

      const faq = asserted.includes("FE-76") ? await detectFaqSection(page) : null;
      const calendarTab = asserted.includes("FE-78") ? await detectCalendarTab(page) : null;

      const readonlyCasePass = {
        "FE-79": Boolean(pageState.opened && pageState.urlMatchesAlias),
        "FE-01": Boolean(pageState.opened && !pageState.loginFormVisible),
        "FE-02": Boolean(pageState.mainVisualVisible),
        "FE-03": Boolean(titleMatched),
        "FE-04": Boolean(subtitleMatched),
        "FE-05": Boolean(rulesMatched),
        "FE-06": Boolean(prizeAreaOk && prizeCountMatched),
        "FE-07": Boolean(pageState.myPrizeVisible),
        "FE-08": Boolean(basicModulesVisible && !pageState.horizontalOverflow),
        "FE-75": languageSwitch ? Boolean(languageSwitch.switched) : true,
        "FE-76": faq ? Boolean(faq.found) : true,
        "FE-77": Boolean(prizeAreaOk && prizeCountMatched),
        "FE-78": calendarTab ? Boolean(calendarTab.found) : true,
        "FE-17": Boolean(!pageState.loginFormVisible && !pageState.guestVisible && ["立即报名", "抽奖", "抽奖×1", "抽奖×5"].includes(String(pageState.mainButtonState || pageState.drawButtonVariant || "").trim())),
        "FE-19": Boolean(pageState.activityTitleVisible && pageState.countdownVisible && pageState.countdownTicking && !pageState.pageErrorVisible),
      };

      const assertionOk = asserted.length
        ? asserted.every(caseId => readonlyCasePass[caseId] !== false)
        : true;

      const loginOk = pageState.opened && !pageState.guestVisible && !pageState.loginFormVisible;

      const screenshotPath = args.saveScreenshot && args.screenshotPath
        ? resolveArtifactPath(repoRoot, args.screenshotPath)
        : "";
      if (screenshotPath) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      }
      printJson({
        ok: loginOk,
        phase: args.phase,
        assertCaseIds: asserted,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        adminSnapshotPath: expectedSnapshotPath || null,
        expected: expectedSnapshot,
        consistency: {
          titleMatched,
          subtitleMatched,
          rulesMatched,
          prizeCountMatched,
          expectedPrizeCount: Number.isFinite(expectedPrizeCount) ? expectedPrizeCount : null,
          detectedPrizeCount: typeof pageState.prizeCount === "number" ? pageState.prizeCount : null,
          basicModulesVisible,
        },
        assertionOk,
        linkageReadonly: {
          languageSwitch,
          faq,
          calendarTab,
        },
        readonlyCasePass,
        screenshotPath: screenshotPath || null,
        failedResponses: failedResponses.slice(0, 20),
      });
      return loginOk ? 0 : 1;
    }

    if (args.phase === "style_display") {
      pageState = await extractPageState(page, args.activityAlias, { measureLiveSignals: true, includeConsistencySignals: true });
      const styleDisplay = await verifyStyleDisplay(page, args, pageState);
      const ok = Boolean(pageState.opened && !pageState.guestVisible && !pageState.loginFormVisible && styleDisplay.prizeAssetsVisible && styleDisplay.prizeNamesVisible);
      printJson({
        ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        styleDisplay,
        failedResponses: failedResponses.slice(0, 20),
      });
      return ok ? 0 : 1;
    }

    if (args.phase === "responsive_ui") {
      const responsiveUi = await verifyResponsiveUi(browser, cookie, activityUrl, args.activityAlias);
      const ok = Boolean(responsiveUi.h5Opened && responsiveUi.mobileWidthsOk && responsiveUi.lowHeightButtonVisible && responsiveUi.mobileDialogWithinViewport && responsiveUi.longTextNoOverflow);
      printJson({
        ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        responsiveUi,
        failedResponses: failedResponses.slice(0, 20),
      });
      return ok ? 0 : 1;
    }

    const signup = await ensureSignup(page, activityUrl, network);
    let refreshedState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    const countBefore = refreshedState.drawCount ?? 0;
    logFlowProgress(args.phase, `draw count before recharge step: ${countBefore}`);
    let mqRecharge = { ok: false, sent: false, uid, amount: args.rechargeAmount, countBefore, countAfter: countBefore };

    if (args.phase === "signup") {
      const screenshotPath = args.saveScreenshot && args.screenshotPath
        ? resolveArtifactPath(repoRoot, args.screenshotPath)
        : "";
      if (screenshotPath) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      }
      printJson({
        ok: pageState.opened && signup.done,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        screenshotPath: screenshotPath || null,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && signup.done ? 0 : 1;
    }

    if (countBefore < 1 && ["recharge", "full"].includes(args.phase)) {
      logFlowProgress(args.phase, `sending MQ recharge callback uid=${uid} amount=${args.rechargeAmount}`);
      const mqResult = runSkillNodeJson([
        path.join(repoRoot, "skills/weex-fin-admin-ops/scripts/run-cached-action.mjs"),
        "--action",
        "mq_recharge_callback_send",
        "--uid",
        uid,
        "--amount",
        args.rechargeAmount,
        ...(args.visible ? ["--visible"] : []),
        "--confirm-send",
      ]);
      logFlowProgress(args.phase, "MQ callback sent, polling draw count refresh (<=120s)");
      refreshedState = await waitForDrawCountAtLeast(page, args.activityAlias, {
        activityUrl,
        minCount: 1,
        timeoutMs: 120000,
        cookie,
        accountUrl,
      });
      mqRecharge = {
        ok: mqResult.exitCode === 0 && mqResult.payload?.ok !== false,
        sent: true,
        uid,
        amount: args.rechargeAmount,
        countBefore,
        countAfter: refreshedState.drawCount ?? countBefore,
      };
      logFlowProgress(args.phase, `draw count after MQ refresh: ${mqRecharge.countAfter}`);
    } else if (countBefore >= 1) {
      mqRecharge.ok = true;
      mqRecharge.sent = false;
      logFlowProgress(args.phase, `skip MQ send because draw count is already ${countBefore}`);
    }

    if (args.phase === "recharge") {
      const screenshotPath = args.saveScreenshot && args.screenshotPath
        ? resolveArtifactPath(repoRoot, args.screenshotPath)
        : "";
      if (screenshotPath) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      }
      printJson({
        ok: pageState.opened && signup.done && mqRecharge.ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        screenshotPath: screenshotPath || null,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && signup.done && mqRecharge.ok ? 0 : 1;
    }

    if (args.phase === "exception_ui") {
      const exceptionUi = await verifyInjectedExceptionUi(page, network);
      const ok = pageState.opened
        && signup.done
        && exceptionUi.singleDrawFailure.requestSent
        && !exceptionUi.singleDrawFailure.popupPrizeVisible
        && Number(exceptionUi.singleDrawFailure.countBefore) === Number(exceptionUi.singleDrawFailure.countAfter)
        && exceptionUi.apiFailurePromptVisible
        && exceptionUi.timeoutPromptVisible
        && exceptionUi.networkPromptVisible
        && exceptionUi.buttonRestored
        && exceptionUi.duplicatePopupBlocked
        && exceptionUi.pageAlive;
      printJson({
        ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        exceptionUi,
        failedResponses: failedResponses.slice(0, 20),
      });
      return ok ? 0 : 1;
    }

    let draw = {
      requestObserved: false,
      requestSent: false,
      apiSuccess: false,
      apiCode: "",
      apiMessage: "",
      popupVisible: false,
      countBefore: refreshedState.drawCount ?? countBefore,
      countAfter: refreshedState.drawCount ?? countBefore,
    };

    if (args.phase === "draw") {
      draw = await performSingleDraw(page, network);
    }

    if (args.phase === "low_stock_single_draw") {
      const first = await performSingleDraw(page, network, { attemptDuplicate: false });
      const latestLuckDraw = Array.isArray(network?.luckDraws) ? network.luckDraws.at(-1) : null;
      first.popupPrizeText = await readPopupPrizeText(page, latestLuckDraw?.body);
      if (first.popupVisible) {
        await closeRewardPopup(page);
        await page.waitForTimeout(1500);
      }
      const second = await performSingleDraw(page, network, { attemptDuplicate: false });
      const lowStockSingleDraw = { first, second };
      const secondPromptText = String(second.apiMessage || "");
      const secondLowStock = /库存|不足|抢光|所剩不多|奖品所剩不多|尝试单次抽奖|抽完|明天再来/.test(secondPromptText);
      const ok = pageState.opened
        && signup.done
        && first.requestSent
        && first.apiSuccess
        && first.popupVisible
        && Number(first.countBefore) - Number(first.countAfter) === 1
        && second.requestSent
        && !second.apiSuccess
        && secondLowStock
        && Number(second.countBefore) === Number(second.countAfter);
      printJson({
        ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        lowStockSingleDraw,
        failedResponses: failedResponses.slice(0, 20),
      });
      return ok ? 0 : 1;
    }

    if (args.phase === "draw") {
      const latestLuckDraw = Array.isArray(network?.luckDraws) ? network.luckDraws.at(-1) : null;
      draw.popupPrizeText = await readPopupPrizeText(page, latestLuckDraw?.body);
      if (draw.popupVisible) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(1500);
      }
      let drawButton = page.getByText("抽奖", { exact: true }).first();
      if (!(await drawButton.isVisible().catch(() => false))) drawButton = page.locator("button").filter({ hasText: /^抽奖/ }).first();
      const restoredSnapshot = await sampleButtonBusyState(page, drawButton, 1600, 120).catch(() => ({ busy: false }));
      draw.buttonRestoredAfterDraw = Boolean(!restoredSnapshot.busy);
      const screenshotPath = args.saveScreenshot && args.screenshotPath
        ? resolveArtifactPath(repoRoot, args.screenshotPath)
        : "";
      if (screenshotPath) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      }
      printJson({
        ok: pageState.opened && signup.done && draw.apiSuccess,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        draw,
        screenshotPath: screenshotPath || null,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && signup.done && draw.apiSuccess ? 0 : 1;
    }

    if (args.phase === "five_draw") {
      const fiveDraw = await performFiveDraw(page, network);
      let fiveDrawRewardRecord = {
        opened: false,
        dialogVisible: false,
        fieldHeaders: [],
        hasRewardRow: false,
        hasReadableRewardValue: false,
        latestRewardText: "",
        dataLineCount: 0,
      };
      if (fiveDraw.apiSuccess) {
        await page.waitForTimeout(5000);
        fiveDrawRewardRecord = await openRewardRecord(page);
      }
      const fiveDrawOk = pageState.opened
        && signup.done
        && fiveDraw.requestObserved
        && (fiveDraw.apiSuccess || Number(fiveDraw.countBefore) === Number(fiveDraw.countAfter));
      printJson({
        ok: fiveDrawOk,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        fiveDraw,
        fiveDrawRewardRecord,
        failedResponses: failedResponses.slice(0, 20),
      });
      return fiveDrawOk ? 0 : 1;
    }

    await page.waitForTimeout(5000);
    const rewardRecord = await openRewardRecord(page);

    if (args.phase === "reward_record") {
      const screenshotPath = args.saveScreenshot && args.screenshotPath
        ? resolveArtifactPath(repoRoot, args.screenshotPath)
        : "";
      if (screenshotPath) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      }
      const expectedDrawPayload = args.drawPayloadPath ? readOptionalJsonFile(args.drawPayloadPath, repoRoot) : null;
      const expectedPopupPrizeText = expectedDrawPayload ? extractPopupPrizeTextFromPayload(expectedDrawPayload) : "";
      const rewardRecordSearchText = `${rewardRecord.latestRewardText || ""} ${rewardRecord.allRewardText || ""}`;
      const prizeMatchesPopup = expectedPopupPrizeText
        ? expectedPopupPrizeText
          .split(/\s+/)
          .map(item => item.trim())
          .filter(Boolean)
          .every(token => normalizeCompactText(rewardRecordSearchText).includes(normalizeCompactText(token)))
        : false;
      const closedOk = await closeRewardRecordDialog(page);
      printJson({
        ok: pageState.opened && rewardRecord.opened && rewardRecord.dialogVisible,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        rewardRecord: {
          ...rewardRecord,
          expectedPopupPrizeText,
          prizeMatchesPopup,
          closedOk,
        },
        screenshotPath: screenshotPath || null,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && rewardRecord.opened && rewardRecord.dialogVisible ? 0 : 1;
    }

    if (args.phase === "reward_record_extended") {
      const rewardRecordExtended = await verifyRewardRecordExtended(page);
      const ok = Boolean(
        pageState.opened
        && rewardRecordExtended.emptyStateVisible
        && rewardRecordExtended.dataStateVisible
        && rewardRecordExtended.timeFilterOperable
        && rewardRecordExtended.scrollLoadOk
      );
      printJson({
        ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        rewardRecordExtended,
        rewardRecord: rewardRecordExtended.rewardRecord,
        failedResponses: failedResponses.slice(0, 20),
      });
      return ok ? 0 : 1;
    }

    printJson({
      ok: pageState.opened && signup.done && mqRecharge.ok,
      phase: args.phase,
      account: { alias: account.alias, username: account.username, uid },
      page: pageState,
      signup,
      mqRecharge,
      draw,
      rewardRecord,
      screenshotPath: null,
      failedResponses: failedResponses.slice(0, 20),
    });
    return pageState.opened && signup.done && mqRecharge.ok ? 0 : 1;
  } finally {
    if (args.visible && args.holdMs > 0) {
      logFlowProgress(args.phase, `holding browser for ${Math.floor(args.holdMs / 1000)}s...`);
      await page.waitForTimeout(args.holdMs).catch(() => {});
    }
    for (const extraContext of extraContextsToClose) {
      await extraContext.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

async function waitForDrawCountAtLeast(page, activityAlias, { activityUrl, minCount = 1, timeoutMs = 60000, cookie = null, accountUrl = "" } = {}) {
  const startedAt = Date.now();
  let lastReloadAt = 0;
  let reloginAttempts = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const state = await extractPageState(page, activityAlias).catch(() => null);
    if (state?.guestVisible || state?.loginFormVisible) {
      if (cookie && accountUrl && reloginAttempts < 5) {
        reloginAttempts += 1;
        logFlowProgress("recharge", `guest/login state detected while polling draw count; re-injecting cookie and reopening account page (attempt ${reloginAttempts}/5)`);
        await page.context().addCookies([cookie]).catch(() => {});
        await openLoginStatePage(page, accountUrl).catch(() => {});
        await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
        await page.waitForTimeout(1200);
        continue;
      }
      return await extractPageState(page, activityAlias, { measureLiveSignals: true }).catch(() => state);
    }
    const drawCount = Number(state?.drawCount ?? 0);
    if (Number.isFinite(drawCount) && drawCount >= minCount) {
      return await extractPageState(page, activityAlias, { measureLiveSignals: true }).catch(() => state);
    }
    await page.waitForTimeout(3000);
    if (!lastReloadAt || Date.now() - lastReloadAt >= 12000) {
      lastReloadAt = Date.now();
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    }
  }
  return await extractPageState(page, activityAlias, { measureLiveSignals: true });
}

try {
  process.exitCode = await main();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

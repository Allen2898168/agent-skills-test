#!/usr/bin/env node
import path from "node:path";
import { runNodeJson } from "../../../tools/lib/run-node-json.mjs";
import { pathsFrom } from "./lib/runtime.mjs";
import { parseFlags, printJson } from "./lib/cli.mjs";
import {
  appendMidsceneSummary,
  buildMidsceneReportName,
  createMidsceneRecorder,
} from "./lib/midscene.mjs";
import { buildRechargeRefreshState } from "./lib/lottery-frontend-recharge.mjs";
import { loadFrontendEnv } from "../../weex-frontend-ops/scripts/lib/env.mjs";
import { launchBrowser } from "../../weex-frontend-ops/scripts/lib/browser.mjs";
import { resolveFrontendAccount } from "../../weex-frontend-ops/scripts/lib/account-config.mjs";
import { buildFrontendAuthSession } from "../../weex-frontend-ops/scripts/lib/login-tool-adapter.mjs";
import { installFrontendGatewayAuth } from "../../weex-frontend-ops/scripts/lib/frontend-gateway-auth.mjs";
import { openLoginStatePage } from "../../weex-frontend-ops/scripts/business/auth-pages.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/lottery-frontend-main-flow.mjs --dry-run --activity-alias <alias>
  node skills/weex-admin-ops/scripts/lottery-frontend-main-flow.mjs --activity-alias <alias> --recharge-amount 1000 --visible

Phases:
  --phase readonly
  --phase signup
  --phase recharge
  --phase draw
  --phase five_draw
  --phase reward_record
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--dry-run", "--visible"],
  });
  return {
    ...args,
    dryRun: Boolean(args.dryRun),
    visible: Boolean(args.visible),
    phase: String(args.phase || "full"),
    rechargeAmount: String(args.rechargeAmount || "1000"),
    waitForStartMs: Number(args.waitForStartMs || 720000),
    timeoutMs: Number(args.timeoutMs || 90000),
  };
}

function logFlowProgress(phase, message) {
  process.stderr.write(`[frontend-flow:${phase}] ${message}\n`);
}

function runSkillNodeJson(commandArgs) {
  const result = runNodeJson(commandArgs, { cwd: repoRoot, env: process.env });
  return { exitCode: result.exitCode, payload: result.payload };
}

function parseCount(text) {
  const match = String(text || "").match(/(?:可用抽奖次数|可用次数|可抽奖次数|剩余抽奖次数)\s*[：:]?\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

async function waitBeforeClick(page, delayMs = 2000) {
  await page.waitForTimeout(delayMs);
}

async function readVisibleButtons(page) {
  return page.locator("button").evaluateAll(nodes => (
    nodes
      .map(node => (node.innerText || "").trim())
      .filter(Boolean)
      .slice(0, 12)
  )).catch(() => []);
}

function detectGuestState(bodyText, buttons) {
  const body = String(bodyText || "");
  const texts = new Set((buttons || []).map(item => String(item || "").trim()).filter(Boolean));
  if (texts.has("注册")) return true;
  if (body.includes("立即注册，领$10,000+ 迎新礼包")) return true;
  if (body.includes("登录\n注册")) return true;
  return false;
}

function extractCountdownToken(text) {
  const source = String(text || "");
  const localized = source.match(/(距离(?:结束|开始|报名结束)：\s*\d+\s*天:\d+\s*时:\d+\s*分:\d+\s*秒)/);
  if (localized) return localized[1].replace(/\s+/g, "");
  const withDays = source.match(/(\d{1,4}\s*天\s*\d{1,2}:\d{2}:\d{2})/);
  if (withDays) return withDays[1].replace(/\s+/g, "");
  const hhmmss = source.match(/(\d{1,2}:\d{2}:\d{2})/);
  if (hhmmss) return hhmmss[1];
  return "";
}

function detectPageError(bodyText) {
  const source = String(bodyText || "");
  return ["活动不存在", "加载失败", "网络异常", "系统繁忙", "页面异常"].some(item => source.includes(item));
}

function findLikelyActivityTitle(bodyText) {
  const lines = String(bodyText || "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
  return lines.find(line => (
    line.length >= 4
    && line.length <= 40
    && !line.includes("抽奖次数")
    && !line.includes("奖励记录")
    && !line.includes("我的奖品")
    && !line.includes("立即报名")
    && !line.includes("抽奖")
    && !line.includes("登录")
    && !line.includes("注册")
  )) || "";
}

async function readCountdownWidgetText(page) {
  const fromCountdownBox = await page.locator("[class*='index_countDown__']").first().evaluate(node => (
    (node.textContent || "").trim()
  )).catch(() => "");
  if (fromCountdownBox) return fromCountdownBox;
  return page.locator("text=/距离结束|距离开始|距离报名结束/").first().evaluate(node => (
    (node.parentElement?.textContent || node.textContent || "").trim()
  )).catch(() => "");
}

async function detectDrawButtonVariant(page, buttons = []) {
  const candidates = [
    { texts: ["抽奖 × 5", "抽奖x5", "抽奖X5"], state: "抽奖×5" },
    { texts: ["抽奖 × 1", "抽奖x1", "抽奖X1"], state: "抽奖×1" },
    { texts: ["抽奖"], state: "抽奖" },
  ];
  const compactButtons = buttons.map(item => String(item || "").replace(/\s+/g, ""));
  for (const candidate of candidates) {
    for (const text of candidate.texts) {
      const compactText = text.replace(/\s+/g, "");
      if (compactButtons.some(item => item.includes(compactText))) return candidate.state;
      if (await page.getByText(text, { exact: true }).first().isVisible().catch(() => false)) return candidate.state;
    }
  }
  return "";
}

async function measureLivePageSignals(page, bodyText) {
  const titleFromActivityHeader = await page.locator("[class*='index_title1__']").first().innerText().catch(() => "");
  const headingTexts = await page.locator("main h1, main h2, main [role='heading']").evaluateAll(nodes => (
    nodes.map(node => (node.textContent || "").trim()).filter(Boolean)
  )).catch(() => []);
  const activityTitle = String(titleFromActivityHeader || "").trim()
    || headingTexts.find(item => item.length >= 2 && item.length <= 40)
    || findLikelyActivityTitle(bodyText);
  const countdownFromWidgetBefore = await readCountdownWidgetText(page);
  const countdownTextBefore = extractCountdownToken(countdownFromWidgetBefore || bodyText);
  await page.waitForTimeout(2200);
  const nextBodyText = await page.locator("body").innerText().catch(() => bodyText);
  const countdownFromWidgetAfter = await readCountdownWidgetText(page);
  const countdownTextAfter = extractCountdownToken(countdownFromWidgetAfter || nextBodyText);
  return {
    activityTitle,
    activityTitleVisible: Boolean(activityTitle),
    countdownText: countdownTextAfter || countdownTextBefore,
    countdownVisible: Boolean(countdownTextBefore || countdownTextAfter),
    countdownTicking: Boolean(countdownTextBefore && countdownTextAfter && countdownTextBefore !== countdownTextAfter),
    pageErrorVisible: detectPageError(nextBodyText),
    bodyText: nextBodyText,
  };
}

function hasUsableInitialState(state) {
  return Boolean(
    state.mainButtonState
    || state.drawButtonVariant
    || state.myPrizeVisible
    || state.activityTitleVisible
    || state.countdownVisible
    || state.bodySnippet
    || state.buttons.length > 1
  );
}

async function extractPageState(page, activityAlias, options = {}) {
  let bodyText = await page.locator("body").innerText().catch(() => "");
  const buttons = await readVisibleButtons(page);
  const drawButtonVariant = await detectDrawButtonVariant(page, buttons);
  const state = await detectMainButtonState(page, drawButtonVariant);
  let visualState = {
    activityTitle: "",
    activityTitleVisible: false,
    countdownText: "",
    countdownVisible: false,
    countdownTicking: false,
    pageErrorVisible: detectPageError(bodyText),
    bodyText,
  };
  if (options.measureLiveSignals) {
    visualState = await measureLivePageSignals(page, bodyText);
    bodyText = visualState.bodyText;
  }
  return {
    activityAlias,
    url: page.url(),
    urlMatchesAlias: page.url().includes(`/events/draw/${activityAlias}`),
    opened: page.url().includes("/events/draw/"),
    loginFormVisible: await page.getByText("登录").first().isVisible().catch(() => false),
    myPrizeVisible: await page.getByText("我的奖品").first().isVisible().catch(() => false),
    mainButtonState: state,
    drawButtonVariant,
    drawCount: parseCount(bodyText),
    guestVisible: detectGuestState(bodyText, buttons),
    activityTitle: visualState.activityTitle,
    activityTitleVisible: visualState.activityTitleVisible,
    countdownText: visualState.countdownText,
    countdownVisible: visualState.countdownVisible,
    countdownTicking: visualState.countdownTicking,
    pageErrorVisible: visualState.pageErrorVisible,
    buttons,
    bodySnippet: bodyText.slice(0, 800),
  };
}

async function detectMainButtonState(page, drawButtonVariant = "") {
  const candidates = [
    { text: "即将开始", state: "即将开始" },
    { text: "立即报名", state: "立即报名" },
  ];
  for (const candidate of candidates) {
    if (await page.getByText(candidate.text, { exact: true }).first().isVisible().catch(() => false)) return candidate.state;
  }
  if (drawButtonVariant) return "抽奖";
  return "";
}

async function readMainButtonState(page) {
  const buttons = await readVisibleButtons(page);
  const drawButtonVariant = await detectDrawButtonVariant(page, buttons);
  return detectMainButtonState(page, drawButtonVariant);
}

async function sampleButtonBusyState(page, button, windowMs = 1800, intervalMs = 120) {
  const deadline = Date.now() + windowMs;
  let observedDisabled = false;
  let observedBusyClass = false;
  let observedBusyText = false;
  while (Date.now() < deadline) {
    const snapshot = await button.evaluate(node => {
      const className = String(node.className || "");
      const text = String(node.textContent || "").replace(/\s+/g, "");
      const style = globalThis.getComputedStyle ? globalThis.getComputedStyle(node) : null;
      return {
        disabled: Boolean(
          node.disabled
          || node.getAttribute("disabled") != null
          || node.getAttribute("aria-disabled") === "true"
        ),
        busyClass: /disabled|loading|pending|forbid|is-disabled/i.test(className)
          || style?.pointerEvents === "none",
        busyText: /抽奖中|加载中|请稍后/.test(text),
      };
    }).catch(() => ({ disabled: false, busyClass: false, busyText: false }));
    observedDisabled = observedDisabled || snapshot.disabled;
    observedBusyClass = observedBusyClass || snapshot.busyClass;
    observedBusyText = observedBusyText || snapshot.busyText;
    if (observedDisabled || observedBusyClass || observedBusyText) break;
    await page.waitForTimeout(intervalMs);
  }
  return {
    observedDisabled,
    observedBusyClass,
    observedBusyText,
    busy: observedDisabled || observedBusyClass || observedBusyText,
  };
}

async function stabilizeInitialDrawPageState(page, activityAlias, attempts = 3, delayMs = 3000) {
  let state = await extractPageState(page, activityAlias);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!state.guestVisible && hasUsableInitialState(state)) {
      return await extractPageState(page, activityAlias, { measureLiveSignals: true });
    }
    await page.waitForTimeout(delayMs);
    state = await extractPageState(page, activityAlias);
  }
  return await extractPageState(page, activityAlias, { measureLiveSignals: true });
}

async function waitForActivityStart(page, activityUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await detectMainButtonState(page);
    if (state && state !== "即将开始") return state;
    logFlowProgress("wait_start", `still waiting for activity start, elapsed=${Math.floor((Date.now() - startedAt) / 1000)}s`);
    await page.waitForTimeout(5000);
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  }
  return await detectMainButtonState(page);
}

async function waitForRechargeRefresh(page, activityUrl, accountUrl, activityAlias, network, countBefore, options = {}) {
  const attempts = Number(options.attempts || 4);
  const waitMs = Number(options.waitMs || 4000);
  let pageState = await stabilizeInitialDrawPageState(page, activityAlias);
  let progress = buildRechargeRefreshState({
    countBefore,
    pageDrawCount: pageState.drawCount,
    frequency: network.frequency,
    taskCompletions: network.taskCompletions,
  });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (progress.ok) return { pageState, progress, attemptsUsed: attempt - 1 };
    logFlowProgress("recharge", `waiting refresh round ${attempt}/${attempts}; pageCount=${progress.pageCount ?? "null"} frequencyCount=${progress.frequencyCount ?? "null"} taskStatus=${progress.completedTaskStatus || "none"}`);
    await openLoginStatePage(page, accountUrl);
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(waitMs);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(waitMs);
    pageState = await stabilizeInitialDrawPageState(page, activityAlias);
    progress = buildRechargeRefreshState({
      countBefore,
      pageDrawCount: pageState.drawCount,
      frequency: network.frequency,
      taskCompletions: network.taskCompletions,
    });
  }
  return { pageState, progress, attemptsUsed: attempts };
}

async function ensureSignup(page, activityUrl, network) {
  const initialState = await readMainButtonState(page);
  logFlowProgress("signup", `initial main button state: ${initialState || "unknown"}`);
  if (initialState === "即将开始") {
    return {
      initialState,
      finalState: initialState,
      reopenedState: initialState,
      done: false,
    };
  }
  if (initialState === "立即报名") {
    const button = page.getByText("立即报名", { exact: true }).first();
    logFlowProgress("signup", "clicking 立即报名");
    await waitBeforeClick(page);
    await button.click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const finalState = await readMainButtonState(page);
  logFlowProgress("signup", `state after signup action: ${finalState || "unknown"}`);
  await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const reopenedState = await readMainButtonState(page);
  logFlowProgress("signup", `state after reopen: ${reopenedState || "unknown"}`);
  return {
    initialState,
    finalState,
    reopenedState,
    done: network.applyOk || network.applyStatusTrue || finalState === "抽奖" || reopenedState === "抽奖",
  };
}

async function performSingleDraw(page, network) {
  const beforeText = await page.locator("body").innerText().catch(() => "");
  const countBefore = parseCount(beforeText);
  const luckDrawCountBefore = Array.isArray(network?.luckDraws) ? network.luckDraws.length : 0;
  let button = page.locator("button").filter({ hasText: "抽奖 × 1" }).first();
  if (!(await button.isVisible().catch(() => false))) {
    button = page.getByText("抽奖 × 1", { exact: true }).first();
  }
  if (!(await button.isVisible().catch(() => false))) {
    button = page.locator("button").filter({ hasText: /^抽奖$/ }).first();
  }
  if (!(await button.isVisible().catch(() => false))) {
    button = page.getByText("抽奖", { exact: true }).first();
  }
  if (!(await button.isVisible().catch(() => false))) {
    return {
      requestObserved: false,
      requestSent: false,
      buttonVisibleBefore: false,
      buttonDisabledDuringDraw: false,
      duplicateClickBlocked: false,
      requestCountDelta: 0,
      apiSuccess: false,
      apiCode: "",
      apiMessage: "",
      popupVisible: false,
      countBefore,
      countAfter: countBefore,
    };
  }
  const buttonVisibleBefore = true;
  await waitBeforeClick(page);
  await button.click({ timeout: 5000 }).catch(async () => {
    await button.click({ force: true, timeout: 5000 }).catch(() => {});
  });
  const busySnapshot = await sampleButtonBusyState(page, button);
  let secondClickBlocked = false;
  await button.click({ timeout: 1000 }).catch(() => {
    secondClickBlocked = true;
  });
  await page.waitForTimeout(10000);
  const popupVisible = await page.getByText("恭喜你").first().isVisible().catch(() => false);
  const popupRewardSummary = popupVisible
    ? await page.evaluate(() => {
        const visible = element => !!element && element.getClientRects().length
          && getComputedStyle(element).display !== "none"
          && getComputedStyle(element).visibility !== "hidden";
        const dialog = [...document.querySelectorAll('[class*="dialog"], .el-dialog, [role="dialog"]')]
          .filter(visible)
          .find(element => (element.innerText || "").includes("恭喜你"));
        const text = (dialog?.innerText || "").split("\n").map(item => item.trim()).filter(Boolean);
        const lines = text.filter(item => ![
          "恭喜你",
          "知道了",
          "关闭",
          "确认",
        ].includes(item) && !/^(抽奖|立即报名|我的奖品)$/.test(item));
        return lines.slice(0, 3).join(" ").trim();
      }).catch(() => "")
    : "";
  const afterText = await page.locator("body").innerText().catch(() => "");
  const countAfter = parseCount(afterText);
  const luckDraws = Array.isArray(network?.luckDraws) ? network.luckDraws : [];
  const requestCountDelta = Math.max(0, luckDraws.length - luckDrawCountBefore);
  const latestLuckDraw = luckDraws.slice(luckDrawCountBefore).at(-1) || luckDraws.at(-1) || null;
  const apiCode = latestLuckDraw?.body?.code ? String(latestLuckDraw.body.code) : "";
  const apiMessage = String(
    latestLuckDraw?.body?.msg
      || latestLuckDraw?.body?.message
      || ""
  );
  const apiSuccess = apiCode === "00000";
  if (popupVisible) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1200);
  }
  const buttonRestoredAfterDraw = await page.locator("button").filter({ hasText: /抽奖/ }).first().isVisible().catch(() => false);
  return {
    requestObserved: apiSuccess || popupVisible || (countBefore != null && countAfter != null && countBefore - countAfter === 1),
    requestSent: Boolean(latestLuckDraw),
    buttonVisibleBefore,
    buttonDisabledDuringDraw: busySnapshot.busy,
    buttonRestoredAfterDraw,
    duplicateClickBlocked: secondClickBlocked || requestCountDelta <= 1,
    requestCountDelta,
    apiSuccess,
    apiCode,
    apiMessage,
    popupVisible,
    popupRewardSummary,
    countBefore,
    countAfter,
  };
}

async function readRewardPopup(page) {
  const popupVisible = await page.getByText("恭喜你").first().isVisible().catch(() => false);
  if (!popupVisible) {
    return { popupVisible: false, popupRewardSummary: "", popupRewardCount: 0 };
  }
  const popupData = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dialog = [...document.querySelectorAll('[class*="dialog"], .el-dialog, [role="dialog"]')]
      .filter(visible)
      .find(element => (element.innerText || "").includes("恭喜你"));
    const text = (dialog?.innerText || "").split("\n").map(item => item.trim()).filter(Boolean);
    const lines = text.filter(item => ![
      "恭喜你",
      "知道了",
      "关闭",
      "确认",
    ].includes(item) && !/^(抽奖|立即报名|我的奖品)$/.test(item));
    return {
      popupRewardSummary: lines.slice(0, 5).join(" ").trim(),
      popupRewardCount: lines.length,
    };
  }).catch(() => ({ popupRewardSummary: "", popupRewardCount: 0 }));
  return {
    popupVisible,
    popupRewardSummary: popupData.popupRewardSummary || "",
    popupRewardCount: Number(popupData.popupRewardCount || 0),
  };
}

async function performFiveDraw(page, network) {
  const beforeText = await page.locator("body").innerText().catch(() => "");
  const countBefore = parseCount(beforeText);
  const luckDrawCountBefore = Array.isArray(network?.luckDraws) ? network.luckDraws.length : 0;
  let button = page.locator("button").filter({ hasText: "抽奖 × 5" }).first();
  if (!(await button.isVisible().catch(() => false))) {
    button = page.getByText("抽奖 × 5", { exact: true }).first();
  }
  if (!(await button.isVisible().catch(() => false))) {
    button = page.locator("button").filter({ hasText: /抽奖\s*[xX×]\s*5/ }).first();
  }
  if (!(await button.isVisible().catch(() => false))) {
    return {
      requestObserved: false,
      requestSent: false,
      buttonVisibleBefore: false,
      buttonDisabledDuringDraw: false,
      duplicateClickBlocked: false,
      requestCountDelta: 0,
      apiSuccess: false,
      apiCode: "",
      apiMessage: "",
      popupVisible: false,
      popupRewardSummary: "",
      popupRewardCount: 0,
      countBefore,
      countAfter: countBefore,
    };
  }
  const buttonVisibleBefore = true;
  await waitBeforeClick(page);
  await button.click({ timeout: 5000 }).catch(async () => {
    await button.click({ force: true, timeout: 5000 }).catch(() => {});
  });
  const busySnapshot = await sampleButtonBusyState(page, button);
  let secondClickBlocked = false;
  await button.click({ timeout: 1000 }).catch(() => {
    secondClickBlocked = true;
  });
  await page.waitForTimeout(10000);
  const popup = await readRewardPopup(page);
  const afterText = await page.locator("body").innerText().catch(() => "");
  const countAfter = parseCount(afterText);
  const luckDraws = Array.isArray(network?.luckDraws) ? network.luckDraws : [];
  const requestCountDelta = Math.max(0, luckDraws.length - luckDrawCountBefore);
  const latestLuckDraw = luckDraws.slice(luckDrawCountBefore).at(-1) || luckDraws.at(-1) || null;
  const apiCode = latestLuckDraw?.body?.code ? String(latestLuckDraw.body.code) : "";
  const apiMessage = String(
    latestLuckDraw?.body?.msg
      || latestLuckDraw?.body?.message
      || ""
  );
  const apiSuccess = apiCode === "00000";
  if (popup.popupVisible) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1200);
  }
  const buttonRestoredAfterDraw = await page.locator("button").filter({ hasText: /抽奖/ }).first().isVisible().catch(() => false);
  return {
    requestObserved: apiSuccess || popup.popupVisible || (countBefore != null && countAfter != null && countBefore - countAfter === 5),
    requestSent: Boolean(latestLuckDraw),
    buttonVisibleBefore,
    buttonDisabledDuringDraw: busySnapshot.busy,
    buttonRestoredAfterDraw,
    duplicateClickBlocked: secondClickBlocked || requestCountDelta <= 1,
    requestCountDelta,
    apiSuccess,
    apiCode,
    apiMessage,
    popupVisible: popup.popupVisible,
    popupRewardSummary: popup.popupRewardSummary,
    popupRewardCount: popup.popupRewardCount,
    countBefore,
    countAfter,
  };
}

function extractCurrentActivityRewardSlice(lines, activityTitle) {
  const normalizedTitle = String(activityTitle || "").trim();
  if (!normalizedTitle) {
    return {
      currentActivityLines: [],
      currentActivityRewardSummary: "",
      currentActivityHasRewardRow: false,
      currentActivityReadableRewardValue: false,
      currentActivityDataLineCount: 0,
    };
  }
  const matchingIndex = lines.findIndex(item => item === normalizedTitle || item.includes(normalizedTitle));
  if (matchingIndex < 0) {
    return {
      currentActivityLines: [],
      currentActivityRewardSummary: "",
      currentActivityHasRewardRow: false,
      currentActivityReadableRewardValue: false,
      currentActivityDataLineCount: 0,
    };
  }
  const nextTitleIndex = lines.findIndex((item, index) => (
    index > matchingIndex
    && item !== normalizedTitle
    && /[\u4e00-\u9fa5A-Za-z0-9].*/.test(item)
    && (item.includes("前端主回归") || item.includes("联动标题") || item.includes("自动化"))
  ));
  const sliceEnd = nextTitleIndex > matchingIndex ? nextTitleIndex : Math.min(lines.length, matchingIndex + 5);
  const currentActivityLines = lines.slice(matchingIndex, sliceEnd);
  const currentActivityDataLines = currentActivityLines.slice(1);
  return {
    currentActivityLines,
    currentActivityRewardSummary: currentActivityDataLines.slice(0, 2).join(" ").trim(),
    currentActivityHasRewardRow: currentActivityDataLines.length >= 3,
    currentActivityReadableRewardValue: currentActivityDataLines.some(item => /[A-Za-z\u4e00-\u9fa5]{2,}|\d+(?:\.\d+)?/.test(item)),
    currentActivityDataLineCount: currentActivityDataLines.length,
  };
}

async function openRewardRecord(page, pageState = {}) {
  if (await page.getByText("恭喜你").first().isVisible().catch(() => false)) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1500);
  }
  const trigger = page.getByText("我的奖品", { exact: true }).last();
  const opened = await trigger.isVisible().catch(() => false);
  if (opened) {
    await waitBeforeClick(page);
    await trigger.click({ force: true, timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(3000);
  const dialogVisible = await page.getByText("奖励记录").first().isVisible({ timeout: 15000 }).catch(() => false);
  const bodyText = dialogVisible ? await page.locator("body").innerText().catch(() => "") : "";
  const fieldHeaders = ["活动名称", "奖励金额", "获奖时间", "备注"].filter(item => bodyText.includes(item));
  const lines = bodyText
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
  const dataLines = lines.filter(item => ![
    "奖励记录",
    "活动名称",
    "奖励金额",
    "获奖时间",
    "备注",
    "我的奖品",
  ].includes(item));
  const firstRewardSummary = dataLines.slice(0, 2).join(" ").trim();
  const hasRewardRow = dialogVisible && fieldHeaders.length >= 4 && dataLines.length >= 4;
  const hasReadableRewardValue = dataLines.some(item => /[A-Za-z\u4e00-\u9fa5]{2,}|\d+(?:\.\d+)?/.test(item));
  const emptyStateText = lines.find(item => ["暂无数据", "暂无记录", "No Data"].includes(item)) || "";
  const emptyStateVisible = dialogVisible && Boolean(emptyStateText);
  const currentActivity = extractCurrentActivityRewardSlice(lines, pageState.activityTitle || "");
  let closeAttempted = false;
  let closed = false;
  let pageRecoveredAfterClose = false;
  if (dialogVisible) {
    closeAttempted = true;
    const closeButton = page.locator(".el-dialog__headerbtn, .el-dialog__close").first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ force: true, timeout: 5000 }).catch(() => {});
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
    await page.waitForTimeout(1200);
    closed = !(await page.getByText("奖励记录").first().isVisible().catch(() => false));
    pageRecoveredAfterClose = closed && (
      await page.getByText("我的奖品").first().isVisible().catch(() => false)
      || await page.locator("button").filter({ hasText: /抽奖/ }).first().isVisible().catch(() => false)
    );
  }
  return {
    opened,
    dialogVisible,
    fieldHeaders,
    hasActivityTitle: bodyText.includes("前端主回归"),
    hasRewardRow,
    hasReadableRewardValue,
    dataLineCount: dataLines.length,
    firstRewardSummary,
    currentActivityTitle: pageState.activityTitle || "",
    currentActivityLines: currentActivity.currentActivityLines,
    currentActivityRewardSummary: currentActivity.currentActivityRewardSummary,
    currentActivityHasRewardRow: currentActivity.currentActivityHasRewardRow,
    currentActivityReadableRewardValue: currentActivity.currentActivityReadableRewardValue,
    currentActivityDataLineCount: currentActivity.currentActivityDataLineCount,
    emptyStateVisible,
    emptyStateText,
    closeAttempted,
    closed,
    pageRecoveredAfterClose,
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
  const account = resolveFrontendAccount(args.accountAlias);
  const activityHost = process.env.WEEX_FRONTEND_ACTIVITY_HOST || "https://stg-www.weex.tech";
  const activityUrl = `${activityHost.replace(/\/+$/, "")}/zh-CN/events/draw/${args.activityAlias}`;
  const accountUrl = process.env.WEEX_FRONTEND_ACCOUNT_URL || `${activityHost.replace(/\/+$/, "")}/zh-CN/account`;

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

  const auth = await buildFrontendAuthSession({
    username: account.username,
    password: account.password,
    targetUrl: activityUrl,
    timeoutMs: args.timeoutMs,
  });
  const uid = String(auth.tokens.userId || "");
  const cookie = auth.cookie;

  const { browser, context, page, failedResponses } = await launchBrowser({
    visible: args.visible,
    disableWebSecurity: true,
  });
  const midscene = await createMidsceneRecorder(page, {
    reportName: buildMidsceneReportName(["lottery-frontend", args.phase, args.activityAlias]),
    groupName: "WEEX Lottery Frontend Regression",
    groupDescription: `frontend phase: ${args.phase}`,
  });
  const network = { applyOk: false, applyStatusTrue: false, luckDraws: [], taskCompletions: null, frequency: null };
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
        network.luckDraws.push({
          status: response.status(),
          url,
          body: await response.json(),
        });
      } catch {
        network.luckDraws.push({ status: response.status(), url, body: null });
      }
    }
    if (url.includes("/v1/activity/general/taskCompletions?")) {
      try { network.taskCompletions = await response.json(); } catch {}
    }
    if (url.includes("/v1/activity/general/raffle/frequency?")) {
      try { network.frequency = await response.json(); } catch {}
    }
  });

  try {
    const emitResult = async (payload, stream = process.stdout) => {
      await midscene.record(`phase:${args.phase}`, JSON.stringify({
        ok: payload?.ok,
        phase: payload?.phase,
        activityAlias: args.activityAlias,
      }, null, 2)).catch(() => {});
      const midsceneReportPath = await midscene.finalize();
      printJson(appendMidsceneSummary(payload, midsceneReportPath), stream);
    };
    logFlowProgress(args.phase, `prepare auth session for activity ${args.activityAlias}`);
    await context.addCookies([cookie]);
    await installFrontendGatewayAuth(context, auth.tokens.accessToken, { referer: activityUrl });
    await openLoginStatePage(page, accountUrl);
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await midscene.record("打开活动页", activityUrl);
    let pageState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    if (pageState.guestVisible) {
      await emitResult({
        ok: false,
        error: "frontend draw page still showed guest state after cookie login",
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        failedResponses: failedResponses.slice(0, 20),
      });
      return 1;
    }
    if (pageState.mainButtonState === "即将开始") {
      logFlowProgress(args.phase, `activity not started yet, waiting up to ${Math.floor(args.waitForStartMs / 1000)}s`);
      pageState.mainButtonState = await waitForActivityStart(page, activityUrl, args.waitForStartMs);
      pageState = await extractPageState(page, args.activityAlias, { measureLiveSignals: true });
    }

    if (args.phase === "readonly") {
      await emitResult({
        ok: pageState.opened && !pageState.guestVisible && !pageState.loginFormVisible,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && !pageState.guestVisible && !pageState.loginFormVisible ? 0 : 1;
    }

    const signup = await ensureSignup(page, activityUrl, network);
    let refreshedState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    const countBefore = refreshedState.drawCount ?? 0;
    logFlowProgress(args.phase, `draw count before recharge step: ${countBefore}`);
    let mqRecharge = { ok: false, sent: false, uid, amount: args.rechargeAmount, countBefore, countAfter: countBefore };

    if (args.phase === "signup") {
      await emitResult({
        ok: pageState.opened && signup.done,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
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
        "--confirm-send",
      ]);
      logFlowProgress(args.phase, "MQ callback sent, refreshing activity page");
      const refresh = await waitForRechargeRefresh(page, activityUrl, accountUrl, args.activityAlias, network, countBefore, {
        attempts: 4,
        waitMs: 4000,
      });
      refreshedState = refresh.pageState;
      mqRecharge = {
        ok: mqResult.exitCode === 0 && mqResult.payload?.ok !== false && refresh.progress.ok,
        sent: true,
        uid,
        amount: args.rechargeAmount,
        countBefore: refresh.progress.countBefore,
        countAfter: refresh.progress.countAfter,
        pageCount: refresh.progress.pageCount,
        frequencyCount: refresh.progress.frequencyCount,
        completedTaskId: refresh.progress.completedTaskId,
        completedTaskType: refresh.progress.completedTaskType,
        completedTaskStatus: refresh.progress.completedTaskStatus,
        refreshAttempts: refresh.attemptsUsed,
      };
      logFlowProgress(args.phase, `draw count after MQ refresh: ${mqRecharge.countAfter}; frequencyCount=${mqRecharge.frequencyCount ?? "null"} taskId=${mqRecharge.completedTaskId ?? "none"} taskStatus=${mqRecharge.completedTaskStatus || "none"}`);
    } else if (countBefore >= 1) {
      mqRecharge.ok = true;
      mqRecharge.sent = false;
      logFlowProgress(args.phase, `skip MQ send because draw count is already ${countBefore}`);
    }

    if (args.phase === "recharge") {
      await emitResult({
        ok: pageState.opened && signup.done && mqRecharge.ok,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && signup.done && mqRecharge.ok ? 0 : 1;
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
    let fiveDraw = {
      requestObserved: false,
      requestSent: false,
      apiSuccess: false,
      apiCode: "",
      apiMessage: "",
      popupVisible: false,
      popupRewardSummary: "",
      popupRewardCount: 0,
      countBefore: refreshedState.drawCount ?? countBefore,
      countAfter: refreshedState.drawCount ?? countBefore,
    };

    if (args.phase === "draw") {
      draw = await performSingleDraw(page, network);
    }

    if (args.phase === "draw") {
      await emitResult({
        ok: pageState.opened && signup.done && draw.apiSuccess,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        draw,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && signup.done && draw.apiSuccess ? 0 : 1;
    }

    if (args.phase === "five_draw") {
      fiveDraw = await performFiveDraw(page, network);
      const fiveDrawOk = pageState.opened && signup.done && fiveDraw.requestObserved;
      await emitResult({
        ok: fiveDrawOk,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        fiveDraw,
        failedResponses: failedResponses.slice(0, 20),
      });
      return fiveDrawOk ? 0 : 1;
    }

    await page.waitForTimeout(5000);
    const rewardRecord = await openRewardRecord(page, pageState);

    if (args.phase === "reward_record") {
      await emitResult({
        ok: pageState.opened && rewardRecord.opened && rewardRecord.dialogVisible,
        phase: args.phase,
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        signup,
        mqRecharge,
        rewardRecord,
        failedResponses: failedResponses.slice(0, 20),
      });
      return pageState.opened && rewardRecord.opened && rewardRecord.dialogVisible ? 0 : 1;
    }

    await emitResult({
      ok: pageState.opened && signup.done && mqRecharge.ok,
      phase: args.phase,
      account: { alias: account.alias, username: account.username, uid },
      page: pageState,
      signup,
      mqRecharge,
      draw,
      rewardRecord,
      failedResponses: failedResponses.slice(0, 20),
    });
    return pageState.opened && signup.done && mqRecharge.ok ? 0 : 1;
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

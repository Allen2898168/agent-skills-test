import fs from "node:fs";
import path from "node:path";
import { openLoginStatePage } from "../business/auth-pages.mjs";

function logFlowProgress(phase, message) {
  const safePhase = String(phase || "").trim() || "unknown";
  const safeMessage = String(message || "").trim();
  process.stderr.write(`[frontend-flow:${safePhase}] ${safeMessage}\n`);
}

function parseCount(text) {
  const match = String(text || "").match(/(?:可用抽奖次数|可用次数|可抽奖次数|剩余抽奖次数)\s*[：:]?\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function resolveArtifactPath(repoRootPath, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(repoRootPath, trimmed);
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

function normalizeComparableText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompactText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

async function detectHorizontalOverflow(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    if (!doc) return false;
    return doc.scrollWidth > doc.clientWidth + 2;
  }).catch(() => false);
}

async function detectMainVisual(page) {
  return await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("canvas, svg, img"));
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      const visible = rect.width >= 60 && rect.height >= 60 && rect.top < window.innerHeight && rect.bottom > 0;
      const style = window.getComputedStyle(node);
      if (visible && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") return true;
    }
    const classHits = Array.from(document.querySelectorAll("[class]")).some(node => (
      /turntable|roulette|wheel|spin|lottery/i.test(String(node.className || ""))
    ));
    return classHits;
  }).catch(() => false);
}

async function readSubtitleText(page) {
  const subtitle = await page.locator("[class*='index_title2__']").first().innerText().catch(() => "");
  if (subtitle) return String(subtitle).trim();
  const title2 = await page.locator("[class*='title2']").first().innerText().catch(() => "");
  if (title2) return String(title2).trim();
  const candidates = await page.locator("main h3, main p").evaluateAll(nodes => (
    nodes.map(node => (node.textContent || "").trim()).filter(Boolean).slice(0, 6)
  )).catch(() => []);
  return String(candidates.find(item => item.length >= 2 && item.length <= 40) || "").trim();
}

async function readRulesText(page) {
  const byClass = await page.locator("[class*='rule'], [class*='Rule']").first().innerText().catch(() => "");
  if (byClass) return String(byClass).trim();
  const byText = await page.locator("text=/活动规则|规则说明|活动规则：|规则：/").first().evaluate(node => (
    (node.parentElement?.textContent || node.textContent || "").trim()
  )).catch(() => "");
  return String(byText || "").trim();
}

async function detectFaqSection(page) {
  await page.evaluate(() => window.scrollTo(0, Math.max(0, document.body.scrollHeight - window.innerHeight))).catch(() => {});
  await page.waitForTimeout(1200);
  return await page.evaluate(() => {
    const root = document.querySelector("main") || document.body;
    if (!root) return { found: false, matchedText: "" };
    const nodes = Array.from(root.querySelectorAll("*"));
    const hit = nodes.find(node => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.closest("footer")) return false;
      const text = (node.innerText || "").trim();
      if (!text) return false;
      if (!((text.includes("FAQ") || text.includes("常见问题")) && text.length <= 160)) return false;
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return false;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      return true;
    });
    return { found: Boolean(hit), matchedText: hit ? String(hit.innerText || "").trim().slice(0, 120) : "" };
  }).catch(() => ({ found: false, matchedText: "" }));
}

async function detectCalendarTab(page) {
  return await page.evaluate(() => {
    const root = document.body;
    if (!root) return { found: false, top: null, text: "" };
    const nodes = Array.from(root.querySelectorAll("*"));
    const candidates = nodes.filter(node => {
      if (!(node instanceof HTMLElement)) return false;
      const text = (node.innerText || "").trim();
      if (!(text.includes("活动日历") && text.length <= 30)) return false;
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return false;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      return true;
    });
    const best = candidates
      .map(node => ({ node, rect: node.getBoundingClientRect() }))
      .filter(item => item.rect.width > 0 && item.rect.height > 0)
      .sort((a, b) => a.rect.top - b.rect.top)[0];
    if (!best) return { found: false, top: null, text: "" };
    return { found: best.rect.top >= -5 && best.rect.top < 650, top: Math.round(best.rect.top), text: String(best.node.innerText || "").trim().slice(0, 30) };
  }).catch(() => ({ found: false, top: null, text: "" }));
}

function removeLocalePrefixFromUrl(url) {
  const source = String(url || "");
  return source.replace(/\/zh-CN\/events\//, "/events/");
}

function deepFindPrizeArrayLength(root, depth = 0, visited = new Set()) {
  if (!root || depth > 6) return null;
  if (typeof root !== "object") return null;
  if (visited.has(root)) return null;
  visited.add(root);
  if (Array.isArray(root)) {
    if (root.length && root.every(item => item && typeof item === "object")) {
      const keys = new Set(Object.keys(root[0] || {}));
      if (keys.has("prizeId") || keys.has("linkPrizeId") || keys.has("prizeName") || keys.has("awardName")) return root.length;
    }
    for (const item of root) {
      const hit = deepFindPrizeArrayLength(item, depth + 1, visited);
      if (typeof hit === "number") return hit;
    }
    return null;
  }
  for (const value of Object.values(root)) {
    const hit = deepFindPrizeArrayLength(value, depth + 1, visited);
    if (typeof hit === "number") return hit;
  }
  return null;
}

async function readPrizeCount(page) {
  const nextDataCount = await page.evaluate(() => {
    const node = document.getElementById("__NEXT_DATA__");
    if (!node?.textContent) return null;
    try {
      return JSON.parse(node.textContent);
    } catch {
      return null;
    }
  }).then(parsed => deepFindPrizeArrayLength(parsed)).catch(() => null);
  if (typeof nextDataCount === "number" && Number.isFinite(nextDataCount)) return nextDataCount;
  const domCount = await page.evaluate(() => {
    const prizeRoot = Array.from(document.querySelectorAll("*")).find(node => (
      (node.textContent || "").includes("奖池")
    ));
    const scope = prizeRoot?.parentElement || document.body;
    const candidates = scope ? Array.from(scope.querySelectorAll("li, img, [class*='award'], [class*='prize']")) : [];
    const uniqueBlocks = candidates.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 10 && rect.height > 10 && rect.top < window.innerHeight * 2 && rect.bottom > 0;
    });
    const guessed = uniqueBlocks.length;
    return guessed ? Math.min(guessed, 64) : null;
  }).catch(() => null);
  return typeof domCount === "number" && Number.isFinite(domCount) ? domCount : null;
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
  const includeConsistencySignals = Boolean(options.includeConsistencySignals);
  const subtitleText = includeConsistencySignals ? await readSubtitleText(page) : "";
  const rulesText = includeConsistencySignals ? await readRulesText(page) : "";
  const prizeCount = includeConsistencySignals ? await readPrizeCount(page) : null;
  const prizeAreaVisible = includeConsistencySignals
    ? await page.getByText("奖池").first().isVisible().catch(() => false)
    : false;
  const mainVisualVisible = includeConsistencySignals ? await detectMainVisual(page) : false;
  const horizontalOverflow = includeConsistencySignals ? await detectHorizontalOverflow(page) : false;
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
    activitySubtitle: subtitleText,
    activitySubtitleVisible: Boolean(subtitleText),
    rulesText,
    rulesVisible: Boolean(rulesText),
    prizeCount,
    prizeAreaVisible,
    mainVisualVisible,
    horizontalOverflow,
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
  return await waitForActivityStartWithSession(page, { activityUrl }, timeoutMs);
}

async function waitForActivityStartWithSession(page, { activityUrl, activityAlias = "", accountUrl = "", cookie = null } = {}, timeoutMs) {
  const startedAt = Date.now();
  let lastReloadAt = 0;
  let reloginAttempted = false;
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = activityAlias
      ? await extractPageState(page, activityAlias, { measureLiveSignals: true }).catch(() => null)
      : null;
    const mainButtonState = snapshot?.mainButtonState || await readMainButtonState(page);
    if (mainButtonState && mainButtonState !== "即将开始") return mainButtonState;

    const guestVisible = Boolean(snapshot?.guestVisible);
    const loginFormVisible = Boolean(snapshot?.loginFormVisible);
    if (guestVisible || loginFormVisible) {
      if (!reloginAttempted && cookie && accountUrl) {
        reloginAttempted = true;
        logFlowProgress("wait_start", "guest/login state detected while waiting start; re-injecting cookie and reopening account page once");
        await page.context().addCookies([cookie]).catch(() => {});
        await openLoginStatePage(page, accountUrl).catch(() => {});
        await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
        continue;
      }
      throw new Error("frontend draw page entered guest/login state while waiting for activity start");
    }

    if (snapshot?.countdownTicking) {
      await page.waitForTimeout(2000);
      continue;
    }

    await page.waitForTimeout(5000);
    if (!lastReloadAt || Date.now() - lastReloadAt >= 30000) {
      lastReloadAt = Date.now();
      logFlowProgress("wait_start", `still waiting for activity start, elapsed=${Math.floor((Date.now() - startedAt) / 1000)}s (reload)`);
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    }
  }
  return await readMainButtonState(page);
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

async function performSingleDraw(page, network, options = {}) {
  const attemptDuplicate = options.attemptDuplicate !== false;
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
  if (attemptDuplicate) {
    await button.click({ timeout: 1000 }).catch(() => {
      secondClickBlocked = true;
    });
  }
  await page.waitForTimeout(10000);
  const popupVisible = await page.getByText("恭喜你").first().isVisible().catch(() => false);
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
  const failurePromptVisible = !apiSuccess && Boolean(apiMessage || /库存|不足|失败|繁忙|稍后|所剩不多|尝试单次抽奖/.test(afterText));
  return {
    requestObserved: apiSuccess || popupVisible || (countBefore != null && countAfter != null && countBefore - countAfter === 1),
    requestSent: Boolean(latestLuckDraw),
    buttonVisibleBefore,
    buttonDisabledDuringDraw: busySnapshot.busy,
    duplicateClickBlocked: !attemptDuplicate || secondClickBlocked || requestCountDelta <= 1,
    requestCountDelta,
    apiSuccess,
    apiCode,
    apiMessage,
    failurePromptVisible,
    popupVisible,
    countBefore,
    countAfter,
  };
}

async function readRewardPopup(page) {
  const popupVisible = await page.getByText("恭喜你").first().isVisible({ timeout: 15000 }).catch(() => false);
  if (!popupVisible) {
    return { popupVisible: false, popupRewardSummary: "", popupRewardCount: 0 };
  }
  const popupData = await page.evaluate(() => {
    const visible = element => !!element
      && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const roots = [...document.querySelectorAll('[class*="dialog"], .el-dialog, [role="dialog"], div, section')]
      .filter(visible)
      .filter(element => String(element.innerText || element.textContent || "").includes("恭喜你"));
    const dialog = roots.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    })[0] || roots[0];
    const text = String(dialog?.innerText || dialog?.textContent || "")
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);
    const lines = text.filter(item => ![
      "恭喜你",
      "知道了",
      "关闭",
      "确认",
    ].includes(item) && !/^(抽奖|立即报名|我的奖品|分享)$/.test(item));
    return {
      popupRewardSummary: lines.slice(0, 8).join(" ").trim(),
      popupRewardCount: lines.length,
    };
  }).catch(() => ({ popupRewardSummary: "", popupRewardCount: 0 }));
  return {
    popupVisible,
    popupRewardSummary: popupData.popupRewardSummary || "",
    popupRewardCount: Number(popupData.popupRewardCount || 0),
  };
}

async function closeRewardPopup(page) {
  if (!(await page.getByText("恭喜你").first().isVisible().catch(() => false))) return true;
  const closeLocators = [
    page.locator(".el-dialog__close, [aria-label='Close'], [class*='close'], [class*='Close']").last(),
    page.getByText("确定", { exact: true }).last(),
    page.getByText("知道了", { exact: true }).last(),
  ];
  for (const locator of closeLocators) {
    if (!(await locator.isVisible().catch(() => false))) continue;
    await locator.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);
    if (!(await page.getByText("恭喜你").first().isVisible().catch(() => false))) return true;
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);
  return !(await page.getByText("恭喜你").first().isVisible().catch(() => false));
}

async function performFiveDraw(page, network) {
  const beforeText = await page.locator("body").innerText().catch(() => "");
  const countBefore = parseCount(beforeText);
  const luckDrawCountBefore = Array.isArray(network?.luckDraws) ? network.luckDraws.length : 0;
  const raffleDrawCountBefore = Array.isArray(network?.raffleDraws) ? network.raffleDraws.length : 0;
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
      buttonRestoredAfterDraw: false,
      duplicateClickBlocked: false,
      requestCountDelta: 0,
      apiSuccess: false,
      apiCode: "",
      apiMessage: "",
      popupVisible: false,
      popupRewardSummary: "",
      popupRewardCount: 0,
      failurePromptVisible: false,
      countBefore,
      countAfter: countBefore,
    };
  }
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
  const raffleDraws = Array.isArray(network?.raffleDraws) ? network.raffleDraws : [];
  const newLuckDraws = luckDraws.slice(luckDrawCountBefore);
  const newRaffleDraws = raffleDraws.slice(raffleDrawCountBefore);
  const requestCountDelta = Math.max(0, newLuckDraws.length || newRaffleDraws.length);
  const latestLuckDraw = newLuckDraws.at(-1) || newRaffleDraws.at(-1) || luckDraws.at(-1) || raffleDraws.at(-1) || null;
  const apiCode = latestLuckDraw?.body?.code ? String(latestLuckDraw.body.code) : "";
  const apiMessage = String(
    latestLuckDraw?.body?.msg
      || latestLuckDraw?.body?.message
      || ""
  );
  const apiSuccess = apiCode === "00000";
  const failurePromptVisible = !apiSuccess && Boolean(apiMessage || /库存|不足|失败|繁忙|稍后/.test(afterText));
  if (popup.popupVisible) await closeRewardPopup(page);
  const buttonRestoredAfterDraw = await page.locator("button").filter({ hasText: /抽奖/ }).first().isVisible().catch(() => false);
  return {
    requestObserved: apiSuccess || popup.popupVisible || failurePromptVisible || (countBefore != null && countAfter != null && countBefore - countAfter === 5),
    requestSent: Boolean(latestLuckDraw),
    buttonVisibleBefore: true,
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
    failurePromptVisible,
    countBefore,
    countAfter,
  };
}

async function openRewardRecord(page) {
  if (await page.getByText("恭喜你").first().isVisible().catch(() => false)) {
    await closeRewardPopup(page);
    await page.waitForTimeout(1500);
  }
  const trigger = page.getByText("我的奖品", { exact: true }).last();
  const opened = await trigger.isVisible().catch(() => false);
  let bodyTextAfterClick = "";
  let dialogTitleVisible = false;
  let dialogVisible = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (opened) {
      await waitBeforeClick(page);
      await trigger.click({ force: true, timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(3000);
    bodyTextAfterClick = await page.locator("body").innerText().catch(() => "");
    dialogTitleVisible = await page.getByText("奖励记录").first().isVisible({ timeout: 3000 }).catch(() => false);
    dialogVisible = Boolean(dialogTitleVisible || ["活动名称", "奖励金额", "获奖时间", "备注"].some(item => bodyTextAfterClick.includes(item)));
    if (dialogVisible) break;
  }
  let bodyText = dialogVisible ? bodyTextAfterClick : "";
  let lines = bodyText
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
  let rewardHit = "";
  if (dialogVisible) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      lines = bodyText
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
      const headerIndex = Math.max(
        lines.lastIndexOf("备注"),
        lines.lastIndexOf("获奖时间"),
        lines.lastIndexOf("奖励金额"),
        lines.lastIndexOf("活动名称"),
      );
      const scopedLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
      rewardHit = scopedLines.find(item => (
        /抽中|USDT|BTC|ETH|赠金|体验金|积分|资格|实物/.test(item)
        && !/买币|市场|合约交易|现货交易|理财|更多|分享|活动日历|恭喜\d+\*+/.test(item)
      )) || "";
      if (rewardHit) break;
      await page.waitForTimeout(1200);
      bodyText = await page.locator("body").innerText().catch(() => bodyText);
    }
  }
  const fieldHeaders = ["活动名称", "奖励金额", "获奖时间", "备注"].filter(item => bodyText.includes(item));
  const headerIndex = Math.max(
    lines.lastIndexOf("备注"),
    lines.lastIndexOf("获奖时间"),
    lines.lastIndexOf("奖励金额"),
    lines.lastIndexOf("活动名称"),
  );
  const recordLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
  const dataLines = recordLines.filter(item => ![
    "奖励记录",
    "活动名称",
    "奖励金额",
    "获奖时间",
    "备注",
    "我的奖品",
  ].includes(item));
  const hasRewardRow = dialogVisible && fieldHeaders.length >= 4 && (rewardHit ? true : dataLines.length >= 4);
  const hasReadableRewardValue = rewardHit
    ? true
    : dataLines.some(item => /[A-Za-z\u4e00-\u9fa5]{2,}|\d+(?:\.\d+)?/.test(item));
  const latestRewardText = rewardHit || dataLines.slice(0, 12).join(" ");
  return {
    opened,
    dialogVisible,
    fieldHeaders,
    hasActivityTitle: bodyText.includes("前端主回归"),
    hasRewardRow,
    hasReadableRewardValue,
    latestRewardText,
    allRewardText: dataLines.join(" "),
    dataLineCount: dataLines.length,
  };
}

function readOptionalJsonFile(filePath, repoRootPath = process.cwd()) {
  const resolved = resolveArtifactPath(repoRootPath, filePath);
  if (!resolved || resolved.includes("<") || resolved.includes(">")) return null;
  try {
    return JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch {
    return null;
  }
}

function extractPopupPrizeTextFromPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  const draw = payload.draw || {};
  const text = draw.popupPrizeText || draw.prizeText || "";
  return String(text || "").trim();
}

async function closeRewardRecordDialog(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1200);
  const stillVisible = await page.getByText("奖励记录").first().isVisible().catch(() => false);
  if (!stillVisible) return true;
  const closeButtons = [
    page.getByRole("button", { name: "关闭" }).first(),
    page.getByRole("button", { name: "Close" }).first(),
    page.getByText("×", { exact: true }).first(),
  ];
  for (const button of closeButtons) {
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1200);
      break;
    }
  }
  return !(await page.getByText("奖励记录").first().isVisible().catch(() => false));
}

async function readPopupPrizeText(page, latestLuckDrawBody) {
  const candidates = [
    latestLuckDrawBody?.data?.prizeName,
    latestLuckDrawBody?.data?.awardName,
    latestLuckDrawBody?.data?.name,
    latestLuckDrawBody?.data?.prize?.name,
    latestLuckDrawBody?.data?.rewardName,
    latestLuckDrawBody?.data?.reward?.name,
  ].filter(Boolean).map(item => String(item).trim()).filter(Boolean);
  if (candidates.length) return candidates[0];
  const popupText = await page.getByText("恭喜你").first().evaluate(node => {
    let current = node;
    for (let hop = 0; hop < 6; hop += 1) {
      const text = String(current?.textContent || "").trim();
      if (text.length >= 10 && text.split("\n").length >= 2) return text;
      current = current?.parentElement;
      if (!current) break;
    }
    return String(node?.parentElement?.textContent || node?.textContent || "").trim();
  }).catch(() => "");
  const compact = String(popupText || "").replace(/\s+/g, " ").trim();
  const congratsIndex = compact.lastIndexOf("恭喜你");
  if (congratsIndex >= 0) {
    let segment = compact.slice(congratsIndex + "恭喜你".length).trim();
    for (const marker of ["你获得了", "获得了", "!", "分享"]) {
      const markerIndex = segment.indexOf(marker);
      if (markerIndex > 0) segment = segment.slice(0, markerIndex).trim();
    }
    segment = segment.replace(/^[：:\-]+/, "").trim();
    if (segment && segment.length <= 120) return segment;
  }
  const lines = compact.split("\n").map(item => item.trim()).filter(Boolean);
  const filtered = lines.filter(item => !["恭喜你", "知道了", "确定"].includes(item));
  const hit = filtered.find(item => item.includes("抽中"))
    || filtered.find(item => /USDT|BTC|ETH|赠金|体验金|积分|资格/.test(item))
    || filtered.find(item => item.length >= 2 && item.length <= 120);
  return String(hit || "").trim();
}


export {
  parseCount,
  resolveArtifactPath,
  waitBeforeClick,
  readVisibleButtons,
  detectGuestState,
  extractCountdownToken,
  normalizeComparableText,
  normalizeCompactText,
  detectHorizontalOverflow,
  detectMainVisual,
  readSubtitleText,
  readRulesText,
  detectFaqSection,
  detectCalendarTab,
  removeLocalePrefixFromUrl,
  deepFindPrizeArrayLength,
  readPrizeCount,
  detectPageError,
  findLikelyActivityTitle,
  readCountdownWidgetText,
  detectDrawButtonVariant,
  measureLivePageSignals,
  hasUsableInitialState,
  extractPageState,
  detectMainButtonState,
  readMainButtonState,
  sampleButtonBusyState,
  stabilizeInitialDrawPageState,
  waitForActivityStart,
  waitForActivityStartWithSession,
  ensureSignup,
  performSingleDraw,
  performFiveDraw,
  closeRewardPopup,
  openRewardRecord,
  readOptionalJsonFile,
  extractPopupPrizeTextFromPayload,
  closeRewardRecordDialog,
  readPopupPrizeText,
};

#!/usr/bin/env node
import { loadFrontendEnv } from "./lib/env.mjs";
import { launchBrowser } from "./lib/browser.mjs";
import { resolveFrontendAccount } from "./lib/account-config.mjs";
import { buildFrontendAuthSession } from "./lib/login-tool-adapter.mjs";
import { openLoginStatePage } from "./business/auth-pages.mjs";
import {
  ensureSignup,
  openRewardRecord,
  parseCount,
  readPopupPrizeText,
  stabilizeInitialDrawPageState,
} from "./lib/lottery-frontend-main-flow-helpers.mjs";

function parseArgs(argv) {
  const args = {
    activityAlias: "",
    accountAlias: "",
    expectedPrizeId: "5",
    expectedPrizeText: "",
    drawTimes: 6,
    visible: false,
    dryRun: false,
    holdMs: 0,
    timeoutMs: 90000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--activity-alias") args.activityAlias = argv[++index] || "";
    else if (item === "--account-alias") args.accountAlias = argv[++index] || "";
    else if (item === "--expected-prize-id") args.expectedPrizeId = argv[++index] || "";
    else if (item === "--expected-prize-text") args.expectedPrizeText = argv[++index] || "";
    else if (item === "--draw-times") args.drawTimes = Number(argv[++index] || args.drawTimes);
    else if (item === "--visible") args.visible = true;
    else if (item === "--dry-run") args.dryRun = true;
    else if (item === "--hold-ms") args.holdMs = Number(argv[++index] || 0);
    else if (item === "--timeout-ms") args.timeoutMs = Number(argv[++index] || args.timeoutMs);
    else if (item === "--help" || item === "-h") args.help = true;
  }
  return args;
}

function usage() {
  return `Usage:
  node skills/weex-frontend-ops/scripts/frontend-draw-weight-special-verify.mjs --activity-alias <alias> --visible

Verifies cumulative re-weighting by drawing N times and asserting the Nth luckDraw response contains the expected prize id.`;
}

function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function deepCollectPrizeIds(value, result = [], seen = new Set()) {
  if (!value || typeof value !== "object") return result;
  if (seen.has(value)) return result;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) deepCollectPrizeIds(item, result, seen);
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/^(id|prizeId|linkPrizeId|activityPrizeId|lotteryPrizeId|awardId|rewardId)$/i.test(key)) {
      if (typeof child === "number" || typeof child === "string") result.push(String(child));
    }
    deepCollectPrizeIds(child, result, seen);
  }
  return result;
}

function compactLuckDraw(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  return {
    code: body?.code || "",
    msg: body?.msg || body?.message || "",
    dataKeys: Object.keys(data).slice(0, 30),
    directPrizeId: data.prizeId ?? data.id ?? data.activityPrizeId ?? data.lotteryPrizeId ?? null,
    prizeName: data.prizeName || data.awardName || data.name || data.rewardName || data?.prize?.name || "",
    collectedPrizeIds: [...new Set(deepCollectPrizeIds(body))].slice(0, 30),
  };
}

async function closePrizePopup(page) {
  const popupVisible = await isPrizePopupVisible(page);
  if (!popupVisible) return false;
  const closed = await page.evaluate(() => {
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };
    const roots = Array.from(document.querySelectorAll("div, section, article"))
      .filter(visible)
      .filter(node => String(node.textContent || "").includes("恭喜你"));
    const root = roots.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    })[0] || document.body;
    const candidates = Array.from(root.querySelectorAll("button, [role='button'], div, span, svg"))
      .filter(visible)
      .map(node => ({ node, text: String(node.textContent || "").trim(), rect: node.getBoundingClientRect() }))
      .filter(item => {
        const compact = item.text.replace(/\s+/g, "");
        const nearTopRight = item.rect.top < window.innerHeight * 0.35 && item.rect.left > window.innerWidth * 0.45;
        return compact === "×" || compact === "X" || compact === "x" || nearTopRight;
      })
      .sort((a, b) => (b.rect.left - a.rect.left) || (a.rect.top - b.rect.top));
    const target = candidates[0];
    if (!target) return false;
    target.node.click();
    return true;
  }).catch(() => false);
  await page.waitForTimeout(1200);
  return closed;
}

async function isPrizePopupVisible(page) {
  return await page.evaluate(() => {
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };
    return Array.from(document.querySelectorAll("div, section, article"))
      .some(node => visible(node) && String(node.textContent || "").includes("恭喜你"));
  }).catch(() => false);
}

async function waitForPrizePopup(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPrizePopupVisible(page)) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function clickSingleDraw(page) {
  const clicked = await page.evaluate(() => {
    const normalized = value => String(value || "").replace(/\s+/g, "").trim();
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width >= 40
        && rect.height >= 20
        && rect.top >= 0
        && rect.left >= 0
        && rect.bottom <= window.innerHeight
        && rect.right <= window.innerWidth
        && style.display !== "none"
        && style.visibility !== "hidden"
        && style.opacity !== "0"
        && style.pointerEvents !== "none";
    };
    const candidates = Array.from(document.querySelectorAll("button, [role='button'], div, span"))
      .filter(visible)
      .map(node => {
        const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
        const compact = normalized(text);
        const rect = node.getBoundingClientRect();
        return {
          node,
          text,
          compact,
          area: rect.width * rect.height,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        };
      })
      .filter(item => item.compact === "抽奖×1" || item.compact === "抽奖x1" || item.compact === "抽奖X1")
      .sort((a, b) => a.area - b.area || a.text.length - b.text.length);
    const target = candidates[0];
    if (!target) return { ok: false, reason: "not_found" };
    const targetAtPoint = document.elementFromPoint(target.centerX, target.centerY);
    if (!(target.node === targetAtPoint || target.node.contains(targetAtPoint))) {
      return { ok: false, reason: "covered", text: target.text };
    }
    target.node.click();
    return { ok: true, text: target.text };
  }).catch(error => ({ ok: false, reason: error.message }));
  if (clicked.ok) return clicked;
  const visibleTexts = await page.evaluate(() => Array.from(document.querySelectorAll("button, [role='button'], div, span"))
    .map(node => {
      const rect = node.getBoundingClientRect();
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      return rect.width > 0 && rect.height > 0 && text.includes("抽奖") ? text.slice(0, 80) : "";
    })
    .filter(Boolean)
    .slice(0, 20)).catch(() => []);
  throw new Error(`single draw x1 control not clickable: ${clicked.reason}; visibleDrawTexts=${JSON.stringify(visibleTexts)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.activityAlias) throw new Error("--activity-alias is required");
  if (!Number.isFinite(args.drawTimes) || args.drawTimes < 1) throw new Error("--draw-times must be >= 1");

  loadFrontendEnv();
  const activityHost = process.env.WEEX_FRONTEND_ACTIVITY_HOST || "https://stg-www.weex.tech";
  const activityUrl = `${activityHost.replace(/\/+$/, "")}/zh-CN/events/draw/${args.activityAlias}`;
  const accountUrl = process.env.WEEX_FRONTEND_ACCOUNT_URL || `${activityHost.replace(/\/+$/, "")}/zh-CN/account`;
  const account = resolveFrontendAccount(args.accountAlias);

  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      activityAlias: args.activityAlias,
      activityUrl,
      drawTimes: args.drawTimes,
      expectedPrizeId: args.expectedPrizeId,
      expectedPrizeText: args.expectedPrizeText,
      account: { alias: account.alias, username: account.username },
    });
    return 0;
  }

  const { browser, context, page, failedResponses } = await launchBrowser({
    visible: args.visible,
    disableWebSecurity: true,
  });
  const network = { applyOk: false, applyStatusTrue: false, luckDraws: [] };
  page.on("response", async response => {
    const url = response.url();
    if (url.includes("/v1/activity/general/apply")) {
      try {
        const body = await response.json();
        if (body?.code === "00000") network.applyOk = true;
        if (body?.data === true) network.applyStatusTrue = true;
      } catch {}
    }
    if (url.includes("/v1/activity/general/raffle/luckDraw")) {
      try {
        network.luckDraws.push({ status: response.status(), url, body: await response.json() });
      } catch {
        network.luckDraws.push({ status: response.status(), url, body: null });
      }
    }
  });

  try {
    const auth = await buildFrontendAuthSession({
      username: account.username,
      password: account.password,
      targetUrl: activityUrl,
      timeoutMs: args.timeoutMs,
    });
    await context.addCookies([auth.cookie]);
    if (!args.visible) await openLoginStatePage(page, accountUrl);
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
    let pageState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    const signup = await ensureSignup(page, activityUrl, network);
    pageState = await stabilizeInitialDrawPageState(page, args.activityAlias);
    const countBefore = Number(pageState.drawCount ?? parseCount(await page.locator("body").innerText().catch(() => "")) ?? 0);
    if (countBefore < args.drawTimes) {
      printJson({
        ok: false,
        error: "draw count is lower than requested draw times",
        activityUrl,
        account: { alias: account.alias, username: account.username, uid: auth.tokens.userId || "" },
        signup,
        countBefore,
        requiredDrawTimes: args.drawTimes,
        failedResponses: failedResponses.slice(0, 20),
      });
      return 1;
    }

    const draws = [];
    for (let index = 1; index <= args.drawTimes; index += 1) {
      const beforeResponseCount = network.luckDraws.length;
      const beforeText = await page.locator("body").innerText().catch(() => "");
      const beforeCount = parseCount(beforeText);
      await clickSingleDraw(page);
      for (let wait = 0; wait < 30 && network.luckDraws.length <= beforeResponseCount; wait += 1) {
        await page.waitForTimeout(500);
      }
      const popupVisible = await waitForPrizePopup(page, 25000);
      const response = network.luckDraws.at(-1) || null;
      const popupPrizeText = popupVisible ? await readPopupPrizeText(page, response?.body) : "";
      const afterText = await page.locator("body").innerText().catch(() => "");
      const afterCount = parseCount(afterText);
      draws.push({
        drawNo: index,
        beforeCount,
        afterCount,
        popupVisible,
        popupPrizeText,
        luckDraw: compactLuckDraw(response?.body),
      });
      await closePrizePopup(page);
      await page.waitForTimeout(1200);
    }

    const targetDraw = draws.at(args.drawTimes - 1);
    const targetPrizeIds = targetDraw?.luckDraw?.collectedPrizeIds || [];
    const expectedPrizeHit = targetPrizeIds.includes(String(args.expectedPrizeId));
    const expectedTextHit = args.expectedPrizeText
      ? String(targetDraw?.popupPrizeText || "").includes(args.expectedPrizeText)
      : false;
    const targetPrizeOk = expectedPrizeHit || expectedTextHit;
    const allApiSuccess = draws.every(item => item.luckDraw.code === "00000");
    const allPopupVisible = draws.every(item => item.popupVisible);
    await page.waitForTimeout(5000);
    const rewardRecord = await openRewardRecord(page);
    const finalState = await stabilizeInitialDrawPageState(page, args.activityAlias);

    printJson({
      ok: Boolean(allApiSuccess && allPopupVisible && targetPrizeOk),
      activityAlias: args.activityAlias,
      activityUrl,
      viewport: "desktop 1440x1000",
      account: { alias: account.alias, username: account.username, uid: auth.tokens.userId || "" },
      signup,
      countBefore,
      countAfter: finalState.drawCount,
      drawTimes: args.drawTimes,
      expectedPrizeId: String(args.expectedPrizeId),
      expectedPrizeText: args.expectedPrizeText || "",
      targetDraw,
      assertions: {
        allApiSuccess,
        allPopupVisible,
        targetDrawContainsExpectedPrizeId: expectedPrizeHit,
        targetDrawContainsExpectedPrizeText: expectedTextHit,
      },
      rewardRecord,
      draws,
      failedResponses: failedResponses.slice(0, 20),
    });
    return allApiSuccess && allPopupVisible && targetPrizeOk ? 0 : 1;
  } finally {
    if (args.visible && args.holdMs > 0) await page.waitForTimeout(args.holdMs).catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().then(code => {
  process.exitCode = code;
}).catch(error => {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
});

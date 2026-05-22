#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathsFrom } from "./lib/runtime.mjs";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { loadFrontendEnv } from "../../weex-frontend-ops/scripts/lib/env.mjs";
import { launchBrowser } from "../../weex-frontend-ops/scripts/lib/browser.mjs";
import { resolveFrontendAccount } from "../../weex-frontend-ops/scripts/lib/account-config.mjs";
import { buildFrontendAuthCookie, loginFrontendWithTokens } from "../../weex-frontend-ops/scripts/lib/login-tool-adapter.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/lottery-frontend-main-flow.mjs --dry-run --activity-alias <alias>
  node skills/weex-admin-ops/scripts/lottery-frontend-main-flow.mjs --activity-alias <alias> --recharge-amount 1000 --visible
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
    rechargeAmount: String(args.rechargeAmount || "1000"),
    waitForStartMs: Number(args.waitForStartMs || 240000),
    timeoutMs: Number(args.timeoutMs || 90000),
  };
}

function parseLastJson(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  const lines = source.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trimStart();
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    const candidate = lines.slice(index).join("\n").trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function runNodeJson(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    exitCode: result.status ?? 1,
    payload: parseLastJson(result.stdout) || parseLastJson(result.stderr),
  };
}

function parseCount(text) {
  const match = String(text || "").match(/(?:可用次数|可抽奖次数|剩余抽奖次数)\s*[：:]?\s*(\d+)/);
  return match ? Number(match[1]) : null;
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

async function extractPageState(page, activityAlias) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const buttons = await readVisibleButtons(page);
  const state = await detectMainButtonState(page);
  return {
    activityAlias,
    url: page.url(),
    urlMatchesAlias: page.url().includes(`/events/draw/${activityAlias}`),
    opened: page.url().includes("/events/draw/"),
    loginFormVisible: await page.getByText("登录").first().isVisible().catch(() => false),
    myPrizeVisible: await page.getByText("我的奖品").first().isVisible().catch(() => false),
    mainButtonState: state,
    drawCount: parseCount(bodyText),
    guestVisible: detectGuestState(bodyText, buttons),
    buttons,
    bodySnippet: bodyText.slice(0, 800),
  };
}

async function detectMainButtonState(page) {
  const candidates = ["即将开始", "立即报名", "抽奖"];
  for (const text of candidates) {
    if (await page.getByText(text, { exact: true }).first().isVisible().catch(() => false)) return text;
  }
  return "";
}

async function waitForActivityStart(page, activityUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await detectMainButtonState(page);
    if (state && state !== "即将开始") return state;
    await page.waitForTimeout(5000);
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  }
  return await detectMainButtonState(page);
}

async function ensureSignup(page, activityUrl, network) {
  const initialState = await detectMainButtonState(page);
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
    await button.click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const finalState = await detectMainButtonState(page);
  await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  const reopenedState = await detectMainButtonState(page);
  return {
    initialState,
    finalState,
    reopenedState,
    done: network.applyOk || network.applyStatusTrue || finalState === "抽奖" || reopenedState === "抽奖",
  };
}

async function performSingleDraw(page) {
  const beforeText = await page.locator("body").innerText().catch(() => "");
  const countBefore = parseCount(beforeText);
  const button = page.locator("button").filter({ hasText: /^抽奖$/ }).first();
  if (!(await button.isVisible().catch(() => false))) {
    return { requestObserved: false, popupVisible: false, countBefore, countAfter: countBefore };
  }
  await button.click({ force: true, timeout: 5000 }).catch(() => {});
  const popupVisible = await page.getByText("恭喜你").first().isVisible({ timeout: 15000 }).catch(() => false);
  await page.waitForTimeout(1000);
  const afterText = await page.locator("body").innerText().catch(() => "");
  const countAfter = parseCount(afterText);
  return {
    requestObserved: popupVisible,
    popupVisible,
    countBefore,
    countAfter,
  };
}

async function openRewardRecord(page) {
  const trigger = page.getByText("我的奖品", { exact: true }).first();
  const opened = await trigger.isVisible().catch(() => false);
  if (opened) await trigger.click({ force: true, timeout: 5000 }).catch(() => {});
  const dialogVisible = await page.getByText("奖励记录").first().isVisible({ timeout: 15000 }).catch(() => false);
  const bodyText = dialogVisible ? await page.locator("body").innerText().catch(() => "") : "";
  const fieldHeaders = ["活动名称", "奖励金额", "获奖时间", "备注"].filter(item => bodyText.includes(item));
  return { opened, dialogVisible, fieldHeaders };
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

  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      account: { alias: account.alias, username: account.username },
      activityAlias: args.activityAlias,
      activityUrl,
      rechargeAmount: args.rechargeAmount,
      waitForStartMs: args.waitForStartMs,
    });
    return 0;
  }

  const auth = await loginFrontendWithTokens({
    username: account.username,
    password: account.password,
    timeoutMs: args.timeoutMs,
  });
  const uid = String(auth.tokens.userId || "");
  const cookie = await buildFrontendAuthCookie({
    username: account.username,
    password: account.password,
    targetUrl: activityUrl,
    timeoutMs: args.timeoutMs,
  });

  const { browser, context, page, failedResponses } = await launchBrowser({ visible: args.visible });
  const network = { applyOk: false, applyStatusTrue: false };
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
  });

  try {
    await context.addCookies([cookie]);
    await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    let pageState = await extractPageState(page, args.activityAlias);
    if (pageState.guestVisible) {
      printJson({
        ok: false,
        error: "frontend draw page still showed guest state after cookie login",
        account: { alias: account.alias, username: account.username, uid },
        page: pageState,
        failedResponses: failedResponses.slice(0, 20),
      });
      return 1;
    }
    if (pageState.mainButtonState === "即将开始") {
      pageState.mainButtonState = await waitForActivityStart(page, activityUrl, args.waitForStartMs);
      pageState = await extractPageState(page, args.activityAlias);
    }

    const signup = await ensureSignup(page, activityUrl, network);
    let refreshedState = await extractPageState(page, args.activityAlias);
    const countBefore = refreshedState.drawCount ?? 0;
    let mqRecharge = { ok: false, uid, amount: args.rechargeAmount, countBefore, countAfter: countBefore };

    if (countBefore < 1) {
      const mqResult = runNodeJson([
        path.join(repoRoot, "skills/weex-fin-admin-ops/scripts/run-cached-action.mjs"),
        "--action",
        "mq_recharge_callback_send",
        "--uid",
        uid,
        "--amount",
        args.rechargeAmount,
        "--confirm-send",
      ]);
      await page.goto(activityUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(5000);
      refreshedState = await extractPageState(page, args.activityAlias);
      mqRecharge = {
        ok: mqResult.exitCode === 0 && mqResult.payload?.ok !== false,
        uid,
        amount: args.rechargeAmount,
        countBefore,
        countAfter: refreshedState.drawCount ?? countBefore,
      };
    } else {
      mqRecharge.ok = true;
    }

    const draw = await performSingleDraw(page);
    await page.waitForTimeout(5000);
    const rewardRecord = await openRewardRecord(page);

    printJson({
      ok: pageState.opened && signup.done && mqRecharge.ok,
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

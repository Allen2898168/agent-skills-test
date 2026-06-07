#!/usr/bin/env node
import { pathsFrom, loadLocalEnv, adminConfig, assertAdminLoginConfig, loadPlaywright } from "./lib/runtime.mjs";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { sleep } from "./lib/browser.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";
import { loadFrontendEnv } from "../../weex-frontend-ops/scripts/lib/env.mjs";
import { resolveFrontendAccount } from "../../weex-frontend-ops/scripts/lib/account-config.mjs";
import { installFrontendGatewayAuth } from "../../weex-frontend-ops/scripts/lib/frontend-gateway-auth.mjs";
import { buildFrontendAuthSession } from "../../weex-frontend-ops/scripts/lib/login-tool-adapter.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--skip-restore"] });
  return {
    ...args,
    visible: Boolean(args.visible),
    skipRestore: Boolean(args.skipRestore),
    activityAlias: String(args.activityAlias || "").trim(),
  };
}

function buildLinkageTexts(alias) {
  const suffix = String(alias || "").replace(/[^a-zA-Z0-9]/g, "").slice(-4) || "0000";
  return {
    title: `联动标题${suffix}`.slice(0, 15),
  };
}

async function resolveLotteryActivityByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`lottery activity not found by alias: ${alias}`);
  return { id: String(id), row };
}

async function fetchActivityDetail(api, activityId) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(activityId)}`);
  const item = detail.body?.data;
  if (detail.body?.code !== 200 || !item) throw new Error(`activity detail failed: ${activityId}`);
  return item;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function patchActivityTitleOnly(detail, expectedTitle) {
  const patched = deepClone(detail);
  const original = {
    rootTitle: String(patched.title || ""),
    rootSubTitle: String(patched.subTitle || ""),
    zhTitle: "",
    zhSubTitle: "",
    zhLang: "",
  };
  patched.title = expectedTitle;
  const i18n = Array.isArray(patched.activityConfigI18n) ? patched.activityConfigI18n : [];
  const zhRecord = i18n.find(item => String(item?.lang || "").toLowerCase() === "zh_cn") || null;
  if (zhRecord) {
    original.zhTitle = String(zhRecord.title || "");
    original.zhSubTitle = String(zhRecord.subTitle || "");
    original.zhLang = String(zhRecord.lang || "");
    zhRecord.title = expectedTitle;
  }
  return { patched, original, i18nUpdated: Boolean(zhRecord) };
}

function restoreActivityTitleAndSubtitle(detail, original) {
  const restored = deepClone(detail);
  restored.title = String(original?.rootTitle || "");
  restored.subTitle = String(original?.rootSubTitle || "");
  const i18n = Array.isArray(restored.activityConfigI18n) ? restored.activityConfigI18n : [];
  const zhRecord = i18n.find(item => String(item?.lang || "").toLowerCase() === "zh_cn") || null;
  if (zhRecord) {
    zhRecord.title = String(original?.zhTitle || "");
    zhRecord.subTitle = String(original?.zhSubTitle || "");
  }
  return restored;
}

async function updateActivityDetail(api, activityDetail) {
  const result = await api.put("/prod-api/activity/config", activityDetail);
  return {
    httpStatus: result.status,
    code: result.body?.code ?? null,
    msg: String(result.body?.msg || ""),
  };
}

async function verifyFrontend(browser, alias, expectedTitle) {
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
  try {
    await context.addCookies([auth.cookie]);
    await installFrontendGatewayAuth(context, auth.tokens.accessToken, { referer: activityUrl });
    const cacheBusted = (url, stamp) => {
      const base = String(url || "");
      const joiner = base.includes("?") ? "&" : "?";
      return `${base}${joiner}__cacheBust=${encodeURIComponent(String(stamp))}`;
    };
    await page.goto(cacheBusted(activityUrl, Date.now()), { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await sleep(3500);
    let result = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt) {
        await page.goto(cacheBusted(activityUrl, `${Date.now()}_${attempt}`), { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
        await sleep(3500);
      }
      result = await page.evaluate(({ expectedTitle: title }) => {
        const bodyText = document.body?.innerText || "";
        const nodes = Array.from(document.querySelectorAll("body *"));
        const titleNode = nodes.find(node => {
          if (!(node instanceof HTMLElement)) return false;
          return node.offsetParent !== null && (node.innerText || "").includes(title);
        });
        return {
          url: location.href,
          titleMatched: bodyText.includes(title),
          titleVisible: Boolean(titleNode),
          titleInPageData: Boolean(document.getElementById("__NEXT_DATA__")?.textContent?.includes(title)),
        };
      }, { expectedTitle }).catch(() => null);
      if (result?.titleMatched) break;
    }
    return result || {
      url: page.url(),
      titleMatched: false,
      titleVisible: false,
      titleInPageData: false,
    };
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

  const { chromium } = await loadPlaywright();
  const api = await createAdminApiSession({ chromium, config });
  const browser = await chromium.launch({ headless: !args.visible, executablePath: config.chromePath, args: ["--window-size=1440,1000"] });
  try {
    const target = await resolveLotteryActivityByAlias(api, args.activityAlias);
    const beforeDetail = await fetchActivityDetail(api, target.id);
    const patched = patchActivityTitleOnly(beforeDetail, expected.title);
    const adminUpdate = await updateActivityDetail(api, patched.patched);
    const afterDetail = await fetchActivityDetail(api, target.id);

    await sleep(3500);
    const frontendVerify = await verifyFrontend(browser, args.activityAlias, expected.title);

    let restore = { skipped: true };
    if (!args.skipRestore) {
      const restored = restoreActivityTitleAndSubtitle(afterDetail, patched.original);
      const restoreResult = await updateActivityDetail(api, restored);
      restore = { skipped: false, ...restoreResult };
    }

    const errorParts = [];
    if (adminUpdate.code !== 200) errorParts.push(`admin save failed: code=${adminUpdate.code || "unknown"} msg=${adminUpdate.msg || ""}`.trim());
    if (!frontendVerify.titleMatched) errorParts.push("frontend title not visible");

    const linkageOk = adminUpdate.code === 200 && frontendVerify.titleMatched;
    const restoreOk = restore.skipped ? true : restore.code === 200;
    printJson({
      ok: linkageOk && restoreOk,
      error: errorParts.join("; "),
      linkage: {
        activityId: target.id,
        activityAlias: args.activityAlias,
        expectedTitle: expected.title,
        i18nUpdated: patched.i18nUpdated,
        titleMatched: frontendVerify.titleMatched,
        titleVisible: frontendVerify.titleVisible,
        frontendUrl: frontendVerify.url,
      },
      adminUpdate: {
        mode: api.mode || "unknown",
        ...adminUpdate,
      },
      adminRestore: restore,
    });
    return linkageOk && restoreOk ? 0 : 1;
  } finally {
    await api.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

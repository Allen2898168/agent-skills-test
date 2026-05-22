#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { bodyText } from "./lib/browser.mjs";
import { clickRowActionByText, fillLabel } from "./lib/element-ui.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import {
  apiLotteryDetail,
  apiLotteryListByAlias,
  apiLotteryRecentList,
  deleteLotteryDraftByAlias,
  fillVerificationAndConfirm,
  findLotteryRow,
  openLotteryList,
  searchLotteryList,
  submitCopiedLotteryForm,
  visibleLotteryRowActions,
} from "./lib/lottery-activity-list.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/lottery-activity-list-online-checks.mjs --activity-alias <alias>
  node scripts/lottery-activity-list-online-checks.mjs --activity-id <id>
  node scripts/lottery-activity-list-online-checks.mjs --activity-alias <alias> --visible
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  if (!args.activityAlias && !args.activityId && !args.help) {
    throw new Error("Provide --activity-alias or --activity-id");
  }
  return args;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminConfig(config);
  const target = {
    activityAlias: args.activityAlias ? String(args.activityAlias) : "",
    activityId: args.activityId ? String(args.activityId) : "",
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, target, mode: args.visible ? "visible_browser" : "invisible_browser" });
    return 0;
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];
  let authHeader = "";
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
    const initialSearch = await searchLotteryList(page, target.activityAlias
      ? { alias: target.activityAlias }
      : { activityId: target.activityId });
    const initialRow = findLotteryRow(initialSearch.rows, row => row.join("\n").includes(target.activityAlias || target.activityId));
    if (!initialRow) throw new Error(`Online activity row not found: ${target.activityAlias || target.activityId}`);

    const activityId = String(target.activityId || initialRow[0] || "");
    const detail = await apiLotteryDetail(page, authHeader, activityId);
    const activity = detail?.data || {};
    const activityAlias = String(target.activityAlias || activity.showUrl || activity.activityUrl || "");
    if (!activityAlias) throw new Error(`Unable to resolve online activity alias for id=${activityId}`);

    await searchLotteryList(page, { alias: activityAlias });
    const rowActions = await visibleLotteryRowActions(page, activityAlias);
    const expectedOnlineActions = ["查看", "修改", "下线", "复制"];
    const rowActionsOk = expectedOnlineActions.every(action => rowActions.includes(action)) && !rowActions.includes("删除");

    const copyStamp = timestamp().slice(8, 14);
    const copiedAlias = `list-copy-${timestamp()}`;
    const copiedTitle = `回归复制${copyStamp}`;
    const before = await apiLotteryRecentList(page, authHeader);
    const beforeIds = new Set((before?.rows || []).map(row => String(row.id)));

    const copyResponsePromise = page.waitForResponse(
      response => /\/prod-api\/activity\/(config|lottery)/.test(response.url())
        && response.request().method() === "POST"
        && response.url().includes("copy"),
      { timeout: 15000 },
    ).catch(() => null);
    await clickRowActionByText(page, activityAlias, "复制");
    const directCopyResponse = await copyResponsePromise;
    let directCopyBody = null;
    try { directCopyBody = await directCopyResponse?.json(); } catch {}
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    let submit = null;
    if (/\/activities\/lottery\/(add|copy)/.test(page.url()) || (await page.locator("text=活动别名配置").first().isVisible().catch(() => false))) {
      submit = await submitCopiedLotteryForm(page, { title: copiedTitle, alias: copiedAlias });
    }

    let copied = null;
    if (copiedAlias) {
      const copiedSearch = await apiLotteryListByAlias(page, authHeader, copiedAlias);
      copied = copiedSearch?.rows?.[0] || copiedSearch?.data?.[0] || null;
    }
    if (!copied) {
      const after = await apiLotteryRecentList(page, authHeader);
      copied = (after?.rows || [])
        .filter(row => !beforeIds.has(String(row.id)) && String(row.id) !== activityId)
        .sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
    }
    if (!copied) throw new Error(`Online activity copy did not create a draft row: ${JSON.stringify({ submit, directCopyBody })}`);

    const copiedAliasResolved = String(copied.showUrl || copied.activityUrl || copied.alias || copiedAlias);
    const copiedId = String(copied.id || copied.activityId || "");
    const deleteResult = await deleteLotteryDraftByAlias(page, config, copiedAliasResolved, config.googleCode);
    const ok = rowActionsOk && Boolean(copiedId) && (submit?.code === 200 || directCopyBody?.code === 200 || copiedId) && deleteResult.code === 200 && deleteResult.rowAbsentAfterSearch;

    printJson({
      ok,
      activityId,
      alias: activityAlias,
      status: activity.status || "",
      onlineRowActions: {
        ok: rowActionsOk,
        actions: rowActions,
      },
      copyCheck: {
        copiedId,
        copiedAlias: copiedAliasResolved,
        submit,
        directCopy: {
          httpStatus: directCopyResponse?.status?.() || null,
          code: directCopyBody?.code || null,
          msg: directCopyBody?.msg || "",
        },
      },
      deleteCopiedDraft: deleteResult,
      responses,
      finalUrl: page.url(),
    });
    return ok ? 0 : 1;
  } catch (error) {
    printJson({
      ok: false,
      error: error.message,
      finalUrl: page.url(),
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

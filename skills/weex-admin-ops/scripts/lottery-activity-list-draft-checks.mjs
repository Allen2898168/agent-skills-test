#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import {
  apiLotteryDetail,
  findLotteryRow,
  openLotteryList,
  searchLotteryList,
  visibleLotteryRowActions,
} from "./lib/lottery-activity-list.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/lottery-activity-list-draft-checks.mjs --activity-alias <alias>
  node scripts/lottery-activity-list-draft-checks.mjs --activity-id <id>
  node scripts/lottery-activity-list-draft-checks.mjs --activity-alias <alias> --visible
  node scripts/lottery-activity-list-draft-checks.mjs --activity-alias <alias> --dry-run
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
  const page = await browser.newContext({ viewport: { width: 1440, height: 1000 } }).then(context => context.newPage());
  const responses = [];
  let authHeader = "";
  page.on("request", request => {
    if (request.url().includes("/prod-api/activity/config/list")) {
      authHeader = request.headers().authorization || authHeader;
    }
  });
  page.on("response", async response => {
    if (!response.url().includes("/prod-api/activity/config/list")) return;
    const entry = {
      url: response.url().replace(/^https?:\/\/[^/]+/, ""),
      method: response.request().method(),
      status: response.status(),
    };
    try {
      const body = await response.json();
      entry.body = { code: body?.code, total: body?.total };
    } catch {}
    responses.push(entry);
  });

  try {
    await openLotteryList(page, config);
    const initialSearch = await searchLotteryList(page, target.activityAlias
      ? { alias: target.activityAlias }
      : { activityId: target.activityId });
    const initialRow = findLotteryRow(initialSearch.rows, row => row.join("\n").includes(target.activityAlias || target.activityId));
    if (!initialRow) throw new Error(`Draft activity row not found: ${target.activityAlias || target.activityId}`);

    const inferredId = target.activityId || initialRow[0] || "";
    const detail = await apiLotteryDetail(page, authHeader, inferredId);
    const activity = detail?.data || {};
    const activityId = String(inferredId || activity.id || "");
    const activityAlias = String(target.activityAlias || activity.showUrl || activity.activityUrl || "");
    const activityTitle = String(activity.title || initialRow.find(cell => cell.includes(activityAlias)) || "");
    const activityStart = String(activity.startTime || activity.activityStartTime || "");
    const activityEnd = String(activity.endTime || activity.activityEndTime || "");

    if (!activityId || !activityAlias || !activityTitle || !activityStart || !activityEnd) {
      throw new Error(`Missing draft activity detail fields: ${JSON.stringify({ activityId, activityAlias, activityTitle, activityStart, activityEnd })}`);
    }

    const searchChecks = {
      byId: await safeCheck(async () => {
        const result = await searchLotteryList(page, { activityId });
        const row = findLotteryRow(result.rows, record => record[0] === activityId);
        return { ok: Boolean(row), activityId };
      }),
      byTitle: await safeCheck(async () => {
        const result = await searchLotteryList(page, { title: activityTitle });
        const row = findLotteryRow(result.rows, record => record.join("\n").includes(activityTitle) && record[0] === activityId);
        return { ok: Boolean(row), title: activityTitle, activityId };
      }),
      byAlias: await safeCheck(async () => {
        const result = await searchLotteryList(page, { alias: activityAlias });
        const row = findLotteryRow(result.rows, record => record.join("\n").includes(activityAlias) && record[0] === activityId);
        return { ok: Boolean(row), alias: activityAlias, activityId };
      }),
      byType: await safeCheck(async () => {
        const result = await searchLotteryList(page, { type: "转盘抽奖" });
        const row = findLotteryRow(result.rows, record => record[0] === activityId);
        return { ok: Boolean(row), type: "转盘抽奖", activityId };
      }),
      byDate: await safeCheck(async () => {
        const result = await searchLotteryList(page, { start: activityStart, end: activityEnd });
        const row = findLotteryRow(result.rows, record => record[0] === activityId);
        return { ok: Boolean(row), start: activityStart, end: activityEnd, activityId };
      }),
    };

    const draftRowActions = await safeCheck(async () => {
      await searchLotteryList(page, { alias: activityAlias });
      const actions = await visibleLotteryRowActions(page, activityAlias);
      const expectedDraftActions = ["查看", "修改", "上线", "删除", "复制"];
      return {
        ok: expectedDraftActions.every(action => actions.includes(action)) && !actions.includes("下线"),
        actions,
      };
    });

    const allPassed = Object.values(searchChecks).every(item => item.ok) && draftRowActions.ok;
    printJson({
      ok: true,
      allPassed,
      activityId,
      alias: activityAlias,
      title: activityTitle,
      status: activity.status || "",
      searchChecks,
      draftRowActions,
      responses,
      finalUrl: page.url(),
    });
    return 0;
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
    await page.context().close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function safeCheck(fn) {
  try {
    return await fn();
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

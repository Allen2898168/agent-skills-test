#!/usr/bin/env node
import { printJson } from "./lib/cli.mjs";
import { bodyText, loginToPrizePage, watchPrizeResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createPrizes } from "./business/prize-management/create.mjs";
import { runPrizeSearchChecks } from "./business/prize-management/search.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-regression-prizes.mjs
  node scripts/create-regression-prizes.mjs --visible

Purpose:
  Create the four stable regression prizes in one browser session:
  赠金 / 币种 BTC / 实物 / 虚拟积分或资格-抽奖次数.
`;
}

function parseArgs() {
  const visible = process.argv.includes("--visible");
  const dryRun = process.argv.includes("--dry-run");
  const help = process.argv.includes("--help") || process.argv.includes("-h");
  return { visible, dryRun, help };
}

function buildPlan() {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return [
    {
      category: "赠金",
      subtype: "赠金",
      name: `自动化测试 - 赠金_${ts}`,
      alias: `auto_bonus_${ts}`,
      enName: `Auto bonus ${ts}`,
      unit: "1",
      precision: "2",
      receiveDays: "1",
      issueDays: "1",
      discountRatio: "1",
    },
    {
      category: "币种",
      subtype: "BTC",
      name: `自动化测试 - 币对 BTC_${ts}`,
      alias: `auto_btc_${ts}`,
      enName: `Auto BTC ${ts}`,
      unit: "1",
      precision: "2",
      validDays: "1",
    },
    {
      category: "实物",
      subtype: "实物",
      name: `自动化测试 - 实物_${ts}`,
      alias: `auto_physical_${ts}`,
      enName: `Auto physical ${ts}`,
      unit: "1",
      precision: "2",
      validDays: "1",
    },
    {
      category: "虚拟积分或资格",
      subtype: "抽奖次数",
      name: `自动化测试 - 抽奖次数_${ts}`,
      alias: `auto_draw_count_${ts}`,
      enName: `Auto draw count ${ts}`,
      unit: "1",
      precision: "2",
      validDays: "1",
      color: "红色",
    },
  ];
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPlan();
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, visible: args.visible, plan });
    return 0;
  }
  assertAdminConfig(config);
  const { chromium } = loadPlaywright();
  const responses = [];
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  watchPrizeResponses(page, responses);
  try {
    await loginToPrizePage(page, config);
    const created = await createPrizes(page, config, plan);
    const searchChecks = await runPrizeSearchChecks(page, config, created);
    printJson({
      ok: true,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      created,
      searchChecks,
      evidence: { responses },
    });
    return 0;
  } catch (error) {
    printJson({
      ok: false,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      error: error.message,
      created: [],
      responses,
      pageText: (await bodyText(page)).slice(0, 1000),
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

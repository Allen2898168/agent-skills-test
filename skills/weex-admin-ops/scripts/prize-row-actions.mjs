#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToPrizePage, watchPrizeResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildPrizePlan } from "./business/prize-management/plan.mjs";
import { verifyPrizeRowActions } from "./business/prize-management/row-actions.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/prize-row-actions.mjs --dry-run
  node scripts/prize-row-actions.mjs --visible

Purpose:
  Create a temporary prize, verify row actions 查看/修改/复制/删除, and delete the temporary records.

Options:
  --category <text>         default: 赠金
  --subtype <text>          default: 赠金
  --name-prefix <text>      default: 操作列临时奖品
  --alias-prefix <text>     default: prize_row_action_temp
  --count <n>               default: 1
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned temporary prize without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.category = args.category || "赠金";
  args.subtype = args.subtype || "赠金";
  args.count = Number(args.count || 1);
  args.namePrefix = args.namePrefix || "操作列临时奖品";
  args.aliasPrefix = args.aliasPrefix || "prize_row_action_temp";
  return args;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPrizePlan(args);
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
    const verification = await verifyPrizeRowActions(page, config, plan);
    printJson({ ok: true, mode: args.visible ? "visible_browser" : "invisible_browser", finalUrl: page.url(), ...verification, evidence: { responses } });
    return 0;
  } catch (error) {
    printJson({
      ok: false,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      error: error.message,
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

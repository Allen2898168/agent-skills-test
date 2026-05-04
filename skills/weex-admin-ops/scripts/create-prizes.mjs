#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToPrizePage, watchPrizeResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildPrizePlan } from "./business/prize-management/plan.mjs";
import { createPrizes } from "./business/prize-management/create.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/create-prizes.mjs --category 币种 --subtype ETH --count 3 --name-prefix ETH币种奖励 --alias-prefix eth_coin
  node skills/weex-admin-ops/scripts/create-prizes.mjs --plan /path/to/prizes.json --visible

Required environment:
  WEEX_ADMIN_PASSWORD       staging password
  WEEX_ADMIN_GOOGLE_CODE    Google Authenticator code

Optional environment:
  WEEX_ADMIN_USERNAME       default: auto
  WEEX_ADMIN_BASE_URL       default: https://stg-activity.weex.tech
  WEEX_PRIZE_IMAGE_PATH     default: assets/default-prize-images/default-bonus-prize.webp
  CHROME_EXECUTABLE_PATH    default: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome

Options:
  --category <text>         奖品分类, e.g. 币种, 赠金, 实物, 虚拟积分或资格
  --subtype <text>          奖品子类型, e.g. ETH, 赠金, 实物, 积分
  --count <n>               number of rewards to create, default: 1
  --name-prefix <text>      prize name prefix
  --alias-prefix <text>     prize alias prefix
  --plan <file>             JSON array of reward specs; overrides category/subtype/count
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned rewards without opening browser
  --help                    show this message
`;
}

function parseCreatePrizeArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.count = Number(args.count || 1);
  if (!Number.isInteger(args.count) || args.count < 1) throw new Error("--count must be a positive integer");
  return args;
}

async function run() {
  const args = parseCreatePrizeArgs();
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
  const created = [];
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
    created.push(...await createPrizes(page, config, plan));
    printJson({ ok: true, mode: args.visible ? "visible_browser" : "invisible_browser", finalUrl: page.url(), created, evidence: { responses } });
    return 0;
  } catch (error) {
    printJson({
      ok: false,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      error: error.message,
      created,
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

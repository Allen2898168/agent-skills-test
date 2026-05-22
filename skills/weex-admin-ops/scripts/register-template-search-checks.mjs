#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToRegisterPage, watchRegisterResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { runRegisterTemplateSearchChecks } from "./business/activity-register-management/search.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/register-template-search-checks.mjs --name-prefix 自动化报名模板
  node scripts/register-template-search-checks.mjs --visible

Purpose:
  Verify registration template search by 用户管理模板名称 and 用户报名模板id.

Options:
  --name-prefix <text>      default: 自动化报名模板
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned search target rule without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.namePrefix = args.namePrefix || "自动化报名模板";
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
  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      visible: args.visible,
      namePrefix: args.namePrefix,
    });
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
  watchRegisterResponses(page, responses);
  try {
    await loginToRegisterPage(page, config);
    const result = await runRegisterTemplateSearchChecks(page, config, { namePrefix: args.namePrefix });
    printJson({
      ok: true,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      ...result,
      responses,
    });
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

#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToRegisterPage, watchRegisterResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildRegisterTemplatePlan } from "./business/activity-register-management/plan.mjs";
import { verifyRegisterTemplateRowActions } from "./business/activity-register-management/row-actions.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/register-template-row-actions.mjs --dry-run
  node scripts/register-template-row-actions.mjs --visible

Purpose:
  Create a temporary registration template, verify row actions 查看/修改/删除, and delete the temporary row.

Options:
  --name-prefix <text>      default: 操作列临时模板
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned temporary template without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.signupModes = "auto";
  args.platformScopes = "all";
  args.restrictScopes = "none";
  args.namePrefix = args.namePrefix || "操作列临时模板";
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
  const plan = buildRegisterTemplatePlan(args);
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
  watchRegisterResponses(page, responses);
  try {
    await loginToRegisterPage(page, config);
    const verification = await verifyRegisterTemplateRowActions(page, config, plan);
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

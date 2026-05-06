#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToGuidePage, watchGuideResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildGuideTemplatePlan } from "./business/activity-common-module/guide-template-plan.mjs";
import { verifyGuideTemplateRowActions } from "./business/activity-common-module/guide-template-row-actions.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/guide-template-row-actions.mjs --dry-run
  node scripts/guide-template-row-actions.mjs
  node scripts/guide-template-row-actions.mjs --visible

Purpose:
  Create a temporary activity guide template, verify row actions 查看/修改/复制/删除, and delete the temporary records.

Options:
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned temporary template without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.modeLabel = args.modeLabel || (args.visible ? "操作列浏览器" : "操作列无浏览器");
  args.activityTypes = args.activityTypes || "lottery";
  args.frequencies = args.frequencies || "every_visit";
  args.steps = args.steps || "1";
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
  const plan = buildGuideTemplatePlan(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, visible: args.visible, plan });
    return 0;
  }
  assertAdminLoginConfig(config);
  const { chromium } = loadPlaywright();
  const responses = [];
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  watchGuideResponses(page, responses);
  try {
    await loginToGuidePage(page, config);
    const verification = await verifyGuideTemplateRowActions(page, config, plan, { visible: args.visible });
    printJson({
      ok: true,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      ...verification,
      evidence: { responses },
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

#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToPrizePage } from "./lib/browser.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import {
  buildGuideTemplatePlan,
  guideActivityTypeCatalog,
  guideFrequencyCatalog,
} from "./business/activity-common-module/guide-template-plan.mjs";
import { createGuideTemplates, createGuideTemplatesWithUi } from "./business/activity-common-module/guide-template-create.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-guide-templates.mjs --dry-run
  node scripts/create-guide-templates.mjs
  node scripts/create-guide-templates.mjs --visible

Required environment for non-dry-run:
  WEEX_ADMIN_PASSWORD       staging password
  WEEX_ADMIN_GOOGLE_CODE    Google Authenticator code

Options:
  --mode-label <text>       naming prefix; default 无浏览器 or 浏览器
  --activity-types <csv>    keys, labels, or backend values; e.g. lottery or 转盘抽奖
  --frequencies <csv>       keys, labels, or backend values; default every_visit
  --steps <csv>             step counts from 1 to 3; default 1
  --include-none            include 暂无特殊配置/NONE, a known blocked branch
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned templates without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run", "--include-none"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.includeNone = Boolean(args.includeNone);
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
    printJson({
      ok: true,
      dryRun: true,
      visible: args.visible,
      activityTypes: guideActivityTypeCatalog(),
      frequencies: guideFrequencyCatalog(),
      plan,
    });
    return 0;
  }
  assertAdminLoginConfig(config);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    await loginToPrizePage(page, config);
    const created = args.visible
      ? await createGuideTemplatesWithUi(page, config, plan)
      : await createGuideTemplates(page, config, plan);
    const failed = created.filter(item => !item.ok);
    printJson({
      ok: failed.length === 0,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      created: created.filter(item => item.ok).map(item => ({
        id: item.verification.rows[0]?.id,
        name: item.name,
        activityType: item.activityType,
        displayFrequency: item.displayFrequency,
        steps: item.steps,
        writePath: item.writePath,
        uploadCount: item.uploadCount,
        uploadFailures: item.uploadFailures,
      })),
      failed,
    });
    return failed.length ? 1 : 0;
  } catch (error) {
    printJson({
      ok: false,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      error: error.message,
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

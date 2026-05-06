#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToRegisterPage } from "./lib/browser.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { deleteRegisterTemplatesByOperator } from "./business/activity-register-management/bulk-delete.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/delete-register-templates-by-operator.mjs --operator auto --dry-run
  node scripts/delete-register-templates-by-operator.mjs --operator auto --confirm-delete

Purpose:
  Delete activity registration templates whose exact recent editor/operator matches the provided operator.

Safety:
  The backend search is fuzzy. This script only deletes rows where response field operator equals --operator.
  Deletion requires --confirm-delete. Use --dry-run first.

Options:
  --operator <name>        default: auto
  --page-size <n>          default: 200
  --confirm-delete         required for actual deletion
  --visible                open a headed browser so the tester can watch
  --dry-run                list exact candidates without deleting
  --help                   show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run", "--confirm-delete"] });
  args.operator = args.operator || "auto";
  args.pageSize = args.pageSize || "200";
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.confirmDelete = Boolean(args.confirmDelete);
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
    await loginToRegisterPage(page, config);
    const result = await deleteRegisterTemplatesByOperator(page, config, args);
    printJson({ ok: !result.failed?.length, mode: args.visible ? "visible_browser" : "invisible_browser", finalUrl: page.url(), ...result });
    return result.failed?.length ? 1 : 0;
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

#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToPrizePage, watchPrizeResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { copyPrizeById } from "./business/prize-management/copy.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/copy-prize.mjs --prize-id 462
  node scripts/copy-prize.mjs --prize-id 462 --visible

Required environment:
  WEEX_ADMIN_PASSWORD       staging password
  WEEX_ADMIN_GOOGLE_CODE    Google Authenticator code

Options:
  --prize-id <id>           Prize ID to copy
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned action without opening browser
  --help                    show this message
`;
}

function parseCopyArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  if (!args.prizeId) throw new Error("--prize-id is required");
  if (!/^\d+$/.test(String(args.prizeId))) throw new Error("--prize-id must be numeric");
  return args;
}

async function run() {
  const args = parseCopyArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, visible: args.visible, action: "copy_prize_by_id", prizeId: args.prizeId });
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
    const result = await copyPrizeById(page, config, args.prizeId);
    printJson({ ok: true, mode: args.visible ? "visible_browser" : "invisible_browser", finalUrl: page.url(), ...result, evidence: { responses } });
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

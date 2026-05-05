#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToTaskPage, watchTaskResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { buildRouletteParticipantPlan, participantScopeCatalog } from "./business/activity-task-management/roulette-participant-plan.mjs";
import { createRouletteParticipantTasks } from "./business/activity-task-management/roulette-participant-create.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks.mjs --scopes all,vip,newuser,nocharge,olduser,agent,user,country --uid 9881271952 --country 中国
  node skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks.mjs --scopes country --country-first --visible

Required environment:
  WEEX_ADMIN_PASSWORD       staging password
  WEEX_ADMIN_GOOGLE_CODE    Google Authenticator code

Options:
  --scopes <csv>            all,vip,newuser,nocharge,olduser,agent,user,country; default all supported scopes
  --uid <uid>               required for agent/user scopes
  --country <text>          country/region for country scope
  --country-first           choose the first available country/region option
  --vip-whitelist <text>    default: 同等级允许
  --name-prefix <text>      default: 转盘抽奖_scope
  --reward-min <n>          default: 10
  --reward-max <n>          default: blank
  --daily-limit <n>         default: 5
  --total-limit <n>         default: 50
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned tasks without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--visible", "--dry-run", "--country-first"],
  });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.countryFirst = Boolean(args.countryFirst);
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
  const plan = buildRouletteParticipantPlan(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, visible: args.visible, scopes: participantScopeCatalog(), plan });
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
  watchTaskResponses(page, responses);
  try {
    await loginToTaskPage(page, config);
    created.push(...await createRouletteParticipantTasks(page, config, plan));
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

#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { bodyText, loginToRegisterPage, watchRegisterResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import {
  buildRegisterTemplatePlan,
  registerPermissionCatalog,
  registerPlatformScopeCatalog,
  registerRestrictScopeCatalog,
  registerSignupModeCatalog,
} from "./business/activity-register-management/plan.mjs";
import { createRegisterTemplates } from "./business/activity-register-management/create.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/create-register-templates.mjs --signup-modes auto,manual,team,auto_manual
  node skills/weex-admin-ops/scripts/create-register-templates.mjs --signup-modes team --min-team 2 --visible

Required environment:
  WEEX_ADMIN_PASSWORD       staging password
  WEEX_ADMIN_GOOGLE_CODE    Google Authenticator code

Options:
  --signup-modes <csv>      auto,manual,team,auto_manual; default all
  --platform-scope <key>    all,agent_user; default all
  --platform-scopes <csv>   platform scope keys, or extended for non-all/agent_user scopes
  --restrict-scopes <csv>   none,agent_direct,agent_tree,kyc,vip,risk,balance,gray_market,non_kyc,unbound_phone
  --uid <uid>               default for agent/user branches: 9881271952
  --channel-code <text>     default auto_channel_<timestamp>
  --invite-code <text>      default auto_invite_<timestamp>
  --name-prefix <text>      default: 自动化报名模板
  --agent-role-detail <key> none,all; default all for agent_user
  --contract-balance <n>    default for 合约账户余额: 0
  --vip-whitelist-mode <x>  default: 同等级限制
  --min-team <n>            default for team mode: 2
  --permissions <csv>       signup,view; default none
  --people-limit <n>        optional 报名人数限制
  --register-start <time>   enable 可参与注册时间范围; format yyyy-MM-dd HH:mm:ss
  --register-end <time>     end time for 可参与注册时间范围; format yyyy-MM-dd HH:mm:ss
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned templates without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
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
    printJson({
      ok: true,
      dryRun: true,
      visible: args.visible,
      signupModes: registerSignupModeCatalog(),
      platformScopes: registerPlatformScopeCatalog(),
      restrictScopes: registerRestrictScopeCatalog(),
      permissions: registerPermissionCatalog(),
      plan,
    });
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
  watchRegisterResponses(page, responses);
  try {
    await loginToRegisterPage(page, config);
    created.push(...await createRegisterTemplates(page, config, plan));
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

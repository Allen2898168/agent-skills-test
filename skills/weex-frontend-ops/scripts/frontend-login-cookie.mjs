#!/usr/bin/env node
import path from 'node:path';
import { resolveFrontendAccount } from './lib/account-config.mjs';
import { boolEnv, loadFrontendEnv, repoRoot } from './lib/env.mjs';
import { buildFrontendAuthCookie } from './lib/login-tool-adapter.mjs';

function parseArgs(argv) {
  const args = { dryRun: false, visible: null, screenshot: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--visible') args.visible = true;
    else if (value === '--screenshot') args.screenshot = true;
    else if (value === '--account') args.account = argv[++index] || '';
    else if (value === '--target-url') args.targetUrl = argv[++index] || '';
    else if (value === '--screenshot-path') args.screenshotPath = argv[++index] || '';
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/frontend-login-cookie.mjs [--dry-run] [--visible] [--screenshot]
       node scripts/frontend-login-cookie.mjs --account DEFAULT --target-url https://stg-www.weex.tech/zh-CN/login

Reads runtime config from skills/weex-frontend-ops/.env.local or WEEX_FRONTEND_* environment variables.`);
}

loadFrontendEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const targetUrl = args.targetUrl || process.env.WEEX_FRONTEND_URL || 'https://stg-www.weex.tech/zh-CN/login';
const visible = args.visible ?? boolEnv('WEEX_FRONTEND_BROWSER_VISIBLE', false);
const saveScreenshot = args.screenshot || boolEnv('WEEX_FRONTEND_SAVE_SCREENSHOT', false);
const screenshot = path.resolve(
  repoRoot(),
  args.screenshotPath || process.env.WEEX_FRONTEND_SCREENSHOT || 'skills/weex-frontend-ops/artifacts/screenshots/认证/登录/stg-frontend-login-success.png'
);

if (args.dryRun) {
  let account = null;
  let missingConfig = null;
  try {
    account = resolveFrontendAccount(args.account);
  } catch (error) {
    missingConfig = error.message;
  }
  console.log(JSON.stringify({
    ok: !missingConfig,
    dryRun: true,
    operation: 'frontend_login_cookie',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    targetUrl,
    account: account ? {
      alias: account.alias,
      username: account.username,
      passwordSource: account.passwordSource,
      accountCount: account.accountCount
    } : null,
    missingConfig,
    visible,
    saveScreenshot,
    screenshot: saveScreenshot ? screenshot : null,
    assertions: [
      'WEEX_TOKEN_COOKIE_STAGING cookie is present',
      'login form text is absent',
      'account overview or account security text is visible'
    ]
  }, null, 2));
  process.exit(0);
}

const account = resolveFrontendAccount(args.account);
const cookie = await buildFrontendAuthCookie({
  username: account.username,
  password: account.password,
  targetUrl
});

const [{ captureAuthEvidence, openLoginStatePage }, { launchBrowser }] = await Promise.all([
  import('./business/auth-pages.mjs'),
  import('./lib/browser.mjs')
]);
const { browser, context, page, failedResponses } = await launchBrowser({
  visible,
  disableWebSecurity: true
});

try {
  await context.addCookies([cookie]);
  await openLoginStatePage(page, targetUrl);
  const evidence = await captureAuthEvidence(page, screenshot, failedResponses, { saveScreenshot });
  const passed = evidence.tokenCookiePresent
    && evidence.assertions.loginFormAbsent
    && (evidence.assertions.accountOverviewVisible || evidence.assertions.accountSecurityVisible || evidence.url.includes('/account'));
  console.log(JSON.stringify({
    ok: passed,
    operation: 'frontend_login_cookie',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    account: {
      alias: account.alias,
      username: account.username,
      passwordSource: account.passwordSource
    },
    evidence
  }, null, 2));
  if (!passed) process.exit(1);
} finally {
  await browser.close();
}

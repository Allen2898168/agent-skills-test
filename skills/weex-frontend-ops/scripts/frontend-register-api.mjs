#!/usr/bin/env node
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { accountUrlFor, captureAuthEvidence } from './business/auth-pages.mjs';
import { boolEnv, loadFrontendEnv, repoRoot } from './lib/env.mjs';
import { resolveLoginToolDir } from './lib/login-tool-adapter.mjs';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmRegister: false,
    visible: null,
    screenshot: false,
    email: '',
    inviteCode: '',
    accountUrl: '',
    screenshotPath: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--confirm-register') args.confirmRegister = true;
    else if (value === '--visible') args.visible = true;
    else if (value === '--screenshot') args.screenshot = true;
    else if (value === '--email') args.email = argv[++index] || '';
    else if (value === '--invite-code') args.inviteCode = argv[++index] || '';
    else if (value === '--account-url') args.accountUrl = argv[++index] || '';
    else if (value === '--screenshot-path') args.screenshotPath = argv[++index] || '';
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/frontend-register-api.mjs --dry-run
       node scripts/frontend-register-api.mjs --confirm-register
       node scripts/frontend-register-api.mjs --confirm-register --email codexapi<timestamp>@weex.com

Creates a STG frontend email account through the validated test API path, then injects the returned token cookie and verifies /zh-CN/account.
Reads the password from WEEX_FRONTEND_COMMON_PASSWORD or WEEX_FRONTEND_PASSWORD.`);
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '<generated>';
  const visiblePrefix = name.slice(0, Math.min(8, name.length));
  return `${visiblePrefix}***@${domain}`;
}

function canPrintAccountIdentifiers() {
  return (process.env.WEEX_FRONTEND_ENV || 'stg') !== 'prod';
}

function printableEmail(email) {
  return canPrintAccountIdentifiers() ? email : maskEmail(email);
}

function requirePassword() {
  const password = process.env.WEEX_FRONTEND_COMMON_PASSWORD || process.env.WEEX_FRONTEND_PASSWORD || '';
  if (!password || /^<.*>$/.test(password.trim())) {
    throw new Error('Missing frontend common password. Set WEEX_FRONTEND_COMMON_PASSWORD in skills/weex-frontend-ops/.env.local or WEEX_FRONTEND_* runtime environment.');
  }
  return password;
}

function generatedEmail() {
  return `codexapi${Date.now()}@weex.com`;
}

function gatewayBaseUrl() {
  return process.env.WEEX_FRONTEND_GATEWAY_BASE_URL || 'https://stg-gateway.weex.tech';
}

function registerHeaders() {
  return {
    appversion: '1.1.0',
    language: 'zh_CN',
    locale: 'zh_CN',
    terminalcode: process.env.WEEX_FRONTEND_TERMINAL_CODE || 'a6bc76f111afa48381a623692ed037d1',
    terminaltype: '1',
    vs: process.env.WEEX_FRONTEND_VS || 'C5h7F5A8m18x099cKPY27gFjxc0MB6uO',
    'x-timestamp': String(Date.now()),
    'content-type': 'application/json;charset=UTF-8',
    'x-sig': process.env.WEEX_FRONTEND_X_SIG || 'b67d692f29e5e274e7d684e335207f5e',
    accept: 'application/json, text/plain, */*',
    'qa-test': 'true',
    test: 'true',
    origin: 'https://stg-www.weex.tech',
    referer: 'https://stg-www.weex.tech/zh-CN/register'
  };
}

async function postJson(pathname, data, extraHeaders = {}) {
  const response = await fetch(`${gatewayBaseUrl()}${pathname}`, {
    method: 'POST',
    headers: { ...registerHeaders(), ...extraHeaders },
    body: JSON.stringify(data)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return {
    httpStatus: response.status,
    code: body.code,
    msg: body.msg || body.message || '',
    data: body.data
  };
}

function redactResponse(response) {
  return JSON.parse(JSON.stringify(response, (key, value) => {
    if (/token|pwd|password|verifyKey|serialNO|rtoken|refresh/i.test(key) && typeof value === 'string') return '<redacted>';
    if (/userId/i.test(key) && typeof value === 'string') return canPrintAccountIdentifiers() ? value : '<redacted>';
    if (/email|loginName/i.test(key) && typeof value === 'string' && value.includes('@')) return printableEmail(value);
    return value;
  }));
}

function tokensFromRegisterData(data) {
  return {
    accessToken: data?.accessToken,
    accessTokenExpire: Number(data?.accessTokenExpire),
    rtoken: data?.rtoken,
    refreshToken: data?.refreshToken,
    refreshTokenExpire: Number(data?.refreshTokenExpire),
    userId: data?.userInfo?.userId
  };
}

function assertTokenShape(tokens) {
  for (const key of ['accessToken', 'accessTokenExpire', 'rtoken', 'refreshToken', 'refreshTokenExpire', 'userId']) {
    if (!tokens[key]) throw new Error(`Register response missing token field: ${key}`);
  }
}

loadFrontendEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const email = args.email || generatedEmail();
const accountUrl = args.accountUrl || process.env.WEEX_FRONTEND_ACCOUNT_URL || 'https://stg-www.weex.tech/zh-CN/account';
const visible = args.visible === true;
const saveScreenshot = args.screenshot || boolEnv('WEEX_FRONTEND_SAVE_SCREENSHOT', false);
const screenshot = path.resolve(
  repoRoot(),
  args.screenshotPath || process.env.WEEX_FRONTEND_SCREENSHOT || 'skills/weex-frontend-ops/artifacts/screenshots/认证/注册/stg-frontend-register-success.png'
);
const password = (() => {
  try {
    return requirePassword();
  } catch (error) {
    if (args.dryRun) return '';
    throw error;
  }
})();

if (args.dryRun) {
  let missingConfig = null;
  try {
    requirePassword();
    resolveLoginToolDir();
  } catch (error) {
    missingConfig = error.message;
  }
  console.log(JSON.stringify({
    ok: !missingConfig,
    dryRun: true,
    operation: 'frontend_register_api',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    accountType: 'email',
    generatedEmail: !args.email,
    email: printableEmail(email),
    gatewayBaseUrl: gatewayBaseUrl(),
    endpoints: [
      '/v1/user/public/validate/config',
      '/v1/user/register/check',
      '/v1/user/register/submit'
    ],
    requiresConfirmRegister: true,
    visible,
    saveScreenshot,
    screenshot: saveScreenshot ? screenshot : null,
    missingConfig,
    assertions: [
      'register/submit returns code 00000',
      'WEEX_TOKEN_COOKIE_STAGING cookie is present after token-cookie injection',
      'account overview or /account URL is visible'
    ]
  }, null, 2));
  process.exit(missingConfig ? 1 : 0);
}

if (!args.confirmRegister) {
  console.error('Refusing to create a frontend account without --confirm-register. Run --dry-run first, then pass --confirm-register after user confirmation.');
  process.exit(2);
}

const validate = await postJson('/v1/user/public/validate/config', {
  action: 3022,
  email,
  mobile: ''
});
if (validate.code !== '00000') {
  console.log(JSON.stringify({ ok: false, stage: 'validate/config', email: printableEmail(email), response: redactResponse(validate) }, null, 2));
  process.exit(1);
}

const channelName = validate?.data?.validate?.channelName || 'aliyun';
const check = await postJson('/v1/user/register/check', {
  type: 'email',
  areaCode: '',
  loginName: email,
  channelName,
  paramMap: {},
  authResult: { result: true }
});
if (check.code !== '00000') {
  console.log(JSON.stringify({ ok: false, stage: 'register/check', email: printableEmail(email), response: redactResponse(check) }, null, 2));
  process.exit(1);
}

const encryptedPassword = crypto.createHash('md5').update(password).digest('base64');
const submitPayload = {
  pwd: encryptedPassword,
  rePwd: encryptedPassword,
  languageType: 1,
  serialNO: check.data.serialNO,
  email,
  type: 'email',
  terminalCode: process.env.WEEX_FRONTEND_REGISTER_TERMINAL_CODE || '018ab4ec08e67c547e1cc5e3864c3bf9'
};
if (args.inviteCode) submitPayload.registerVipNo = args.inviteCode;

const submit = await postJson('/v1/user/register/submit', submitPayload);
if (submit.code !== '00000') {
  console.log(JSON.stringify({ ok: false, stage: 'register/submit', email: printableEmail(email), response: redactResponse(submit) }, null, 2));
  process.exit(1);
}

const tokens = tokensFromRegisterData(submit.data);
assertTokenShape(tokens);

const { buildWeexTokenCookie } = await import(pathToFileURL(resolveLoginToolDir().cookieModule).href);
const cookie = buildWeexTokenCookie(tokens, { targetUrl: accountUrl, httpOnly: false });
const [{ launchBrowser }] = await Promise.all([
  import('./lib/browser.mjs')
]);

const { browser, context, page, failedResponses } = await launchBrowser({ visible, disableWebSecurity: true });
try {
  await context.addCookies([cookie]);
  await page.goto(accountUrlFor(accountUrl), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const evidence = await captureAuthEvidence(page, screenshot, failedResponses, { saveScreenshot });
  const passed = evidence.tokenCookiePresent
    && evidence.assertions.loginFormAbsent
    && (evidence.assertions.accountOverviewVisible || evidence.assertions.accountSecurityVisible || evidence.url.includes('/account'));
  console.log(JSON.stringify({
    ok: passed,
    operation: 'frontend_register_api',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    email: printableEmail(email),
    userId: tokens.userId,
    channelName,
    evidence
  }, null, 2));
  if (!passed) process.exit(1);
} finally {
  await browser.close();
}

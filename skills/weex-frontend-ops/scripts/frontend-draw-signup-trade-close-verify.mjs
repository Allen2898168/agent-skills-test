#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadFrontendEnv, repoRoot } from './lib/env.mjs';
import { buildFrontendAuthCookie } from './lib/login-tool-adapter.mjs';
import { launchBrowser } from './lib/browser.mjs';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    visible: false,
    confirmRun: false,
    activityAlias: '',
    taskId: '',
    accountFile: '',
    accountIndex: 0,
    symbol: 'ETHUSDT',
    side: 'BUY',
    positionSide: 'LONG',
    type: 'MARKET',
    quantity: '0.5',
    activityHost: process.env.WEEX_FRONTEND_ACTIVITY_HOST || 'https://stg-www.weex.tech',
    contractBaseUrl: process.env.WEEX_FRONTEND_CONTRACT_API_BASE_URL || 'https://stg-api-contract.weex.tech',
    timeoutMs: 90000
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--visible') args.visible = true;
    else if (value === '--confirm-run') args.confirmRun = true;
    else if (value === '--activity-alias') args.activityAlias = argv[++index] || '';
    else if (value === '--task-id') args.taskId = argv[++index] || '';
    else if (value === '--account-file') args.accountFile = argv[++index] || '';
    else if (value === '--account-index') args.accountIndex = Number(argv[++index] || 0);
    else if (value === '--symbol') args.symbol = argv[++index] || '';
    else if (value === '--side') args.side = argv[++index] || '';
    else if (value === '--position-side') args.positionSide = argv[++index] || '';
    else if (value === '--type') args.type = argv[++index] || '';
    else if (value === '--quantity') args.quantity = argv[++index] || '';
    else if (value === '--activity-host') args.activityHost = argv[++index] || '';
    else if (value === '--contract-base-url') args.contractBaseUrl = argv[++index] || '';
    else if (value === '--timeout-ms') args.timeoutMs = Number(argv[++index] || 90000);
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/frontend-draw-signup-trade-close-verify.mjs --dry-run --activity-alias <alias> --account-file <json>
  node scripts/frontend-draw-signup-trade-close-verify.mjs --confirm-run --visible --activity-alias <alias> --task-id <id> --account-file <json> --symbol ETHUSDT --quantity 0.5

Flow:
  1) open draw page and ensure signup
  2) place contract Open API order
  3) open futures page and click one-key close
  4) return draw page and verify task completion

Safety:
  Real execution requires --confirm-run.
  Credentials are read from local generated account JSON and never printed.`);
}

function normalizeUpper(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeSymbol(symbol) {
  const text = normalizeUpper(symbol).replace(/[-_/]/g, '');
  if (!/^[A-Z0-9]{5,30}$/.test(text)) throw new Error(`Invalid symbol: ${symbol}`);
  return text;
}

function normalizeSide(value) {
  const text = normalizeUpper(value);
  if (!['BUY', 'SELL'].includes(text)) throw new Error(`Invalid side: ${value}`);
  return text;
}

function normalizePositionSide(value) {
  const text = normalizeUpper(value);
  if (!['LONG', 'SHORT'].includes(text)) throw new Error(`Invalid position-side: ${value}`);
  return text;
}

function normalizeType(value) {
  const text = normalizeUpper(value);
  if (!['MARKET', 'LIMIT'].includes(text)) throw new Error(`Invalid type: ${value}`);
  return text;
}

function normalizeQuantity(value) {
  const text = String(value || '').trim();
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`Invalid quantity: ${value}`);
  return text;
}

function contractPath(symbol) {
  const base = symbol.replace('USDT', '');
  return `/zh-CN/futures/${base}-USDT`;
}

function loadAccount(args) {
  const missing = [];
  if (!args.accountFile) missing.push('--account-file');
  if (!args.activityAlias) missing.push('--activity-alias');
  if (missing.length) {
    return { ok: false, missing, reason: 'missing required args' };
  }
  const abs = path.resolve(repoRoot(), args.accountFile);
  if (!fs.existsSync(abs)) {
    return { ok: false, missing: [`account file not found: ${args.accountFile}`], reason: 'account file not found' };
  }
  const payload = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const accounts = Array.isArray(payload) ? payload : Array.isArray(payload.accounts) ? payload.accounts : [];
  const account = accounts[args.accountIndex];
  if (!account) {
    return { ok: false, missing: [`account index ${args.accountIndex} missing`], reason: 'account index not found' };
  }
  const required = ['email', 'password', 'userId', 'apiKey', 'secret', 'passphrase'];
  const absent = required.filter((field) => !account[field]);
  if (absent.length) {
    return { ok: false, missing: absent.map((field) => `account.${field}`), reason: 'account fields missing' };
  }
  return {
    ok: true,
    accountFile: abs,
    account: {
      email: account.email,
      password: account.password,
      uid: String(account.userId),
      apiKey: account.apiKey,
      apiSecret: account.secret,
      apiPassphrase: account.passphrase
    }
  };
}

function encodeQuery(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  return params.toString();
}

function sign({ apiSecret, timestamp, method, requestPath, queryString, bodyString }) {
  let message = `${timestamp}${method}${requestPath}`;
  if (queryString) message += `?${queryString}`;
  message += bodyString;
  return crypto.createHmac('sha256', apiSecret).update(message).digest('base64');
}

async function requestContract({
  baseUrl,
  requestPath,
  method = 'GET',
  query = {},
  body = {},
  credentials,
  timeoutMs
}) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const queryString = encodeQuery(query);
  const bodyString = method === 'GET' ? '' : JSON.stringify(body);
  const timestamp = String(Date.now());
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    locale: 'zh-CN',
    'user-agent': 'weex-frontend-ops-draw-trade/1.0',
    'ACCESS-KEY': credentials.apiKey,
    'ACCESS-PASSPHRASE': credentials.apiPassphrase,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-SIGN': sign({
      apiSecret: credentials.apiSecret,
      timestamp,
      method,
      requestPath,
      queryString,
      bodyString
    })
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizedBase}${requestPath}${queryString ? `?${queryString}` : ''}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : bodyString,
      signal: controller.signal
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 500) }; }
    return { status: response.status, ok: response.ok, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function clickVisibleSelector(page, selector) {
  return page.evaluate((inputSelector) => {
    const visible = (node) => {
      if (!node) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const target = [...document.querySelectorAll(inputSelector)].find(visible);
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    target.click();
    return true;
  }, selector);
}

async function ensureSignup(page, network, activityUrl) {
  let seenButton = false;
  let done = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const button = page.locator('button:visible').filter({ hasText: '立即报名' }).first();
    if (await button.isVisible().catch(() => false)) {
      seenButton = true;
      await button.scrollIntoViewIfNeeded().catch(() => {});
      await button.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.waitForTimeout(1200);
    }

    const applyOk = network.apply.some((entry) => entry?.body?.code === '00000');
    const statusTrue = network.applyStatus.some((entry) => entry?.body?.data === true);
    const signedTextVisible = await page.getByText('已报名').first().isVisible().catch(() => false);
    if (applyOk || statusTrue || signedTextVisible) {
      done = true;
      break;
    }
    await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2000);
  }
  return {
    seenButton,
    done,
    applyOk: network.apply.some((entry) => entry?.body?.code === '00000'),
    applyStatusTrue: network.applyStatus.some((entry) => entry?.body?.data === true),
    applyCalls: network.apply.length,
    applyStatusCalls: network.applyStatus.length
  };
}

function detectTaskCompleted(taskCompletions, taskId) {
  const completions = taskCompletions?.data?.completions;
  if (!Array.isArray(completions)) return false;
  if (taskId) {
    return completions.some((item) => String(item?.taskId) === String(taskId) && item?.status === 'COMPLETED');
  }
  return completions.some((item) => item?.status === 'COMPLETED' && item?.type === 'TRADING_VOLUME');
}

loadFrontendEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

let symbol;
let side;
let positionSide;
let orderType;
let quantity;
try {
  symbol = normalizeSymbol(args.symbol);
  side = normalizeSide(args.side);
  positionSide = normalizePositionSide(args.positionSide);
  orderType = normalizeType(args.type);
  quantity = normalizeQuantity(args.quantity);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (orderType !== 'MARKET') {
  console.error('Only MARKET order is supported in this flow script.');
  process.exit(1);
}

const accountState = loadAccount(args);
const activityAlias = String(args.activityAlias || '').trim();
const activityHost = String(args.activityHost || '').trim().replace(/\/+$/, '');
const activityUrl = `${activityHost}/zh-CN/events/draw/${activityAlias}`;
const futuresUrl = `${activityHost}${contractPath(symbol)}`;
const missing = accountState.ok ? [] : accountState.missing;

if (args.dryRun) {
  console.log(JSON.stringify({
    ok: missing.length === 0,
    dryRun: true,
    operation: 'frontend_draw_signup_trade_close_verify',
    activity: {
      alias: activityAlias,
      taskId: args.taskId || null,
      url: activityUrl
    },
    trade: {
      symbol,
      side,
      positionSide,
      type: orderType,
      quantity,
      contractBaseUrl: args.contractBaseUrl
    },
    browser: {
      visible: args.visible,
      futuresUrl
    },
    account: accountState.ok ? {
      file: args.accountFile,
      index: args.accountIndex,
      email: accountState.account.email,
      uid: accountState.account.uid
    } : null,
    missingConfig: missing.length ? missing : null,
    requiresConfirmRun: true,
    assertions: [
      'apply returns code 00000 or applyStatus becomes true',
      'POST /capi/v3/order returns HTTP 2xx success payload',
      'futures page one-key close is clicked and confirmed',
      'taskCompletions contains COMPLETED for the target taskId or TRADING_VOLUME'
    ]
  }, null, 2));
  process.exit(missing.length ? 1 : 0);
}

if (!args.confirmRun) {
  console.error('Refusing real execution without --confirm-run.');
  process.exit(1);
}
if (!accountState.ok) {
  console.error(`Missing required config: ${missing.join(', ')}`);
  process.exit(1);
}

const { account } = accountState;
const cookie = await buildFrontendAuthCookie({
  username: account.email,
  password: account.password,
  targetUrl: activityUrl,
  timeoutMs: args.timeoutMs
});

const { browser, context, page } = await launchBrowser({
  visible: args.visible,
  disableWebSecurity: true
});

const network = {
  apply: [],
  applyStatus: [],
  closeAll: [],
  taskCompletions: null,
  frequency: null
};

page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/v1/activity/general/apply')) {
    let body = null;
    try { body = await response.json(); } catch {}
    network.apply.push({ status: response.status(), body });
  }
  if (url.includes('/v1/activity/general/applyStatus?')) {
    let body = null;
    try { body = await response.json(); } catch {}
    network.applyStatus.push({ status: response.status(), body });
  }
  if (url.includes('/api/v1/private/order/closeAllPosition')) {
    let body = null;
    try { body = await response.json(); } catch {}
    network.closeAll.push({ status: response.status(), body });
  }
  if (url.includes('/v1/activity/general/taskCompletions?')) {
    try { network.taskCompletions = await response.json(); } catch {}
  }
  if (url.includes('/v1/activity/general/raffle/frequency?')) {
    try { network.frequency = await response.json(); } catch {}
  }
});

try {
  await context.addCookies([cookie]);

  await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
  await page.waitForTimeout(2500);
  const signup = await ensureSignup(page, network, activityUrl);
  if (!signup.done) {
    throw new Error('Signup did not succeed.');
  }

  const order = await requestContract({
    baseUrl: args.contractBaseUrl,
    requestPath: '/capi/v3/order',
    method: 'POST',
    body: {
      symbol,
      side,
      positionSide,
      type: orderType,
      quantity,
      newClientOrderId: `draw-task-${Date.now()}`
    },
    credentials: account,
    timeoutMs: args.timeoutMs
  });
  if (!order.ok) {
    throw new Error(`Order request failed with HTTP ${order.status}`);
  }

  await page.goto(futuresUrl, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
  await page.waitForTimeout(12000);
  for (const text of ['我知道了', '知道了', '暂不', '稍后']) {
    const button = page.locator('button:visible').filter({ hasText: text }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  const closeClicked = await clickVisibleSelector(page, '[data-test-id="ContractPosition-one-key-close"]');
  await page.waitForTimeout(1200);
  let confirmClicked = await clickVisibleSelector(page, '[data-test-id="ContractPosition-all-close-confirm"]');
  if (!confirmClicked) {
    const confirmButton = page.locator('button:visible').filter({ hasText: '确定' }).first();
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click().catch(() => {});
      confirmClicked = true;
    }
  }
  await page.waitForTimeout(6000);

  await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
  await page.waitForTimeout(5000);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: args.timeoutMs });
  await page.waitForTimeout(5000);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const taskCompleted = detectTaskCompleted(network.taskCompletions, args.taskId);
  const closeAllSuccess = network.closeAll.some((entry) => entry?.body?.msg === 'SUCCESS' || entry?.body?.code === '00000');

  console.log(JSON.stringify({
    ok: signup.done && order.ok && closeClicked && confirmClicked && taskCompleted,
    operation: 'frontend_draw_signup_trade_close_verify',
    activity: {
      alias: activityAlias,
      taskId: args.taskId || null,
      url: activityUrl
    },
    account: {
      email: account.email,
      uid: account.uid
    },
    signup,
    trade: {
      symbol,
      side,
      positionSide,
      type: orderType,
      quantity,
      orderHttpStatus: order.status,
      orderPayload: order.payload
    },
    closePosition: {
      futuresUrl,
      closeClicked,
      confirmClicked,
      closeAllCalls: network.closeAll.length,
      closeAllSuccess
    },
    task: {
      finalUrl: page.url(),
      taskCompleted,
      taskCompletions: network.taskCompletions,
      frequency: network.frequency,
      uiCompletedHint: /已完成|任务完成/.test(bodyText),
      uiDrawChanceHint: /可用次数\s*[：:]?\s*[1-9]/.test(bodyText) || /可抽奖次数\s*[：:]?\s*[1-9]/.test(bodyText)
    }
  }, null, 2));
} finally {
  await browser.close();
}

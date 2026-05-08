#!/usr/bin/env node
import { resolveFrontendAccount } from './lib/account-config.mjs';
import { loadFrontendEnv } from './lib/env.mjs';
import { loginFrontendWithTokens, resolveLoginToolDir } from './lib/login-tool-adapter.mjs';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmTransfer: false,
    account: '',
    amount: '1000',
    fromAccountType: '10',
    toAccountType: '8',
    transferCoinId: '2',
    gatewayBaseUrl: '',
    loginGatewayBaseUrl: '',
    timeoutMs: 60000,
    raw: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--confirm-transfer') args.confirmTransfer = true;
    else if (value === '--raw') args.raw = true;
    else if (value === '--account') args.account = argv[++index] || '';
    else if (value === '--amount') args.amount = argv[++index] || '';
    else if (value === '--from-account-type') args.fromAccountType = argv[++index] || '';
    else if (value === '--to-account-type') args.toAccountType = argv[++index] || '';
    else if (value === '--transfer-coin-id') args.transferCoinId = argv[++index] || '';
    else if (value === '--gateway-base-url') args.gatewayBaseUrl = argv[++index] || '';
    else if (value === '--login-gateway-base-url') args.loginGatewayBaseUrl = argv[++index] || '';
    else if (value === '--timeout-ms') args.timeoutMs = Number(argv[++index] || 60000);
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/frontend-assets-transfer.mjs --dry-run
       node scripts/frontend-assets-transfer.mjs --confirm-transfer --amount 1000 --from-account-type 10 --to-account-type 8 --transfer-coin-id 2

Logs in through the frontend loginTool path, then calls POST /v1/assets/transfer with U-Token.
Default transfer direction follows the STG example: spot account type 10 to contract account type 8, coin id 2.`);
}

function requirePositiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid transfer amount: ${value}`);
  }
  return amount;
}

function requireIntegerString(value, name) {
  const text = String(value || '').trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return text;
}

function transferPayload(args) {
  return {
    amount: requirePositiveAmount(args.amount),
    fromAccountType: Number(requireIntegerString(args.fromAccountType, 'fromAccountType')),
    toAccountType: Number(requireIntegerString(args.toAccountType, 'toAccountType')),
    transferCoinId: requireIntegerString(args.transferCoinId, 'transferCoinId')
  };
}

function transferGatewayBaseUrl(args) {
  return args.gatewayBaseUrl || process.env.WEEX_FRONTEND_ASSET_GATEWAY_BASE_URL || 'https://stg-gateway2.weex.tech';
}

function loginGatewayBaseUrl(args) {
  return args.loginGatewayBaseUrl || process.env.WEEX_FRONTEND_LOGIN_GATEWAY_BASE_URL || 'https://stg-gateway.weex.tech';
}

function transferHeaders(accessToken) {
  return {
    'U-Token': accessToken,
    language: 'zh_CN',
    locale: 'zh_CN',
    'content-type': 'application/json;charset=UTF-8',
    accept: 'application/json, text/plain, */*',
    'qa-test': 'true',
    test: 'true',
    origin: 'https://stg-www.weex.tech',
    referer: 'https://stg-www.weex.tech/zh-CN/account'
  };
}

async function postTransfer({ gatewayBaseUrl, accessToken, payload, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${gatewayBaseUrl.replace(/\/+$/, '')}/v1/assets/transfer`, {
      method: 'POST',
      headers: transferHeaders(accessToken),
      body: JSON.stringify(payload),
      signal: controller.signal
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
      code: body.code ?? null,
      msg: body.msg || body.message || '',
      data: body.data ?? null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function redactResponse(value) {
  return JSON.parse(JSON.stringify(value, (key, raw) => {
    if (/token|cookie|session|password|pwd|sig/i.test(key)) return raw == null ? raw : '<redacted>';
    return raw;
  }));
}

loadFrontendEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

let account = null;
let payload = null;
let missingConfig = null;
try {
  account = resolveFrontendAccount(args.account);
  payload = transferPayload(args);
  resolveLoginToolDir();
} catch (error) {
  missingConfig = error.message;
}

if (args.dryRun) {
  console.log(JSON.stringify({
    ok: !missingConfig,
    dryRun: true,
    operation: 'frontend_assets_transfer',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    account: account ? {
      alias: account.alias,
      username: account.username,
      passwordSource: account.passwordSource
    } : null,
    endpoint: `${transferGatewayBaseUrl(args).replace(/\/+$/, '')}/v1/assets/transfer`,
    loginGatewayBaseUrl: loginGatewayBaseUrl(args),
    method: 'POST',
    payload,
    requiresConfirmTransfer: true,
    missingConfig,
    assertions: [
      'frontend loginTool login returns accessToken without printing it',
      'transfer response HTTP status is 2xx',
      'transfer response business code is 00000'
    ]
  }, null, 2));
  process.exit(missingConfig ? 1 : 0);
}

if (missingConfig) {
  console.error(missingConfig);
  process.exit(1);
}

if (!args.confirmTransfer) {
  console.error('Refusing to transfer assets without --confirm-transfer. Run --dry-run first, then pass --confirm-transfer after user confirmation.');
  process.exit(2);
}

const login = await loginFrontendWithTokens({
  username: account.username,
  password: account.password,
  gatewayBaseUrl: loginGatewayBaseUrl(args),
  timeoutMs: args.timeoutMs
});
const transfer = await postTransfer({
  gatewayBaseUrl: transferGatewayBaseUrl(args),
  accessToken: login.tokens.accessToken,
  payload,
  timeoutMs: args.timeoutMs
});
const ok = transfer.httpStatus >= 200 && transfer.httpStatus < 300 && String(transfer.code) === '00000';

console.log(JSON.stringify({
  ok,
  operation: 'frontend_assets_transfer',
  environment: process.env.WEEX_FRONTEND_ENV || 'stg',
  account: {
    alias: account.alias,
    username: account.username,
    userId: login.tokens.userId,
    passwordSource: account.passwordSource
  },
  endpoint: `${transferGatewayBaseUrl(args).replace(/\/+$/, '')}/v1/assets/transfer`,
  payload,
  response: args.raw ? redactResponse(transfer) : {
    httpStatus: transfer.httpStatus,
    code: transfer.code,
    msg: transfer.msg
  }
}, null, 2));

if (!ok) process.exit(1);

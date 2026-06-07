#!/usr/bin/env node
import crypto from 'node:crypto';
import { loadFrontendEnv } from './lib/env.mjs';

function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmOrder: false,
    symbol: 'BTCUSDT',
    side: 'BUY',
    positionSide: 'LONG',
    type: 'MARKET',
    quantity: '',
    price: '',
    timeInForce: '',
    newClientOrderId: '',
    baseUrl: '',
    timeoutMs: 60000,
    checkBalance: false,
    tickerOnly: false,
    raw: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--confirm-order') args.confirmOrder = true;
    else if (value === '--check-balance') args.checkBalance = true;
    else if (value === '--ticker-only') args.tickerOnly = true;
    else if (value === '--raw') args.raw = true;
    else if (value === '--symbol') args.symbol = argv[++index] || '';
    else if (value === '--side') args.side = argv[++index] || '';
    else if (value === '--position-side') args.positionSide = argv[++index] || '';
    else if (value === '--type') args.type = argv[++index] || '';
    else if (value === '--quantity') args.quantity = argv[++index] || '';
    else if (value === '--price') args.price = argv[++index] || '';
    else if (value === '--time-in-force') args.timeInForce = argv[++index] || '';
    else if (value === '--new-client-order-id') args.newClientOrderId = argv[++index] || '';
    else if (value === '--base-url') args.baseUrl = argv[++index] || '';
    else if (value === '--timeout-ms') args.timeoutMs = Number(argv[++index] || 60000);
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/frontend-contract-place-order.mjs --ticker-only --symbol BTCUSDT
  node scripts/frontend-contract-place-order.mjs --check-balance
  node scripts/frontend-contract-place-order.mjs --dry-run --symbol BTCUSDT --side BUY --position-side LONG --type MARKET --quantity 0.001
  node scripts/frontend-contract-place-order.mjs --confirm-order --symbol BTCUSDT --side BUY --position-side LONG --type MARKET --quantity 0.001

Reads only WEEX_FRONTEND_CONTRACT_* from skills/weex-frontend-ops/.env.local or current process.
Required for private calls: WEEX_FRONTEND_CONTRACT_API_KEY, WEEX_FRONTEND_CONTRACT_API_SECRET, WEEX_FRONTEND_CONTRACT_API_PASSPHRASE.`);
}

function compactJson(value) {
  return JSON.stringify(value);
}

function normalizeSymbol(symbol) {
  const text = String(symbol || '').trim().toUpperCase().replace(/[-_/]/g, '');
  if (!/^[A-Z0-9]{5,30}$/.test(text)) throw new Error(`Invalid symbol: ${symbol}`);
  return text;
}

function normalizeEnum(value, allowed, name) {
  const text = String(value || '').trim().toUpperCase();
  if (!allowed.includes(text)) throw new Error(`Invalid ${name}: ${value}`);
  return text;
}

function normalizeQuantity(value) {
  const text = String(value || '').trim();
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid quantity: ${value}`);
  return text;
}

function contractBaseUrl(args) {
  return (args.baseUrl || process.env.WEEX_FRONTEND_CONTRACT_API_BASE_URL || 'https://stg-api-contract.weex.tech').replace(/\/+$/, '');
}

function privateCredentials() {
  return {
    apiKey: process.env.WEEX_FRONTEND_CONTRACT_API_KEY || '',
    apiSecret: process.env.WEEX_FRONTEND_CONTRACT_API_SECRET || '',
    apiPassphrase: process.env.WEEX_FRONTEND_CONTRACT_API_PASSPHRASE || ''
  };
}

function missingCredentials(creds) {
  const missing = [];
  if (!creds.apiKey) missing.push('WEEX_FRONTEND_CONTRACT_API_KEY');
  if (!creds.apiSecret) missing.push('WEEX_FRONTEND_CONTRACT_API_SECRET');
  if (!creds.apiPassphrase) missing.push('WEEX_FRONTEND_CONTRACT_API_PASSPHRASE');
  return missing;
}

function sign({ apiSecret, timestamp, method, path, queryString, bodyString }) {
  let message = `${timestamp}${method}${path}`;
  if (queryString) message += `?${queryString}`;
  message += bodyString;
  return crypto.createHmac('sha256', apiSecret).update(message).digest('base64');
}

function encodeQuery(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  return params.toString();
}

async function requestJson({ baseUrl, path, method = 'GET', query = {}, body = {}, auth = false, creds, timeoutMs }) {
  const queryString = encodeQuery(query);
  const bodyString = method === 'GET' ? '' : compactJson(body);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    locale: 'zh-CN',
    'user-agent': 'weex-frontend-ops-contract-api/1.0'
  };
  if (auth) {
    const timestamp = String(Date.now());
    headers['ACCESS-KEY'] = creds.apiKey;
    headers['ACCESS-PASSPHRASE'] = creds.apiPassphrase;
    headers['ACCESS-TIMESTAMP'] = timestamp;
    headers['ACCESS-SIGN'] = sign({ apiSecret: creds.apiSecret, timestamp, method, path, queryString, bodyString });
  }
  const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : bodyString,
      signal: controller.signal
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 500) }; }
    return { httpStatus: response.status, ok: response.ok, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function orderBody(args) {
  const body = {
    symbol: normalizeSymbol(args.symbol),
    side: normalizeEnum(args.side, ['BUY', 'SELL'], 'side'),
    positionSide: normalizeEnum(args.positionSide, ['LONG', 'SHORT'], 'positionSide'),
    type: normalizeEnum(args.type, ['LIMIT', 'MARKET'], 'type'),
    quantity: normalizeQuantity(args.quantity),
    newClientOrderId: args.newClientOrderId || `frontend-ops-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  };
  if (body.type === 'LIMIT') {
    if (!args.price) throw new Error('price is required when type=LIMIT');
    if (!args.timeInForce) throw new Error('time-in-force is required when type=LIMIT');
    body.price = String(args.price);
    body.timeInForce = normalizeEnum(args.timeInForce, ['GTC', 'IOC', 'FOK'], 'timeInForce');
  } else if (args.price || args.timeInForce) {
    throw new Error('price and time-in-force must be omitted when type=MARKET');
  }
  return body;
}

function redact(value) {
  return JSON.parse(JSON.stringify(value, (key, raw) => {
    if (/key|secret|passphrase|sign|token|cookie|password|pwd/i.test(key)) return raw ? '<redacted>' : raw;
    return raw;
  }));
}

loadFrontendEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const baseUrl = contractBaseUrl(args);
const creds = privateCredentials();

if (args.tickerOnly) {
  const symbol = normalizeSymbol(args.symbol);
  const response = await requestJson({
    baseUrl,
    path: '/capi/v3/market/symbolPrice',
    query: { symbol },
    timeoutMs: args.timeoutMs
  });
  console.log(JSON.stringify({
    ok: response.ok,
    operation: 'frontend_contract_ticker',
    baseUrl,
    symbol,
    response
  }, null, 2));
  process.exit(response.ok ? 0 : 1);
}

const missing = missingCredentials(creds);
if (args.checkBalance) {
  if (missing.length) {
    console.log(JSON.stringify({
      ok: false,
      operation: 'frontend_contract_balance',
      baseUrl,
      missingConfig: missing
    }, null, 2));
    process.exit(1);
  }
  const response = await requestJson({
    baseUrl,
    path: '/capi/v3/account/balance',
    auth: true,
    creds,
    timeoutMs: args.timeoutMs
  });
  console.log(JSON.stringify({
    ok: response.ok,
    operation: 'frontend_contract_balance',
    baseUrl,
    response
  }, null, 2));
  process.exit(response.ok ? 0 : 1);
}

let body;
try {
  body = orderBody(args);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (args.dryRun) {
  console.log(JSON.stringify({
    ok: missing.length === 0,
    dryRun: true,
    operation: 'frontend_contract_place_order',
    baseUrl,
    endpoint: '/capi/v3/order',
    method: 'POST',
    body,
    missingConfig: missing.length ? missing : null,
    requiresConfirmOrder: true,
    assertions: [
      'private credentials are loaded only from WEEX_FRONTEND_CONTRACT_*',
      'POST /capi/v3/order returns HTTP 2xx',
      'response contains an order id or success business payload'
    ]
  }, null, 2));
  process.exit(missing.length ? 1 : 0);
}

if (missing.length) {
  console.error(`Missing contract API config: ${missing.join(', ')}`);
  process.exit(1);
}

if (!args.confirmOrder) {
  console.error('Refusing to place contract order without --confirm-order. Run --dry-run first, then pass --confirm-order after user confirmation.');
  process.exit(2);
}

const response = await requestJson({
  baseUrl,
  path: '/capi/v3/order',
  method: 'POST',
  body,
  auth: true,
  creds,
  timeoutMs: args.timeoutMs
});
const result = {
  ok: response.ok,
  operation: 'frontend_contract_place_order',
  baseUrl,
  endpoint: '/capi/v3/order',
  body,
  response: args.raw ? redact(response) : {
    httpStatus: response.httpStatus,
    ok: response.ok,
    payload: response.payload
  }
};
console.log(JSON.stringify(result, null, 2));
process.exit(response.ok ? 0 : 1);

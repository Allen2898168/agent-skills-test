#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadFrontendEnv, repoRoot } from './lib/env.mjs';
import { resolveLoginToolDir } from './lib/login-tool-adapter.mjs';

function parseArgs(argv) {
  const args = {
    count: 1,
    concurrency: null,
    dryRun: false,
    confirmRegister: false,
    emailPrefix: 'codexapi',
    inviteCode: '',
    outputCsv: '',
    maxAttempts: 3
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--count') args.count = Number(argv[++index] || 0);
    else if (value === '--concurrency') args.concurrency = Number(argv[++index] || 0);
    else if (value === '--email-prefix') args.emailPrefix = argv[++index] || '';
    else if (value === '--invite-code') args.inviteCode = argv[++index] || '';
    else if (value === '--output-csv') args.outputCsv = argv[++index] || '';
    else if (value === '--max-attempts') args.maxAttempts = Number(argv[++index] || 0);
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--confirm-register') args.confirmRegister = true;
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function help() {
  return `Usage:
  node scripts/frontend-register-batch-api.mjs --dry-run --count 100 --invite-code 8mja
  node scripts/frontend-register-batch-api.mjs --count 100 --invite-code 8mja --confirm-register

Creates STG frontend email accounts through the validated registration API.
Default concurrency equals count, capped at 100. Failed submissions are backfilled with new emails until count is reached or max attempts is exceeded.`;
}

function validateArgs(args) {
  const missing = [];
  if (!Number.isInteger(args.count) || args.count < 1) missing.push('--count');
  if (args.concurrency !== null && (!Number.isInteger(args.concurrency) || args.concurrency < 1)) missing.push('--concurrency');
  if (!args.emailPrefix) missing.push('--email-prefix');
  if (!Number.isInteger(args.maxAttempts) || args.maxAttempts < 1) missing.push('--max-attempts');
  if (!args.dryRun && !args.confirmRegister) missing.push('--confirm-register');
  if (missing.length) {
    console.log(JSON.stringify({ ok: false, operation: 'frontend_register_batch_api', dryRun: args.dryRun, missing }, null, 2));
    process.exit(args.dryRun ? 0 : 2);
  }
}

function requirePassword() {
  const password = process.env.WEEX_FRONTEND_COMMON_PASSWORD || process.env.WEEX_FRONTEND_PASSWORD || '';
  if (!password || /^<.*>$/.test(password.trim())) {
    throw new Error('Missing frontend common password. Set WEEX_FRONTEND_COMMON_PASSWORD in skills/weex-frontend-ops/.env.local or WEEX_FRONTEND_* runtime environment.');
  }
  return password;
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

async function postJson(pathname, data) {
  const response = await fetch(`${gatewayBaseUrl()}${pathname}`, {
    method: 'POST',
    headers: registerHeaders(),
    body: JSON.stringify(data)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { httpStatus: response.status, code: body.code, msg: body.msg || body.message || '', data: body.data };
}

async function registerOne({ index, args, encryptedPassword, runId, attempt }) {
  const suffix = attempt === 1 ? String(index) : `r${attempt}_${index}`;
  const email = `${args.emailPrefix}${runId}${suffix}@weex.com`;
  try {
    const validate = await postJson('/v1/user/public/validate/config', { action: 3022, email, mobile: '' });
    if (validate.code !== '00000') return failure(index, email, 'validate/config', validate);
    const channelName = validate?.data?.validate?.channelName || 'aliyun';
    const check = await postJson('/v1/user/register/check', {
      type: 'email',
      areaCode: '',
      loginName: email,
      channelName,
      paramMap: {},
      authResult: { result: true }
    });
    if (check.code !== '00000') return failure(index, email, 'register/check', check);
    const payload = {
      pwd: encryptedPassword,
      rePwd: encryptedPassword,
      languageType: 1,
      serialNO: check.data.serialNO,
      email,
      type: 'email',
      terminalCode: process.env.WEEX_FRONTEND_REGISTER_TERMINAL_CODE || '018ab4ec08e67c547e1cc5e3864c3bf9'
    };
    if (args.inviteCode) payload.registerVipNo = args.inviteCode;
    const submit = await postJson('/v1/user/register/submit', payload);
    const uid = submit?.data?.userInfo?.userId;
    if (submit.code !== '00000' || !uid) return failure(index, email, 'register/submit', submit);
    return { index, email, uid: String(uid), ok: true, attempt };
  } catch (error) {
    return { index, email, ok: false, stage: 'exception', msg: error.message, attempt };
  }
}

function failure(index, email, stage, response) {
  return { index, email, ok: false, stage, code: response.code, msg: response.msg };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runWorker() {
    while (next < items.length) {
      const slot = next;
      next += 1;
      results[slot] = await worker(items[slot]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function resolveConcurrency(args) {
  return Math.min(args.concurrency || args.count, 100);
}

function writeCsv(filePath, accounts) {
  if (!filePath) return null;
  const outputPath = path.resolve(repoRoot(), filePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `email,uid\n${accounts.map(item => `${item.email},${item.uid}`).join('\n')}\n`);
  return outputPath;
}

loadFrontendEnv();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(help());
  process.exit(0);
}
validateArgs(args);
const concurrency = resolveConcurrency(args);

let missingConfig = null;
try {
  requirePassword();
  resolveLoginToolDir();
} catch (error) {
  missingConfig = error.message;
}

if (args.dryRun) {
  console.log(JSON.stringify({
    ok: !missingConfig,
    dryRun: true,
    operation: 'frontend_register_batch_api',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    count: args.count,
    concurrency,
    inviteCode: args.inviteCode || null,
    outputCsv: args.outputCsv || null,
    maxAttempts: args.maxAttempts,
    missingConfig,
    writes: false
  }, null, 2));
  process.exit(missingConfig ? 1 : 0);
}

if (missingConfig) throw new Error(missingConfig);
const encryptedPassword = crypto.createHash('md5').update(requirePassword()).digest('base64');
const runId = Date.now();
let successes = [];
let failures = [];
for (let attempt = 1; attempt <= args.maxAttempts && successes.length < args.count; attempt += 1) {
  const need = args.count - successes.length;
  const items = Array.from({ length: need }, (_, index) => ({ index: successes.length + index + 1, attempt }));
  const batch = await runPool(items, concurrency, item => registerOne({ index: item.index, args, encryptedPassword, runId, attempt }));
  successes = successes.concat(batch.filter(item => item.ok));
  failures = batch.filter(item => !item.ok);
}
const accounts = successes.slice(0, args.count);
const csvPath = writeCsv(args.outputCsv, accounts);
console.log(JSON.stringify({
  ok: accounts.length === args.count,
  operation: 'frontend_register_batch_api',
  environment: process.env.WEEX_FRONTEND_ENV || 'stg',
  count: args.count,
  concurrency,
  inviteCode: args.inviteCode || null,
  okCount: accounts.length,
  failCount: args.count - accounts.length,
  outputCsv: csvPath,
  accounts,
  lastFailures: failures
}, null, 2));
if (accounts.length !== args.count) process.exitCode = 1;

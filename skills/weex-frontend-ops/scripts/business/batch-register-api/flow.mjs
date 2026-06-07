import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveLoginToolDir } from '../../lib/login-tool-adapter.mjs';
import { repoRoot } from '../../lib/env.mjs';
import { gatewayBaseUrl, postJson, requirePassword } from './api.mjs';
import { help, parseArgs, resolveConcurrency, validateArgs } from './cli.mjs';

export async function runBatchRegisterApi(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(help());
    return;
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
  if (args.dryRun) return printDryRun(args, concurrency, missingConfig);
  if (missingConfig) throw new Error(missingConfig);

  const encryptedPassword = crypto.createHash('md5').update(requirePassword()).digest('base64');
  const { accounts, failures } = await createAccounts(args, concurrency, encryptedPassword);
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
}

async function createAccounts(args, concurrency, encryptedPassword) {
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
  return { accounts: successes.slice(0, args.count), failures };
}

async function registerOne({ index, args, encryptedPassword, runId, attempt }) {
  const suffix = attempt === 1 ? String(index) : `r${attempt}_${index}`;
  const email = `${args.emailPrefix}${runId}${suffix}@weex.com`;
  try {
    const validate = await postJson('/v1/user/public/validate/config', { action: 3022, email, mobile: '' });
    if (validate.code !== '00000') return failure(index, email, 'validate/config', validate);
    const channelName = validate?.data?.validate?.channelName || 'aliyun';
    const check = await postJson('/v1/user/register/check', {
      type: 'email', areaCode: '', loginName: email, channelName, paramMap: {}, authResult: { result: true }
    });
    if (check.code !== '00000') return failure(index, email, 'register/check', check);
    const submit = await postJson('/v1/user/register/submit', submitPayload(args, encryptedPassword, check.data.serialNO, email));
    const uid = submit?.data?.userInfo?.userId;
    if (submit.code !== '00000' || !uid) return failure(index, email, 'register/submit', submit);
    return { index, email, uid: String(uid), ok: true, attempt };
  } catch (error) {
    return { index, email, ok: false, stage: 'exception', msg: error.message, attempt };
  }
}

function submitPayload(args, encryptedPassword, serialNO, email) {
  const payload = {
    pwd: encryptedPassword,
    rePwd: encryptedPassword,
    languageType: 1,
    serialNO,
    email,
    type: 'email',
    terminalCode: process.env.WEEX_FRONTEND_REGISTER_TERMINAL_CODE || '018ab4ec08e67c547e1cc5e3864c3bf9'
  };
  if (args.inviteCode) payload.registerVipNo = args.inviteCode;
  return payload;
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

function failure(index, email, stage, response) {
  return { index, email, ok: false, stage, code: response.code, msg: response.msg };
}

function printDryRun(args, concurrency, missingConfig) {
  console.log(JSON.stringify({
    ok: !missingConfig,
    dryRun: true,
    operation: 'frontend_register_batch_api',
    environment: process.env.WEEX_FRONTEND_ENV || 'stg',
    count: args.count,
    concurrency,
    inviteCode: args.inviteCode || null,
    gatewayBaseUrl: gatewayBaseUrl(),
    outputCsv: args.outputCsv || null,
    maxAttempts: args.maxAttempts,
    missingConfig,
    writes: false
  }, null, 2));
  if (missingConfig) process.exitCode = 1;
}

function writeCsv(filePath, accounts) {
  if (!filePath) return null;
  const outputPath = path.resolve(repoRoot(), filePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `email,uid\n${accounts.map(item => `${item.email},${item.uid}`).join('\n')}\n`);
  return outputPath;
}

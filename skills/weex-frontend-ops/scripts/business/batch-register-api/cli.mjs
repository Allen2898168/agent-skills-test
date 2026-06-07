export function parseArgs(argv) {
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

export function help() {
  return `Usage:
  node scripts/frontend-register-batch-api.mjs --dry-run --count 100 --invite-code 8mja
  node scripts/frontend-register-batch-api.mjs --count 100 --invite-code 8mja --confirm-register

Creates STG frontend email accounts through the validated registration API.
Default concurrency equals count, capped at 100. Failed submissions are backfilled with new emails until count is reached or max attempts is exceeded.`;
}

export function validateArgs(args) {
  const missing = [];
  if (!Number.isInteger(args.count) || args.count < 1) missing.push('--count');
  if (args.concurrency !== null && (!Number.isInteger(args.concurrency) || args.concurrency < 1)) missing.push('--concurrency');
  if (!args.emailPrefix) missing.push('--email-prefix');
  if (!Number.isInteger(args.maxAttempts) || args.maxAttempts < 1) missing.push('--max-attempts');
  if (!args.dryRun && !args.confirmRegister) missing.push('--confirm-register');
  if (!missing.length) return;
  console.log(JSON.stringify({ ok: false, operation: 'frontend_register_batch_api', dryRun: args.dryRun, missing }, null, 2));
  process.exit(args.dryRun ? 0 : 2);
}

export function resolveConcurrency(args) {
  return Math.min(args.concurrency || args.count, 100);
}

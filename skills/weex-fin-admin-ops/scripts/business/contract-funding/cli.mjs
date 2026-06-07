export function parseArgs(argv) {
  const args = {
    count: 1,
    amount: "",
    currency: "USDT",
    emailPrefix: "codexapi",
    fromAccountType: "10",
    toAccountType: "8",
    transferCoinId: "2",
    concurrency: null,
    dryRun: false,
    confirmRegister: false,
    confirmRecharge: false,
    confirmTransfer: false,
    skipGrantDryRun: false,
    allowUnverifiedTransferChain: false,
    transferRetries: 2,
    transferRetryDelayMs: 3000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--count") args.count = Number(argv[++index] || 0);
    else if (value === "--amount") args.amount = argv[++index] || "";
    else if (value === "--currency") args.currency = argv[++index] || "";
    else if (value === "--email-prefix") args.emailPrefix = argv[++index] || "";
    else if (value === "--from-account-type") args.fromAccountType = argv[++index] || "";
    else if (value === "--to-account-type") args.toAccountType = argv[++index] || "";
    else if (value === "--transfer-coin-id") args.transferCoinId = argv[++index] || "";
    else if (value === "--concurrency") args.concurrency = Number(argv[++index] || 0);
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--confirm-register") args.confirmRegister = true;
    else if (value === "--confirm-recharge") args.confirmRecharge = true;
    else if (value === "--confirm-transfer") args.confirmTransfer = true;
    else if (value === "--skip-grant-dry-run") args.skipGrantDryRun = true;
    else if (value === "--allow-unverified-transfer-chain") args.allowUnverifiedTransferChain = true;
    else if (value === "--transfer-retries") args.transferRetries = Number(argv[++index] || 0);
    else if (value === "--transfer-retry-delay-ms") args.transferRetryDelayMs = Number(argv[++index] || 0);
    else if (value === "--help" || value === "-h") args.help = true;
  }
  return args;
}

export function help() {
  return `Usage:
  node skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs --dry-run --count 1 --amount 1000
  node skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs --count 1 --amount 1000 --confirm-register --confirm-recharge --confirm-transfer
  node skills/weex-fin-admin-ops/scripts/register-recharge-transfer-contract.mjs --count 20 --amount 213 --concurrency 3 --confirm-register --confirm-recharge --confirm-transfer

Runs one full account chain per account: frontend registration -> FIN spot recharge approval -> frontend spot-to-contract transfer.
Concurrency is across accounts only; each account's internal chain remains ordered. Default concurrency equals count, capped at 100.
Frontend transfer retries retryable business responses 70008/20105 by default without repeating registration or FIN recharge.`;
}

export function assertArgs(args) {
  const missing = [];
  if (!Number.isInteger(args.count) || args.count < 1) missing.push("--count");
  if (!/^\d+(\.\d)?\d*$/.test(String(args.amount || "")) || Number(args.amount) <= 0) missing.push("--amount");
  if (!args.currency) missing.push("--currency");
  if (!args.emailPrefix) missing.push("--email-prefix");
  if (!/^\d+$/.test(String(args.fromAccountType || ""))) missing.push("--from-account-type");
  if (!/^\d+$/.test(String(args.toAccountType || ""))) missing.push("--to-account-type");
  if (!/^\d+$/.test(String(args.transferCoinId || ""))) missing.push("--transfer-coin-id");
  if (args.concurrency !== null && (!Number.isInteger(args.concurrency) || args.concurrency < 1)) missing.push("--concurrency");
  if (!Number.isInteger(args.transferRetries) || args.transferRetries < 0) missing.push("--transfer-retries");
  if (!Number.isInteger(args.transferRetryDelayMs) || args.transferRetryDelayMs < 0) missing.push("--transfer-retry-delay-ms");
  if (!args.dryRun && !args.confirmRegister) missing.push("--confirm-register");
  if (!args.dryRun && !args.confirmRecharge) missing.push("--confirm-recharge");
  if (!args.dryRun && !args.confirmTransfer) missing.push("--confirm-transfer");
  if (!args.dryRun && !args.allowUnverifiedTransferChain) missing.push("--allow-unverified-transfer-chain");
  if (!missing.length) return;
  console.log(JSON.stringify({
    ok: false,
    operation: "register_recharge_transfer_contract",
    missing,
    dryRun: args.dryRun,
    blockedReason: args.dryRun ? null : "Real contract funding is blocked unless --allow-unverified-transfer-chain is passed while this chain is candidate.",
  }, null, 2));
  process.exit(args.dryRun ? 0 : 2);
}

export function resolveConcurrency(args) {
  return Math.min(args.concurrency || args.count, 100);
}

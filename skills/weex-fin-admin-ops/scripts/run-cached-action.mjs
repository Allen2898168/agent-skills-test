#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson, readJson } from "./lib/cli.mjs";
import { commandFor } from "./cache/command.mjs";
import { matchAction } from "./cache/matcher.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "action-cache.json");
const executionRoot = path.basename(path.dirname(skillRoot)) === "skills"
  ? path.resolve(skillRoot, "../..")
  : skillRoot;

function usage() {
  return `Usage:
  node scripts/run-cached-action.mjs --list
  node scripts/run-cached-action.mjs --query "FIN 财务充值发放 USDT 目标账号 uid <UID> 数量 <AMOUNT>"
  node scripts/run-cached-action.mjs --action finance_airdrop_reward_grant --uid <UID> --amount <AMOUNT> --dry-run
  node scripts/run-cached-action.mjs --action mq_recharge_callback_send --uid <UID> --amount <AMOUNT> --dry-run

Options:
  --query <text>       Natural-language request to match against cached FIN actions
  --action <id>        Cached action id
  --list               List cached actions
  --dry-run            Show matched command without financial writes
  --count <n>          Batch register/recharge account count
  --uid <uid>          Target UID
  --amount <n>         FIN airdrop reward amount
  --currency <text>    FIN airdrop reward currency
  --email-prefix <x>   Batch frontend registration email prefix
  --concurrency <n>    register_recharge_transfer_contract account-level concurrency; default 1
  --user-type <x>      FIN system account user type
  --remark <x>         FIN system account remark
  --fund-amount <n>    Compound API-account order flow margin amount
  --order-notional <n> Compound API-account order flow order notional
  --symbol <x>         Contract order symbol
  --side <BUY|SELL>    Contract order side
  --position-side <x>  Contract order position side
  --tag-id <id>        FIN system account tag id
  --site <site>        FIN system account site
  --authorities <csv>  FIN system account API permission ids
  --output-dir <dir>   FIN system account local secret output dir
  --sub-biz-type <x>   FIN airdrop reward sub business type
  --remark1 <text>     FIN airdrop reward creation remark
  --audit-type <x>     FIN airdrop approval type code or label
  --audit-remark <x>   FIN airdrop approval remark
  --message-id <id>    MQ recharge callback unique message id override
  --kafka-url <url>    MQ recharge callback Kafka UI URL override
  --confirm-create     Required by finance_airdrop_reward_grant for actual creation
  --confirm-approve    Required by finance_airdrop_reward_grant for actual approval
  --confirm-send       Required by mq_recharge_callback_send for real message send
  --confirm-register   Required by batch_register_recharge for account creation
  --confirm-recharge   Required by batch_register_recharge for FIN recharge
  --confirm-transfer   Required by register_recharge_transfer_contract for frontend spot-to-contract transfer
  --confirm-create-account Required by create_api_account_fund_contract_order
  --confirm-order      Required by create_api_account_fund_contract_order
  --save-secrets       Save generated system account credentials/API keys to local output files
  --allow-unverified-transfer-chain  Required by register_recharge_transfer_contract while the chain is candidate
`;
}

function parseCacheArgs() {
  const parsed = parseFlags(process.argv.slice(2), { booleans: ["--list", "--dry-run", "--confirm-create", "--confirm-approve", "--confirm-register", "--confirm-recharge", "--confirm-transfer", "--confirm-create-account", "--confirm-order", "--skip-grant-dry-run", "--allow-unverified-transfer-chain", "--save-secrets"] });
  const passthrough = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!["help", "list", "dryRun", "query", "action"].includes(key)) passthrough[key] = value;
  }
  return { ...parsed, passthrough };
}

function runMatchedCommand(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: executionRoot,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

function main() {
  const args = parseCacheArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const manifest = readJson(manifestPath);
  if (args.list) {
    printJson({ ok: true, actions: manifest.actions });
    return 0;
  }
  const match = matchAction(manifest, args);
  const { commandArgs } = commandFor(match, args, skillRoot);
  if (args.dryRun) {
    printJson({ ok: true, cachedAction: match.action.id, score: match.score, command: [process.execPath, ...commandArgs] });
    return 0;
  }
  return runMatchedCommand(commandArgs);
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    cacheMatched: false,
    error: error.message,
    fallback: "Use FIN Admin CDP or browser exploration, then update scripts/action-cache.json if the workflow becomes reusable.",
  }, process.stderr);
  process.exitCode = 1;
}

#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadFinEnv } from "./lib/env.mjs";
import {
  defaultCdpUrl,
  ensureFinAuthReady,
} from "./business/finance-airdrop-reward/api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(skillRoot, "../..");
const frontendRegisterScript = path.join(repoRoot, "skills/weex-frontend-ops/scripts/frontend-register-api.mjs");
const finGrantScript = path.join(skillRoot, "scripts/finance-airdrop-reward-grant.mjs");

function parseArgs(argv) {
  const args = {
    count: 1,
    amount: "",
    currency: "USDT",
    emailPrefix: "codexapi",
    dryRun: false,
    confirmRegister: false,
    confirmRecharge: false,
    skipGrantDryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--count") args.count = Number(argv[++index] || 0);
    else if (value === "--amount") args.amount = argv[++index] || "";
    else if (value === "--currency") args.currency = argv[++index] || "";
    else if (value === "--email-prefix") args.emailPrefix = argv[++index] || "";
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--confirm-register") args.confirmRegister = true;
    else if (value === "--confirm-recharge") args.confirmRecharge = true;
    else if (value === "--skip-grant-dry-run") args.skipGrantDryRun = true;
    else if (value === "--help" || value === "-h") args.help = true;
  }
  return args;
}

function help() {
  return `Usage:
  node skills/weex-fin-admin-ops/scripts/batch-register-recharge.mjs --dry-run --count 3 --amount 1000
  node skills/weex-fin-admin-ops/scripts/batch-register-recharge.mjs --count 3 --amount 1000 --confirm-register --confirm-recharge

Creates STG frontend accounts, then grants and approves FIN Admin airdrop rewards.
FIN auth is checked headlessly first. The visible FIN page is opened only when login/session is invalid.`;
}

function assertArgs(args) {
  const missing = [];
  if (!Number.isInteger(args.count) || args.count < 1) missing.push("--count");
  if (!/^\d+(\.\d+)?$/.test(String(args.amount || "")) || Number(args.amount) <= 0) missing.push("--amount");
  if (!args.currency) missing.push("--currency");
  if (!args.emailPrefix) missing.push("--email-prefix");
  if (!args.dryRun && !args.confirmRegister) missing.push("--confirm-register");
  if (!args.dryRun && !args.confirmRecharge) missing.push("--confirm-recharge");
  if (missing.length) {
    console.log(JSON.stringify({ ok: false, missing, dryRun: args.dryRun }, null, 2));
    process.exit(args.dryRun ? 0 : 2);
  }
}

function runNode(commandArgs, env = process.env) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (result.status !== 0) {
    throw new Error(stderr || stdout || `Command failed: ${commandArgs.join(" ")}`);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Command returned non-JSON output: ${stdout.slice(0, 500)}`);
  }
}

async function ensureFinAuthForWrites() {
  const cdpUrl = defaultCdpUrl(process.env);
  process.env.WEEX_FIN_CDP_HEADLESS ??= "true";
  const result = await ensureFinAuthReady(cdpUrl, process.env);
  return {
    authMode: result.recovered ? "visible-login-fallback" : "headless",
    finalUrl: result.auth.url,
  };
}

function emailFor(args, index) {
  return `${args.emailPrefix}${Date.now()}${index}@weex.com`;
}

function frontendDryRun(args) {
  return runNode([frontendRegisterScript, "--dry-run", "--email", emailFor(args, "dryrun")]);
}

function registerAccount(args, index) {
  const result = runNode([
    frontendRegisterScript,
    "--confirm-register",
    "--email",
    emailFor(args, index),
  ]);
  if (!result.ok || !result.email || !result.userId) {
    throw new Error(`Frontend registration did not return email/userId for index ${index}`);
  }
  return { index, email: result.email, uid: String(result.userId) };
}

function grantDryRun(account, args) {
  return runNode([
    finGrantScript,
    "--dry-run",
    "--uid",
    account.uid,
    "--amount",
    args.amount,
    "--currency",
    args.currency,
  ]);
}

function grantRecharge(account, args) {
  return runNode([
    finGrantScript,
    "--uid",
    account.uid,
    "--amount",
    args.amount,
    "--currency",
    args.currency,
    "--confirm-create",
    "--confirm-approve",
  ]);
}

async function main() {
  loadFinEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${help()}\n`);
    return;
  }
  assertArgs(args);

  if (args.dryRun) {
    const frontend = frontendDryRun(args);
    let finAuth = null;
    let loginRequired = false;
    try {
      finAuth = await ensureFinAuthForWrites();
    } catch (error) {
      loginRequired = true;
      finAuth = { error: error.message };
    }
    console.log(JSON.stringify({
      ok: !loginRequired && frontend.ok,
      dryRun: true,
      operation: "batch_register_recharge",
      count: args.count,
      amount: args.amount,
      currency: args.currency,
      frontend,
      finAuth,
      loginRequired,
      writes: false,
    }, null, 2));
    return;
  }

  const finAuth = await ensureFinAuthForWrites();
  process.env.WEEX_FIN_DISABLE_VISIBLE_RECOVERY = "true";
  const accounts = [];
  const grants = [];
  for (let index = 1; index <= args.count; index += 1) {
    const account = registerAccount(args, index);
    accounts.push(account);
    const dryRun = args.skipGrantDryRun ? null : grantDryRun(account, args);
    const grant = grantRecharge(account, args);
    grants.push({
      index,
      email: account.email,
      uid: account.uid,
      orderId: grant.order?.orderId,
      amount: grant.order?.amount,
      coinName: grant.order?.coinName,
      status: grant.order?.status,
      statusDesc: grant.order?.statusDesc,
      approvalVerified: grant.approveEvidence?.approvalVerified ?? grant.approveEvidence?.approvedListHit ?? false,
      approvedListHit: grant.approveEvidence?.approvedListHit,
      pendingListHitAfterApprove: grant.approveEvidence?.pendingListHitAfterApprove,
      dryRunOk: dryRun ? dryRun.ok : null,
    });
  }

  console.log(JSON.stringify({
    ok: grants.length === args.count && grants.every(item => item.orderId),
    operation: "batch_register_recharge",
    finAuth,
    count: args.count,
    amount: args.amount,
    currency: args.currency,
    accounts,
    grants,
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, operation: "batch_register_recharge", error: error.message }, null, 2));
  process.exitCode = 1;
});

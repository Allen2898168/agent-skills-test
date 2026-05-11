import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(skillRoot, "../..");
const execFileAsync = promisify(execFile);

const batchRegisterRechargeScript = path.join(skillRoot, "scripts/batch-register-recharge.mjs");
const finGrantScript = path.join(skillRoot, "scripts/finance-airdrop-reward-grant.mjs");
const frontendRegisterScript = path.join(repoRoot, "skills/weex-frontend-ops/scripts/frontend-register-api.mjs");
const frontendTransferScript = path.join(repoRoot, "skills/weex-frontend-ops/scripts/frontend-assets-transfer.mjs");

export function runNode(commandArgs, env = process.env) {
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
  return parseJsonOutput(stdout);
}

export async function runNodeAsync(commandArgs, env = process.env) {
  try {
    const result = await execFileAsync(process.execPath, commandArgs, {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    });
    return parseJsonOutput(result.stdout);
  } catch (error) {
    const output = String(error.stderr || error.stdout || error.message || "").trim();
    throw new Error(output || `Command failed: ${commandArgs.join(" ")}`);
  }
}

export function batchArgs(args, dryRun = false) {
  const command = [
    batchRegisterRechargeScript,
    "--count",
    String(args.count),
    "--amount",
    String(args.amount),
    "--currency",
    String(args.currency),
    "--email-prefix",
    String(args.emailPrefix),
  ];
  if (dryRun) command.push("--dry-run");
  if (!dryRun || args.confirmRegister) command.push("--confirm-register");
  if (!dryRun || args.confirmRecharge) command.push("--confirm-recharge");
  if (args.skipGrantDryRun) command.push("--skip-grant-dry-run");
  return command;
}

export function transferArgs(args, dryRun = false) {
  const command = [
    frontendTransferScript,
    "--amount",
    String(args.amount),
    "--from-account-type",
    String(args.fromAccountType),
    "--to-account-type",
    String(args.toAccountType),
    "--transfer-coin-id",
    String(args.transferCoinId),
  ];
  if (dryRun) command.push("--dry-run");
  if (!dryRun || args.confirmTransfer) command.push("--confirm-transfer");
  return command;
}

export function emailFor(args, index, runId) {
  return `${args.emailPrefix}${runId}${index}@weex.com`;
}

export async function registerAccount(index, args, runId) {
  const result = await runNodeAsync([
    frontendRegisterScript,
    "--confirm-register",
    "--email",
    emailFor(args, index, runId),
  ]);
  if (!result.ok || !result.email || !result.userId) {
    throw new Error(`Frontend registration did not return email/userId for index ${index}`);
  }
  return { index, email: result.email, uid: String(result.userId) };
}

export async function grantRecharge(account, args) {
  const dryRun = args.skipGrantDryRun ? null : await runNodeAsync(grantArgs(account, args, true));
  const grant = await runNodeAsync(grantArgs(account, args, false));
  return summarizeGrant(account, grant, dryRun);
}

export async function transferForAccount(account, args) {
  const env = { ...process.env, WEEX_FRONTEND_USERNAME: account.email };
  const attempts = [];
  const maxAttempts = Math.max(1, Number(args.transferRetries || 0) + 1);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const transfer = await transferOnce(account, args, env);
    attempts.push({ attempt, response: transfer.response, ok: transfer.ok });
    if (transfer.ok || !isRetryableTransfer(transfer) || attempt === maxAttempts) {
      return { ...transfer, attempts };
    }
    await sleep(Number(args.transferRetryDelayMs || 0));
  }
}

async function transferOnce(account, args, env) {
  try {
    const transfer = await runNodeAsync(transferArgs(args, false), env);
    return {
      index: account.index,
      email: account.email,
      uid: account.uid,
      ok: transfer.ok,
      payload: transfer.payload,
      response: transfer.response,
    };
  } catch (error) {
    let parsed = null;
    try {
      parsed = JSON.parse(error.message);
    } catch {}
    return {
      index: account.index,
      email: account.email,
      uid: account.uid,
      ok: false,
      payload: parsed?.payload || null,
      response: parsed?.response || null,
      error: parsed?.error || error.message,
    };
  }
}

function isRetryableTransfer(transfer) {
  return ["70008", "20105"].includes(String(transfer.response?.code || ""));
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

function grantArgs(account, args, dryRun = false) {
  const command = [finGrantScript, "--uid", account.uid, "--amount", args.amount, "--currency", args.currency];
  if (dryRun) command.push("--dry-run");
  else command.push("--confirm-create", "--confirm-approve");
  return command;
}

function summarizeGrant(account, grant, dryRun) {
  return {
    index: account.index,
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
  };
}

function parseJsonOutput(stdout) {
  const text = String(stdout || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Command returned non-JSON output: ${text.slice(0, 800)}`);
  }
}

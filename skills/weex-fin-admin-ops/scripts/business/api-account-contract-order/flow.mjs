import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { help, parseArgs, validateArgs } from "./cli.mjs";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(skillRoot, "../..");
const systemAccountScript = path.join(skillRoot, "scripts/system-account-create.mjs");
const grantScript = path.join(skillRoot, "scripts/finance-airdrop-reward-grant.mjs");
const transferScript = path.join(repoRoot, "skills/weex-frontend-ops/scripts/frontend-assets-transfer.mjs");
const orderScript = path.join(repoRoot, "skills/weex-frontend-ops/scripts/frontend-contract-place-order.mjs");

function parseJson(text) {
  try {
    return JSON.parse(String(text || "").trim());
  } catch {
    throw new Error(`Command returned non-JSON output: ${String(text || "").slice(0, 500)}`);
  }
}

async function runNode(args, env = process.env) {
  try {
    const result = await execFileAsync(process.execPath, args, {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    });
    return parseJson(result.stdout);
  } catch (error) {
    const output = String(error.stdout || error.stderr || error.message || "").trim();
    throw new Error(output || `Command failed: ${args.join(" ")}`);
  }
}

function secretEnv(account) {
  return {
    ...process.env,
    WEEX_FRONTEND_USERNAME: account.email,
    WEEX_FRONTEND_PASSWORD: account.password,
    WEEX_FRONTEND_CONTRACT_API_BASE_URL: "https://stg-api-contract.weex.tech",
    WEEX_FRONTEND_CONTRACT_API_KEY: account.apiKey,
    WEEX_FRONTEND_CONTRACT_API_SECRET: account.secret,
    WEEX_FRONTEND_CONTRACT_API_PASSPHRASE: account.passphrase,
  };
}

function publicAccount(account) {
  return {
    userId: String(account.userId),
    email: account.email,
    accountId: String(account.accountId || ""),
  };
}

async function createAccount(args) {
  const result = await runNode([
    systemAccountScript,
    "--confirm-create",
    "--save-secrets",
    "--count",
    "1",
    "--user-type",
    args.userType,
    "--remark",
    args.remark,
    "--output-dir",
    args.outputDir,
  ]);
  const outputPath = result.outputs?.jsonPath;
  if (!outputPath || !fs.existsSync(outputPath)) throw new Error("System account output JSON was not created");
  const account = JSON.parse(fs.readFileSync(outputPath, "utf8")).accounts?.[0];
  if (!account?.apiKey || !account?.secret || !account?.passphrase || !account?.password) {
    throw new Error("System account output is missing API credentials or password");
  }
  return { result, account, outputPath };
}

async function grantMargin(account, args) {
  return runNode([
    grantScript,
    "--uid",
    String(account.userId),
    "--amount",
    String(args.fundAmount),
    "--confirm-create",
    "--confirm-approve",
    "--remark1",
    args.remark,
  ]);
}

async function transferMargin(account, args) {
  return runNode([
    transferScript,
    "--confirm-transfer",
    "--amount",
    String(args.fundAmount),
    "--from-account-type",
    "10",
    "--to-account-type",
    "8",
    "--transfer-coin-id",
    "2",
  ], secretEnv(account));
}

async function tickerPrice(account, symbol) {
  const result = await runNode([orderScript, "--ticker-only", "--symbol", symbol], secretEnv(account));
  const price = Number(result.response?.payload?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid ticker price for ${symbol}`);
  return price;
}

function calculatedQuantity(args, price) {
  if (args.quantity) return String(args.quantity);
  const quantity = Number(args.orderNotional) / price;
  return quantity.toFixed(args.quantityDecimals);
}

async function placeOrder(account, args, quantity) {
  return runNode([
    orderScript,
    "--confirm-order",
    "--symbol",
    args.symbol,
    "--side",
    args.side.toUpperCase(),
    "--position-side",
    args.positionSide.toUpperCase(),
    "--type",
    args.orderType.toUpperCase(),
    "--quantity",
    quantity,
  ], secretEnv(account));
}

async function checkBalance(account) {
  return runNode([orderScript, "--check-balance"], secretEnv(account));
}

function confirmations(args) {
  return {
    createAccount: args.confirmCreateAccount,
    recharge: args.confirmRecharge,
    transfer: args.confirmTransfer,
    order: args.confirmOrder,
  };
}

export async function runApiAccountFundContractOrder(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${help()}\n`);
    return;
  }
  validateArgs(args);
  const plan = {
    account: { count: 1, userType: args.userType, remark: args.remark },
    funding: { fundAmount: args.fundAmount, currency: "USDT", transfer: "spot account type 10 -> contract account type 8" },
    order: {
      symbol: args.symbol.toUpperCase(),
      side: args.side.toUpperCase(),
      positionSide: args.positionSide.toUpperCase(),
      type: args.orderType.toUpperCase(),
      orderNotional: args.quantity ? null : args.orderNotional,
      quantity: args.quantity || "calculated from ticker",
    },
    outputDir: args.outputDir,
    confirmations: confirmations(args),
  };
  if (args.dryRun || !Object.values(confirmations(args)).every(Boolean)) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      operation: "create_api_account_fund_contract_order",
      plan,
      confirmRequired: ["--confirm-create-account", "--confirm-recharge", "--confirm-transfer", "--confirm-order"],
    }, null, 2));
    return;
  }

  const created = await createAccount(args);
  const account = created.account;
  const grant = await grantMargin(account, args);
  const transfer = await transferMargin(account, args);
  const balanceBeforeOrder = await checkBalance(account);
  const price = await tickerPrice(account, args.symbol);
  const quantity = calculatedQuantity(args, price);
  const order = await placeOrder(account, args, quantity);
  const balanceAfterOrder = await checkBalance(account);
  console.log(JSON.stringify({
    ok: true,
    operation: "create_api_account_fund_contract_order",
    account: publicAccount(account),
    secretsOutputPath: created.outputPath,
    grant: {
      orderId: grant.order?.orderId,
      amount: grant.order?.amount,
      approvalVerified: grant.approveEvidence?.approvalVerified,
    },
    transfer: {
      ok: transfer.ok,
      code: transfer.response?.code,
      msg: transfer.response?.msg,
    },
    order: {
      symbol: args.symbol.toUpperCase(),
      side: args.side.toUpperCase(),
      positionSide: args.positionSide.toUpperCase(),
      type: args.orderType.toUpperCase(),
      price,
      requestedNotional: args.quantity ? null : args.orderNotional,
      quantity,
      orderId: order.response?.payload?.orderId,
      success: order.response?.payload?.success,
    },
    balanceBeforeOrder: balanceBeforeOrder.response?.payload,
    balanceAfterOrder: balanceAfterOrder.response?.payload,
  }, null, 2));
}

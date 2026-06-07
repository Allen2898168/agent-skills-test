import fs from "node:fs";
import path from "node:path";
import { defaultCdpUrl, ensureFinAuthReady, postFin, assertBusinessOk } from "../finance-airdrop-reward/api.mjs";
import { help, parseArgs, validateArgs } from "./cli.mjs";

function repoRoot() {
  return path.resolve(new URL(".", import.meta.url).pathname, "../../../../..");
}

function clientId() {
  return Number(`${Date.now()}.${Math.floor(Math.random() * 10000)}`);
}

function createPayload(args, id) {
  return {
    number: args.count,
    remark: args.remark,
    userType: args.userType,
    tagId: args.tagId,
    password: "",
    googleCode: "",
    clientId: id,
    isSystem: args.isSystem,
    isGray: args.isGray,
    isInternal: args.isInternal,
    isSpotPro: args.isSpotPro,
    isFirstTime: args.isFirstTime,
    site: args.site,
    selectPassword: "",
    authorities: args.authorities,
  };
}

function publicAccount(account) {
  return {
    userId: String(account.userId),
    email: account.email,
    accountId: String(account.accountId || ""),
    authorities: account.authorities || [],
  };
}

function secretAccount(account) {
  return {
    userId: String(account.userId),
    email: account.email,
    password: account.password,
    googleCode: account.googleCode,
    spotAccountId: account.spotAccountId,
    accountId: String(account.accountId || ""),
    inviteCode: account.inviteCode,
    authorities: account.authorities || [],
    apiKey: account.apiKey,
    secret: account.secret,
    passphrase: account.passphrase,
  };
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeOutputs(args, accounts) {
  const absoluteDir = path.isAbsolute(args.outputDir) ? args.outputDir : path.join(repoRoot(), args.outputDir);
  fs.mkdirSync(absoluteDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "").replace(/-/g, "").slice(0, 15);
  const base = path.join(absoluteDir, `fin-system-accounts-api-${accounts.length}-${stamp}`);
  const secretRows = accounts.map(secretAccount);
  const jsonPath = `${base}.json`;
  fs.writeFileSync(jsonPath, JSON.stringify({
    ok: true,
    count: accounts.length,
    containsSecrets: true,
    createdAt: new Date().toISOString(),
    accounts: secretRows,
  }, null, 2));
  const headers = ["UID", "邮箱", "密码", "谷歌码", "合约账号ID", "API权限", "访问密钥(APIKey)", "访问密钥(Secret)", "Passphrase(API口令)"];
  const csvRows = [
    headers,
    ...secretRows.map(item => [
      item.userId,
      item.email,
      item.password,
      item.googleCode,
      item.accountId,
      (item.authorities || []).join("|"),
      item.apiKey,
      item.secret,
      item.passphrase,
    ]),
  ];
  const csvPath = `${base}.csv`;
  fs.writeFileSync(csvPath, csvRows.map(row => row.map(csvEscape).join(",")).join("\n"));
  return { jsonPath, csvPath };
}

async function waitForCompletion(auth, id, args) {
  const deadline = Date.now() + args.pollTimeoutMs;
  let lastResponse = null;
  while (Date.now() < deadline) {
    lastResponse = await postFin(auth, "/admin/fin/asset/system/account/add_progress", { clientId: String(id) });
    assertBusinessOk(lastResponse, "system account add_progress");
    if (lastResponse.data === true) return true;
    await new Promise(resolve => setTimeout(resolve, args.pollIntervalMs));
  }
  throw new Error(`Timed out waiting for account creation completion. Last progress: ${JSON.stringify(lastResponse)}`);
}

async function fetchTemporaryAccounts(auth, id, expectedCount) {
  const response = await postFin(auth, "/admin/fin/asset/system/account/temporary/list", { clientId: id });
  assertBusinessOk(response, "system account temporary/list");
  const accounts = Array.isArray(response.data) ? response.data : [];
  if (accounts.length < expectedCount) {
    throw new Error(`temporary/list returned ${accounts.length} accounts, expected ${expectedCount}`);
  }
  return accounts;
}

export async function runSystemAccountCreate(argv, env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${help()}\n`);
    return;
  }
  validateArgs(args);
  const id = clientId();
  const payload = createPayload(args, id);
  const plan = {
    endpoint: "/admin/fin/asset/system/account/add",
    count: args.count,
    userType: args.userType,
    remark: args.remark,
    tagId: args.tagId,
    site: args.site,
    authorities: args.authorities.split(","),
    accountType: args.isSpotPro ? "spotPro" : "contract",
    saveSecrets: args.saveSecrets,
    outputDir: args.outputDir,
  };
  if (args.dryRun || !args.confirmCreate) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      operation: "fin_system_account_create",
      plan,
      confirmRequired: ["--confirm-create", "--save-secrets to persist returned account credentials locally"],
    }, null, 2));
    return;
  }
  const { auth } = await ensureFinAuthReady(defaultCdpUrl(env), env);
  const createResponse = await postFin(auth, "/admin/fin/asset/system/account/add", payload);
  assertBusinessOk(createResponse, "system account add");
  await waitForCompletion(auth, id, args);
  const accounts = await fetchTemporaryAccounts(auth, id, args.count);
  const outputs = args.saveSecrets ? writeOutputs(args, accounts) : null;
  console.log(JSON.stringify({
    ok: true,
    operation: "fin_system_account_create",
    count: accounts.length,
    accounts: accounts.map(publicAccount),
    outputs,
    secretsSaved: Boolean(outputs),
  }, null, 2));
}

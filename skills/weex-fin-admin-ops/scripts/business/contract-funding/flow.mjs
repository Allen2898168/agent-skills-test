import { assertArgs, help, parseArgs, resolveConcurrency } from "./cli.mjs";
import {
  batchArgs,
  grantRecharge,
  registerAccount,
  runNode,
  transferArgs,
  transferForAccount,
} from "./commands.mjs";

export async function runRegisterRechargeTransferContract(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${help()}\n`);
    return;
  }
  assertArgs(args);
  const concurrency = resolveConcurrency(args);

  if (args.dryRun) {
    const batch = runNode(batchArgs(args, true));
    const transfer = runNode(transferArgs(args, true), {
      ...process.env,
      WEEX_FRONTEND_USERNAME: `${args.emailPrefix}${Date.now()}dryrun@weex.com`,
    });
    console.log(JSON.stringify({
      ok: Boolean(batch.ok && transfer.ok),
      dryRun: true,
      operation: "register_recharge_transfer_contract",
      targetState: "new STG frontend account contract balance receives requested USDT amount",
      count: args.count,
      amount: args.amount,
      currency: args.currency,
      concurrency,
      transfer: {
        fromAccountType: Number(args.fromAccountType),
        toAccountType: Number(args.toAccountType),
        transferCoinId: String(args.transferCoinId),
      },
      batchRegisterRecharge: batch,
      frontendTransfer: transfer,
      writes: false,
    }, null, 2));
    return;
  }

  const runId = Date.now();
  const results = await runPool(args.count, concurrency, index => processAccount(index, args, runId));
  const accounts = results.map(item => item.account).filter(Boolean);
  const grants = results.map(item => item.grant).filter(Boolean);
  const transfers = results.map(item => item.transfer).filter(Boolean);
  const ok = results.length === args.count && results.every(item => item.ok);
  console.log(JSON.stringify({
    ok,
    operation: "register_recharge_transfer_contract",
    targetState: "new STG frontend account contract balance receives requested USDT amount",
    count: args.count,
    amount: args.amount,
    currency: args.currency,
    concurrency,
    results,
    accounts,
    grants,
    transfers,
  }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function processAccount(index, args, runId) {
  const result = {
    index,
    ok: false,
    account: null,
    grant: null,
    transfer: null,
    failedStage: null,
    error: null,
  };
  try {
    result.account = await registerAccount(index, args, runId);
  } catch (error) {
    return fail(result, "register", error);
  }
  try {
    result.grant = await grantRecharge(result.account, args);
  } catch (error) {
    return fail(result, "recharge", error);
  }
  result.transfer = await transferForAccount(result.account, args);
  if (!result.transfer.ok) {
    result.failedStage = "transfer";
    result.error = result.transfer.error || result.transfer.response?.msg || "transfer failed";
    return result;
  }
  result.ok = true;
  return result;
}

async function runPool(count, concurrency, worker) {
  const results = new Array(count);
  let nextIndex = 1;
  const workerCount = Math.min(concurrency, count);
  async function runWorker() {
    while (nextIndex <= count) {
      const index = nextIndex;
      nextIndex += 1;
      results[index - 1] = await worker(index);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

function fail(result, failedStage, error) {
  result.failedStage = failedStage;
  result.error = error.message;
  return result;
}

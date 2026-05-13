#!/usr/bin/env node
import { loadFinEnv } from "./lib/env.mjs";
import { runApiAccountFundContractOrder } from "./business/api-account-contract-order/flow.mjs";

loadFinEnv();
runApiAccountFundContractOrder(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

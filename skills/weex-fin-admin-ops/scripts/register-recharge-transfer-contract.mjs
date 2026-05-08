#!/usr/bin/env node
import { runRegisterRechargeTransferContract } from "./business/contract-funding/flow.mjs";
import { loadFinEnv } from "./lib/env.mjs";

loadFinEnv();
runRegisterRechargeTransferContract(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ ok: false, operation: "register_recharge_transfer_contract", error: error.message }, null, 2));
  process.exitCode = 1;
});

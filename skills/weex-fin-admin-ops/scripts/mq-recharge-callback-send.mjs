#!/usr/bin/env node
import { runMqRechargeCallbackSend } from "./business/mq-recharge/flow.mjs";
import { loadFinEnv } from "./lib/env.mjs";

loadFinEnv();
runMqRechargeCallbackSend(process.argv.slice(2), process.env).catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

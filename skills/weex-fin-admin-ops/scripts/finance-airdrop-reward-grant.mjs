#!/usr/bin/env node
import { runFinanceAirdropRewardGrant } from "./business/finance-airdrop-reward/grant.mjs";
import { loadFinEnv } from "./lib/env.mjs";

loadFinEnv();
runFinanceAirdropRewardGrant(process.argv.slice(2), process.env).catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

#!/usr/bin/env node
import { loadFinEnv } from "./lib/env.mjs";
import { runSystemAccountCreate } from "./business/system-account/create.mjs";

loadFinEnv();
runSystemAccountCreate(process.argv.slice(2)).catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

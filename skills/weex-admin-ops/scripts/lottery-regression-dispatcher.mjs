#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "../../../orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs";

export * from "../../../orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../../../orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs";

export * from "../../../orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await run();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

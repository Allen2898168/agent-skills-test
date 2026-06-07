#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../..", "..");

function main() {
  const args = process.argv.slice(2);
  const commandArgs = ["orchestrations/full-regression/scripts/run-full-regression.mjs", ...args];
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

process.exitCode = main();


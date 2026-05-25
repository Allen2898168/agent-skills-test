#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const targetScript = path.join(repoRoot, "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs");

const result = spawnSync(process.execPath, [targetScript, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

process.exitCode = result.status ?? 1;

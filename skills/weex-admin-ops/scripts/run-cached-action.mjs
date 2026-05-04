#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson, readJson } from "./lib/cli.mjs";
import { commandFor } from "./cache/command.mjs";
import { matchAction } from "./cache/matcher.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(__dirname, "action-cache.json");

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/run-cached-action.mjs --list
  node skills/weex-admin-ops/scripts/run-cached-action.mjs --query "创建3个ETH币种奖励"
  node skills/weex-admin-ops/scripts/run-cached-action.mjs --action create_prizes --category 币种 --subtype ETH --count 3

Options:
  --query <text>       Natural-language request to match against cached actions
  --action <id>        Cached action id
  --list              List cached actions
  --visible           Force headed browser mode when the target script supports it
  --dry-run           Show matched command without executing browser operations
  --category <text>   Prize category for create_prizes
  --subtype <text>    Prize subtype for create_prizes
  --count <n>         Count for create_prizes
  --name-prefix <x>   Name prefix for create_prizes
  --alias-prefix <x>  Alias prefix for create_prizes
`;
}

function parseCacheArgs() {
  const parsed = parseFlags(process.argv.slice(2), { booleans: ["--list", "--visible", "--dry-run"] });
  const passthrough = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!["help", "list", "visible", "dryRun", "query", "action"].includes(key)) passthrough[key] = value;
  }
  return { ...parsed, passthrough };
}

function runMatchedCommand(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: path.resolve(skillRoot, "../.."),
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

function main() {
  const args = parseCacheArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const manifest = readJson(manifestPath);
  if (args.list) {
    printJson({ ok: true, actions: manifest.actions });
    return 0;
  }
  const match = matchAction(manifest, args);
  const { commandArgs } = commandFor(match, args, skillRoot);
  if (args.dryRun) {
    printJson({ ok: true, cachedAction: match.action.id, score: match.score, command: [process.execPath, ...commandArgs] });
    return 0;
  }
  return runMatchedCommand(commandArgs);
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    cacheMatched: false,
    error: error.message,
    fallback: "Use web-access or conventional browser automation, then update scripts/action-cache.json if the workflow becomes reusable.",
  }, process.stderr);
  process.exitCode = 1;
}

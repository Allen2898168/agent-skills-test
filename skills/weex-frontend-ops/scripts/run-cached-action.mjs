#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(__dirname, 'action-cache.json');

function parseArgs(argv) {
  const args = { dryRun: false, query: '', action: '', passthrough: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--') {
      args.passthrough = argv.slice(index + 1);
      break;
    } else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--query') args.query = argv[++index] || '';
    else if (value === '--action') args.action = argv[++index] || '';
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

function loadCache() {
  return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
}

function printHelp() {
  console.log(`Usage: node scripts/run-cached-action.mjs --query "<request>" --dry-run
       node scripts/run-cached-action.mjs --action <action_id> --dry-run
       node scripts/run-cached-action.mjs --action <action_id> -- [script args]

Runs frontend cached actions from scripts/action-cache.json. Use --dry-run before execution.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const cache = loadCache();
const actions = Array.isArray(cache.actions) ? cache.actions : [];
const match = args.action
  ? actions.find((action) => action.id === args.action)
  : actions.find((action) => {
      const keywords = Array.isArray(action.keywords) ? action.keywords : [];
      return keywords.some((keyword) => args.query.includes(keyword));
    });

if (!match) {
  console.log(JSON.stringify({
    ok: false,
    reason: 'no_cached_frontend_action',
    dryRun: args.dryRun,
    query: args.query,
    action: args.action,
    availableActions: actions.map((action) => action.id)
  }, null, 2));
  process.exit(2);
}

console.log(JSON.stringify({
  ok: true,
  dryRun: args.dryRun,
  matchedAction: match
}, null, 2));

if (!match.script) {
  process.exit(0);
}

const scriptPath = path.join(__dirname, '..', match.script);
if (!fs.existsSync(scriptPath)) {
  console.error(`Cached action script not found: ${match.script}`);
  process.exit(1);
}

const scriptArgs = [...args.passthrough];
if (args.dryRun && !scriptArgs.includes('--dry-run')) {
  scriptArgs.unshift('--dry-run');
}

const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);

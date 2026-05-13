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
const executionRoot = path.basename(path.dirname(skillRoot)) === "skills"
  ? path.resolve(skillRoot, "../..")
  : skillRoot;

function usage() {
  return `Usage:
  node scripts/run-cached-action.mjs --list
  node scripts/run-cached-action.mjs --query "创建3个ETH币种奖励"
  node scripts/run-cached-action.mjs --action create_prizes --category 币种 --subtype ETH --count 3

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
  --scopes <csv>      Scopes for create_roulette_participant_scope_tasks
  --uid <uid>         UID for agent/user participant scopes
  --country <text>    Country/region for country participant scope
  --country-first     Choose first country/region option
  --signup-modes <csv> Signup modes for create_register_templates
  --min-team <n>      Minimum team size for team signup mode
  --permissions <csv> Permission limits for create_register_templates: signup,view
  --people-limit <n>  Optional registration people limit
  --include-none      Include guide-template 暂无特殊配置/NONE known blocked branch
  --mode-label <text> Name prefix for create_guide_templates
  --activity-types <csv> Activity types for create_guide_templates
  --frequencies <csv> Frequencies for create_guide_templates
  --steps <csv>      Step counts for create_guide_templates, 1-3
  --operator <name>   Recent editor/operator for delete_register_templates_by_operator
  --confirm-delete    Required by delete_register_templates_by_operator for actual deletion
  --title-exact <x>   Exact title for create_lottery_activity_draft
  --title-prefix <x>  Title prefix for create_lottery_activity_draft dry-run plan
  --subtitle <x>      Exact subtitle for create_lottery_activity_draft
  --alias-exact <x>   Exact alias for create_lottery_activity_draft
  --alias-prefix <x>  Alias prefix for create_lottery_activity_draft dry-run plan
  --start <text>      Planned start time for create_lottery_activity_draft
  --end <text>        Planned end time for create_lottery_activity_draft
  --style <text>      Lottery style for create_lottery_activity_draft
  --activity-task-labels <text> Task labels/ids for create_lottery_activity_draft, separated by | or comma
  --no-preapply       Disable pre-apply for create_lottery_activity_draft
  --activity-alias <x> Activity alias/showUrl for online_lottery_activity
  --activity-id <id>  Activity id for online_lottery_activity
  --uid <uid>         Default uid for lottery_admin_main_regression task setup
  --country <text>    Default country for lottery_admin_main_regression country scope
`;
}

function parseCacheArgs() {
  const parsed = parseFlags(process.argv.slice(2), { booleans: ["--list", "--visible", "--dry-run", "--country-first", "--confirm-delete", "--no-preapply"] });
  const passthrough = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!["help", "list", "visible", "dryRun", "query", "action"].includes(key)) passthrough[key] = value;
  }
  return { ...parsed, passthrough };
}

function runMatchedCommand(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: executionRoot,
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

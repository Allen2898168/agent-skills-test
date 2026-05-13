#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildLotteryDraftPlan } from "./business/activity-management/lottery-draft-plan.mjs";
import { spawn } from "node:child_process";
import path from "node:path";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-lottery-activity-draft.mjs --dry-run
  node scripts/create-lottery-activity-draft.mjs --visible --dry-run
  node scripts/create-lottery-activity-draft.mjs --visible
  node scripts/create-lottery-activity-draft.mjs --headless-ui

Options:
  --visible                 mark the intended mode as headed browser mode
  --headless-ui             run the same real UI workflow in headless browser mode
  --title-exact <text>      exact activity title, no timestamp suffix
  --title-prefix <text>     activity title prefix
  --subtitle <text>         exact activity subtitle
  --alias-exact <text>      exact activity alias, no timestamp suffix
  --alias-prefix <text>     activity alias prefix
  --start <text>            planned activity start time
  --end <text>              planned activity end time
  --preapply-start <text>   planned pre-apply start time
  --preapply-end <text>     planned pre-apply end time
  --style <text>            lottery style label, e.g. 圆形转盘, 彩蛋
  --activity-task-labels <text>
                            activity task labels/ids separated by | or comma
  --no-preapply             select 不支持 for 是否支持预报名
  --dry-run                 print the verified creation plan without writing data
  --help                    show this message

Safety:
  --dry-run prints the verified plan without writing data.
  Actual creation uses the strict UI browser workflow. Use --visible for headed UI
  or --headless-ui for headless real UI clicks.
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--headless-ui", "--dry-run", "--no-preapply"] });
  args.visible = Boolean(args.visible);
  args.headlessUi = Boolean(args["headless-ui"] || args.headlessUi);
  args.dryRun = Boolean(args.dryRun);
  return args;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildLotteryDraftPlan(args);
  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      baseUrl: config.baseUrl,
      username: config.username,
      plan,
    });
    return 0;
  }
  if (!args.visible && !args.headlessUi) {
    printJson({
      ok: false,
      dryRun: false,
      error: "create_lottery_activity_draft actual writes require --visible or --headless-ui because this workflow uses real UI browser actions.",
      operationReference: "references/operations/activity-management-lottery.md",
      plan,
    }, process.stderr);
    return 1;
  }
  const strictUiScript = path.join(repoRoot, "skills/weex-admin-ops/scripts/strict-lottery-visible-attempt.mjs");
  return runNodeScript(strictUiScript, buildStrictUiEnv(args));
}

function buildStrictUiEnv(args) {
  return {
    ...process.env,
    ...(args.titlePrefix ? { LOTTERY_TITLE_PREFIX: String(args.titlePrefix) } : {}),
    ...(args.aliasPrefix ? { LOTTERY_ALIAS_PREFIX: String(args.aliasPrefix) } : {}),
    ...(args.start ? { LOTTERY_START: String(args.start) } : {}),
    ...(args.end ? { LOTTERY_END: String(args.end) } : {}),
    ...(args.preapplyStart ? { LOTTERY_PREAPPLY_START: String(args.preapplyStart) } : {}),
    ...(args.preapplyEnd ? { LOTTERY_PREAPPLY_END: String(args.preapplyEnd) } : {}),
    ...(args.style ? { LOTTERY_STYLE: String(args.style) } : {}),
    ...(args.noPreapply ? { LOTTERY_PREAPPLY: "0" } : {}),
    ...(args.headlessUi ? { LOTTERY_HEADLESS: "1" } : {}),
  };
}

function runNodeScript(script, env = process.env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script], {
      stdio: "inherit",
      cwd: repoRoot,
      env,
    });
    child.on("error", error => {
      printJson({ ok: false, error: error.message, script }, process.stderr);
      resolve(1);
    });
    child.on("exit", code => resolve(code ?? 1));
  });
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

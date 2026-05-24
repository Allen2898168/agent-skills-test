#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import {
  buildScenarioMenu,
  collectAutomationCaseIdsForScenarios,
  loadLotteryRegressionManifest,
  resolveScenarioSelection,
} from "./lib/lottery-regression-manifest.mjs";
import { resolvePreconditions } from "./lib/lottery-precondition-resolver.mjs";
import { summarizeDispatcherResult } from "./lib/lottery-result-reporter.mjs";

const { repoRoot, skillRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/lottery-regression-dispatcher.mjs --menu
  node skills/weex-admin-ops/scripts/lottery-regression-dispatcher.mjs --selection "奖品管理,活动配置 / 活动信息" --dry-run
  node skills/weex-admin-ops/scripts/lottery-regression-dispatcher.mjs --all --dry-run

Options:
  --menu                print the grouped scenario menu and exit
  --selection <text>    scenario/group selection, supports single or multiple values
  --all                 select all runnable scenarios from the manifest policy
  --activity-alias <t>  reuse an existing online activity alias for frontend regression
  --recharge-amount <n> override mq recharge amount for frontend regression
  --wait-for-start-ms <n>
                        override frontend activity-start wait window in milliseconds
  --visible             pass visible mode to executable child workflows
  --dry-run             print the execution plan without running child workflows
  --help                show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--menu", "--all", "--visible", "--dry-run"] });
  args.menu = Boolean(args.menu);
  args.all = Boolean(args.all);
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  return args;
}

function parseLastJson(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  let last = null;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{") continue;
    const candidate = source.slice(index);
    try {
      last = JSON.parse(candidate);
    } catch {}
  }
  return last;
}

function runChild(commandArgs) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutLineBuffer = "";
    const flushProgressLines = force => {
      const source = force ? stdoutLineBuffer : stdoutLineBuffer.replace(/\r/g, "");
      const parts = source.split("\n");
      stdoutLineBuffer = force ? "" : parts.pop() ?? "";
      for (const part of force ? parts.filter(Boolean) : parts) {
        const line = String(part || "").trim();
        if (!line) continue;
        if (/^\{"step":/.test(line)) process.stderr.write(`${line}\n`);
      }
    };
    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      stdout += text;
      stdoutLineBuffer += text;
      flushProgressLines(false);
    });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", error => {
      const nextStderr = `${stderr}${error.message}\n`;
      resolve({
        ok: false,
        exitCode: 1,
        payload: parseLastJson(stdout) || parseLastJson(nextStderr),
        stdout,
        stderr: nextStderr,
      });
    });
    child.on("close", code => {
      flushProgressLines(true);
      const payload = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({
        ok: (code ?? 1) === 0 && payload?.ok !== false,
        exitCode: code ?? 1,
        payload,
        stdout,
        stderr,
      });
    });
  });
}

export function buildEntrypointCommands(selectedScenarios, args) {
  const buckets = new Map();
  for (const scenario of selectedScenarios) {
    if (!scenario.entrypoint) continue;
    if (!buckets.has(scenario.entrypoint)) buckets.set(scenario.entrypoint, []);
    buckets.get(scenario.entrypoint).push(scenario);
  }
  return Array.from(buckets.entries()).map(([entrypoint, scenarios]) => {
    if (entrypoint === "lottery_admin_main_regression") {
      const childPath = path.join(skillRoot, "scripts/lottery-admin-main-regression.mjs");
      const caseIds = collectAutomationCaseIdsForScenarios(scenarios);
      if (!caseIds.length) return { entrypoint, scenarios, commandArgs: [] };
      const commandArgs = [childPath, "--case-ids", caseIds.join(",")];
      if (args.visible) commandArgs.push("--visible");
      if (args.dryRun) commandArgs.push("--dry-run");
      return { entrypoint, scenarios, commandArgs };
    }
    if (entrypoint === "lottery_frontend_main_regression") {
      const childPath = path.join(skillRoot, "scripts/lottery-frontend-main-regression.mjs");
      const caseIds = collectAutomationCaseIdsForScenarios(scenarios);
      if (!caseIds.length) return { entrypoint, scenarios, commandArgs: [] };
      const commandArgs = [childPath, "--case-ids", caseIds.join(",")];
      if (args.activityAlias) commandArgs.push("--activity-alias", String(args.activityAlias));
      if (args.rechargeAmount) commandArgs.push("--recharge-amount", String(args.rechargeAmount));
      if (args.waitForStartMs) commandArgs.push("--wait-for-start-ms", String(args.waitForStartMs));
      if (args.visible) commandArgs.push("--visible");
      if (args.dryRun) commandArgs.push("--dry-run");
      return { entrypoint, scenarios, commandArgs };
    }
    {
      return { entrypoint, scenarios, commandArgs: [] };
    }
  });
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const manifest = loadLotteryRegressionManifest();
  if (args.menu) {
    printJson({
      ok: true,
      actionId: "lottery_regression_dispatcher",
      mode: "menu",
      groups: buildScenarioMenu(manifest),
    });
    return 0;
  }

  const selection = args.all
    ? resolveScenarioSelection("全部", manifest)
    : resolveScenarioSelection(args.selection || "", manifest);

  if (!selection.selectedScenarios.length) {
    printJson({
      ok: false,
      actionId: "lottery_regression_dispatcher",
      error: "No runnable scenarios were selected.",
      requested: selection.requested,
      unresolved: selection.unresolved,
      groups: buildScenarioMenu(manifest),
    }, process.stderr);
    return 1;
  }

  const preconditions = resolvePreconditions(selection.selectedScenarios, manifest);
  const entryExecutions = buildEntrypointCommands(selection.selectedScenarios, args);

  if (args.dryRun) {
    printJson({
      ok: true,
      actionId: "lottery_regression_dispatcher",
      mode: "dry_run",
      requested: selection.requested,
      unresolved: selection.unresolved,
      selectedScenarios: selection.selectedScenarios.map(item => ({
        scenarioId: item.scenarioId,
        title: item.title,
        status: item.status,
        entrypoint: item.entrypoint || "",
        caseIds: item.caseIds || [],
        automationCaseIds: item.automationCaseIds || [],
      })),
      preconditions,
      executions: entryExecutions.map(item => ({
        entrypoint: item.entrypoint,
        scenarioIds: item.scenarios.map(entry => entry.scenarioId),
        command: [process.execPath, ...item.commandArgs],
      })),
    });
    return 0;
  }

  const executionResults = [];
  for (const execution of entryExecutions) {
    if (!execution.commandArgs.length) {
      executionResults.push({
        entrypoint: execution.entrypoint,
        ok: false,
        context: { scenarioIds: execution.scenarios.map(item => item.scenarioId) },
        caseResults: [],
      });
      continue;
    }
    const result = await runChild(execution.commandArgs);
    executionResults.push({
      entrypoint: execution.entrypoint,
      ok: result.ok,
      context: {
        scenarioIds: execution.scenarios.map(item => item.scenarioId),
        command: [process.execPath, ...execution.commandArgs],
      },
      phaseResults: result.payload?.phaseResults || [],
      caseResults: result.payload?.caseResults || [],
      raw: result.payload,
    });
  }

  const report = summarizeDispatcherResult({
    selectedScenarios: selection.selectedScenarios,
    manifest,
    executionResults,
  });

  printJson({
    ok: !report.summary.caseStatusCounts.FAIL,
    actionId: "lottery_regression_dispatcher",
    requested: selection.requested,
    unresolved: selection.unresolved,
    preconditions,
    ...report,
  });
  return report.summary.caseStatusCounts.FAIL ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    printJson({ ok: false, error: error.message }, process.stderr);
    process.exitCode = 1;
  }
}

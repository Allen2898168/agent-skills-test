#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "../lib/cli.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";
import {
  buildScenarioMenu,
  collectAutomationCaseIdsForScenarios,
  loadLotteryRegressionManifest,
  resolveScenarioSelection,
} from "../lib/lottery-regression-manifest.mjs";
import { resolvePreconditions } from "../lib/lottery-precondition-resolver.mjs";
import { summarizeDispatcherResult } from "../lib/lottery-result-reporter.mjs";

const currentFile = fileURLToPath(import.meta.url);
const orchestrationRoot = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(orchestrationRoot, "../..");

function usage() {
  return `Usage:
  node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --menu
  node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --selection "奖品管理,活动配置 / 活动信息" --dry-run
  node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --all --dry-run
  node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --all --full

Options:
  --menu                print the grouped scenario menu and exit
  --selection <text>    scenario/group selection, supports single or multiple values
  --all                 select all runnable scenarios from the manifest policy
  --full                include planned/blocked scenarios in the report (they will be marked as skipped if not automated)
  --concurrency <n>     max parallel entrypoints to run (default 2, max 10)
  --admin-concurrency <n>
                        max parallel phases for admin regression (default 1, max 10)
  --activity-alias <t>  reuse an existing online activity alias for frontend regression (legacy, maps to normal)
  --normal-activity-alias <t>
                        alias for 普通回归活动 (NORMAL_ACTIVITY_ONLINE)
  --weight-activity-alias <t>
                        alias for 二次权重活动 (WEIGHT_ACTIVITY_ONLINE)
  --stock-activity-alias <t>
                        alias for 小库存活动 (LOW_STOCK_ACTIVITY_ONLINE)
  --recharge-amount <n> override mq recharge amount for frontend regression
  --wait-for-start-ms <n>
                        override frontend activity-start wait window in milliseconds
  --visible             pass visible mode to executable child workflows
  --dry-run             print the execution plan without running child workflows
  --help                show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--menu", "--all", "--full", "--visible", "--dry-run"] });
  args.menu = Boolean(args.menu);
  args.all = Boolean(args.all);
  args.full = Boolean(args.full);
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.concurrency = Math.max(1, Math.min(10, Number(args.concurrency || 2)));
  args.adminConcurrency = Math.max(1, Math.min(10, Number(args.adminConcurrency || 1)));
  args.normalActivityAlias = String(args.normalActivityAlias || args.activityAlias || "");
  args.weightActivityAlias = String(args.weightActivityAlias || "");
  args.stockActivityAlias = String(args.stockActivityAlias || "");
  return args;
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
  return Array.from(buckets.entries()).flatMap(([entrypoint, scenarios]) => {
    if (entrypoint === "lottery_admin_main_regression") {
      const childPath = path.join(repoRoot, "skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs");
      const caseIds = collectAutomationCaseIdsForScenarios(scenarios);
      if (!caseIds.length) return { entrypoint, scenarios, commandArgs: [] };
      const commandArgs = [childPath, "--case-ids", caseIds.join(",")];
      if (args.adminConcurrency) commandArgs.push("--concurrency", String(args.adminConcurrency));
      if (args.visible) commandArgs.push("--visible");
      if (args.dryRun) commandArgs.push("--dry-run");
      return [{ entrypoint, scenarios, commandArgs, resources: ["ADMIN_SESSION"] }];
    }
    if (entrypoint === "lottery_frontend_main_regression") {
      const childPath = path.join(orchestrationRoot, "scripts/lottery-frontend-main-regression.mjs");
      const partitions = {
        normal: [],
        weight: [],
        stock: [],
      };
      const isWeightScenario = scenario => (scenario.preconditions || []).some(item => (
        item === "WEIGHT_ACTIVITY_ONLINE" || item === "WEIGHT_ACTIVITY_DRAW_GE3"
      ));
      const isStockScenario = scenario => (scenario.preconditions || []).some(item => (
        item === "LOW_STOCK_ACTIVITY_ONLINE" || item === "LOW_STOCK_ACTIVITY_DRAW_GT5"
      ));
      for (const scenario of scenarios) {
        if (isWeightScenario(scenario)) partitions.weight.push(scenario);
        else if (isStockScenario(scenario)) partitions.stock.push(scenario);
        else partitions.normal.push(scenario);
      }
      const executions = [];
      const addPartition = (label, partitionScenarios, activityAlias) => {
        const caseIds = collectAutomationCaseIdsForScenarios(partitionScenarios);
        if (!caseIds.length) return;
        const commandArgs = [childPath, "--case-ids", caseIds.join(",")];
        if (activityAlias) commandArgs.push("--activity-alias", String(activityAlias));
        if (args.rechargeAmount) commandArgs.push("--recharge-amount", String(args.rechargeAmount));
        if (args.waitForStartMs) commandArgs.push("--wait-for-start-ms", String(args.waitForStartMs));
        if (args.visible) commandArgs.push("--visible");
        if (args.dryRun) commandArgs.push("--dry-run");
        executions.push({
          entrypoint,
          scenarios: partitionScenarios,
          commandArgs,
          partition: label,
          resources: activityAlias ? [] : ["ADMIN_SESSION"],
        });
      };
      addPartition("normal", partitions.normal, args.normalActivityAlias || args.activityAlias);
      addPartition("weight", partitions.weight, args.weightActivityAlias);
      addPartition("stock", partitions.stock, args.stockActivityAlias);
      return executions;
    }
    {
      return [{ entrypoint, scenarios, commandArgs: [], resources: [] }];
    }
  });
}

function hasResourceConflict(execution, runningExecutions) {
  const requested = new Set(execution.resources || []);
  if (!requested.size) return false;
  for (const active of runningExecutions.values()) {
    for (const resource of active.resources || []) {
      if (requested.has(resource)) return true;
    }
  }
  return false;
}

export async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

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

  const selection = (() => {
    if (!args.all) return resolveScenarioSelection(args.selection || "", manifest);
    if (!args.full) return resolveScenarioSelection("全部", manifest);
    return {
      mode: "all_full",
      requested: ["全部", "full"],
      selectedScenarios: (manifest.scenarioCatalog || []),
      unresolved: [],
    };
  })();

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
  const pending = [...entryExecutions];
  const running = new Map();

  async function runExecution(execution) {
    if (!execution.commandArgs.length) {
      return {
        entrypoint: execution.entrypoint,
        ok: false,
        context: { scenarioIds: execution.scenarios.map(item => item.scenarioId) },
        caseResults: [],
      };
    }
    const result = await runChild(execution.commandArgs);
    return {
      entrypoint: execution.entrypoint,
      ok: result.ok,
      context: {
        scenarioIds: execution.scenarios.map(item => item.scenarioId),
        command: [process.execPath, ...execution.commandArgs],
      },
      phaseResults: result.payload?.phaseResults || [],
      caseResults: result.payload?.caseResults || [],
      raw: result.payload,
    };
  }

  while (pending.length || running.size) {
    let scheduled = false;
    for (let index = 0; index < pending.length && running.size < args.concurrency;) {
      const execution = pending[index];
      if (hasResourceConflict(execution, running)) {
        index += 1;
        continue;
      }
      pending.splice(index, 1);
      const promise = runExecution(execution).then(result => {
        executionResults.push(result);
        running.delete(promise);
      });
      running.set(promise, execution);
      scheduled = true;
    }
    if (running.size) {
      await Promise.race(running.keys());
    } else if (!scheduled && pending.length) {
      const execution = pending.shift();
      const result = await runExecution(execution);
      executionResults.push(result);
    }
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

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    process.exitCode = await main();
  } catch (error) {
    printJson({ ok: false, error: error.message }, process.stderr);
    process.exitCode = 1;
  }
}

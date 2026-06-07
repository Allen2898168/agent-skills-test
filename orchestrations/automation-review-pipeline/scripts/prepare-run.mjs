#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFlags, printJson } from "../lib/cli.mjs";
import {
  allocateRunId,
  loadRunArtifacts,
  makeInitialRunIndex,
  makeInitialRunState,
  resolveHistoryRoot,
  taskMarkdown,
  writeRunFiles,
} from "../lib/history.mjs";
import { validateRunState } from "../lib/contracts.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../..");

function usage() {
  return `Usage:
  node orchestrations/automation-review-pipeline/scripts/prepare-run.mjs --title <标题> --requirement <原始需求>
  node orchestrations/automation-review-pipeline/scripts/prepare-run.mjs --resume-run-id <runId>

Options:
  --title <text>            task title
  --requirement <text>      raw requirement text
  --tags <csv>              optional tags
  --date <YYYY-MM-DD>       override run date, default today
  --history-root <path>     override history root, default repo/history
  --resume-run-id <runId>   return existing run metadata without creating new run
  --help                    show this message
`;
}

function main() {
  const args = parseFlags(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const historyRoot = resolveHistoryRoot(repoRoot, args.historyRoot || "");
  if (args.resumeRunId) {
    const existing = loadRunArtifacts(historyRoot, String(args.resumeRunId));
    printJson({
      ok: true,
      actionId: "automation_review_prepare_run",
      resumed: true,
      runId: existing.runState.runId,
      historyDir: existing.historyDir,
      runStatePath: existing.runStatePath,
      runIndexPath: existing.runIndexPath,
      nextStageId: existing.runState.nextStageId,
      overallStatus: existing.runState.overallStatus,
    });
    return 0;
  }

  const title = String(args.title || "").trim();
  const requirement = String(args.requirement || "").trim();
  if (!title) throw new Error("--title is required");
  if (!requirement) throw new Error("--requirement is required");

  const dateText = String(args.date || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error(`Invalid --date: ${dateText}`);
  const tags = String(args.tags || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const runId = allocateRunId(historyRoot, dateText);
  const historyDir = path.join(historyRoot, runId);
  const createdAt = new Date().toISOString();

  const runState = makeInitialRunState({ runId, title, requirement, tags, historyDir, createdAt });
  const runIndex = makeInitialRunIndex(runState);
  const errors = validateRunState(runState);
  if (errors.length) throw new Error(`Invalid initial run state:\n${errors.join("\n")}`);
  writeRunFiles({
    runState,
    runIndex,
    taskMd: taskMarkdown({ runId, title, requirement, tags, createdAt }),
  });

  printJson({
    ok: true,
    actionId: "automation_review_prepare_run",
    resumed: false,
    runId,
    historyDir,
    runStatePath: path.join(historyDir, "run-state.json"),
    runIndexPath: path.join(historyDir, "run-index.json"),
    nextStageId: runState.nextStageId,
    overallStatus: runState.overallStatus,
  });
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    actionId: "automation_review_prepare_run",
    error: error.message,
  }, process.stderr);
  process.exitCode = 1;
}

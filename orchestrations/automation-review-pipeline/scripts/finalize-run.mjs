#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFlags, printJson } from "../lib/cli.mjs";
import { assertTerminalRun, markRemainingStagesSkipped, validateRunState } from "../lib/contracts.mjs";
import { buildFinalMarkdown } from "../lib/final-report.mjs";
import { loadRunArtifacts, resolveHistoryRoot, updateRunArtifacts } from "../lib/history.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../..");

function usage() {
  return `Usage:
  node orchestrations/automation-review-pipeline/scripts/finalize-run.mjs --run-id <runId>

Options:
  --history-root <path>     override history root
  --help                    show this message
`;
}

function main() {
  const args = parseFlags(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const runId = String(args.runId || "").trim();
  if (!runId) throw new Error("--run-id is required");

  const historyRoot = resolveHistoryRoot(repoRoot, args.historyRoot || "");
  const { historyDir, runStatePath, runIndexPath, runState, runIndex } = loadRunArtifacts(historyRoot, runId);
  assertTerminalRun(runState);
  const finalizedAt = new Date().toISOString();
  markRemainingStagesSkipped(runState, finalizedAt);
  runState.updatedAt = finalizedAt;
  runIndex.updatedAt = finalizedAt;
  runIndex.stages = runIndex.stages.map(item => {
    const stage = runState.stages[item.stageId];
    return {
      ...item,
      status: stage.status,
      recordedAt: stage.recordedAt,
    };
  });

  const stateErrors = validateRunState(runState);
  if (stateErrors.length) throw new Error(`Invalid final run state:\n${stateErrors.join("\n")}`);
  updateRunArtifacts({ runStatePath, runIndexPath, runState, runIndex });

  const finalMarkdown = buildFinalMarkdown(runState, runIndex);
  const finalPath = path.join(historyDir, "07-最终结论报告.md");
  fs.writeFileSync(finalPath, finalMarkdown);

  printJson({
    ok: true,
    actionId: "automation_review_finalize_run",
    runId,
    historyDir,
    overallStatus: runState.overallStatus,
    finalReport: finalPath,
    runStatePath,
    runIndexPath,
  });
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    actionId: "automation_review_finalize_run",
    error: error.message,
  }, process.stderr);
  process.exitCode = 1;
}

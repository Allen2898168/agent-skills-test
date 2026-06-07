#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFlags, printJson } from "../lib/cli.mjs";
import { expectedStageOrThrow, nextStateForStage, validateRunState, validateStageReport } from "../lib/contracts.mjs";
import { loadRunArtifacts, resolveHistoryRoot, updateRunArtifacts } from "../lib/history.mjs";
import { getStage } from "../lib/stages.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../..");

function usage() {
  return `Usage:
  node orchestrations/automation-review-pipeline/scripts/record-stage.mjs \
    --run-id <runId> \
    --stage-id <stageId> \
    --report-json-file <file> \
    --report-markdown-file <file>

Options:
  --history-root <path>       override history root
  --help                      show this message
`;
}

function main() {
  const args = parseFlags(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const runId = String(args.runId || "").trim();
  const stageId = String(args.stageId || "").trim();
  const reportJsonFile = String(args.reportJsonFile || "").trim();
  const reportMarkdownFile = String(args.reportMarkdownFile || "").trim();
  if (!runId) throw new Error("--run-id is required");
  if (!stageId) throw new Error("--stage-id is required");
  if (!reportJsonFile) throw new Error("--report-json-file is required");
  if (!reportMarkdownFile) throw new Error("--report-markdown-file is required");

  const historyRoot = resolveHistoryRoot(repoRoot, args.historyRoot || "");
  const { historyDir, runStatePath, runIndexPath, runState, runIndex } = loadRunArtifacts(historyRoot, runId);
  expectedStageOrThrow(runState, stageId);

  const report = JSON.parse(fs.readFileSync(path.resolve(reportJsonFile), "utf8"));
  const markdown = fs.readFileSync(path.resolve(reportMarkdownFile), "utf8");
  if (!markdown.trim()) throw new Error("Stage markdown report must not be empty.");

  const reportErrors = validateStageReport(report, stageId, runState.runId);
  if (reportErrors.length) throw new Error(`Invalid stage report:\n${reportErrors.join("\n")}`);

  const stage = getStage(stageId);
  const jsonTarget = path.join(historyDir, stage.jsonFile);
  const markdownTarget = path.join(historyDir, stage.markdownFile);
  fs.writeFileSync(jsonTarget, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownTarget, markdown);

  const transition = nextStateForStage(runState, report);
  const recordedAt = String(report.timestamp || new Date().toISOString());
  runState.updatedAt = recordedAt;
  runState.currentStageId = transition.currentStageId;
  runState.nextStageId = transition.nextStageId;
  runState.overallStatus = transition.overallStatus;
  runState.stages[stageId] = {
    stageId,
    stageName: stage.name,
    status: report.status,
    decision: report.decision,
    reportMarkdown: markdownTarget,
    reportJson: jsonTarget,
    recordedAt,
  };

  runIndex.updatedAt = recordedAt;
  runIndex.stages = runIndex.stages.map(item => (
    item.stageId === stageId
      ? {
          ...item,
          status: report.status,
          recordedAt,
        }
      : item
  ));
  runIndex.stageTimeline = [...(runIndex.stageTimeline || []), {
    stageId,
    stageName: stage.name,
    status: report.status,
    recordedAt,
  }];

  const stateErrors = validateRunState(runState);
  if (stateErrors.length) throw new Error(`Invalid run state after update:\n${stateErrors.join("\n")}`);
  updateRunArtifacts({ runStatePath, runIndexPath, runState, runIndex });

  printJson({
    ok: true,
    actionId: "automation_review_record_stage",
    runId,
    stageId,
    status: report.status,
    overallStatus: runState.overallStatus,
    nextStageId: runState.nextStageId,
    reportMarkdown: markdownTarget,
    reportJson: jsonTarget,
  });
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    actionId: "automation_review_record_stage",
    error: error.message,
  }, process.stderr);
  process.exitCode = 1;
}

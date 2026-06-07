#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFlags, printJson } from "../lib/cli.mjs";
import { buildStagePacket, writeStagePacketFiles } from "../lib/context-packet.mjs";
import { loadRunArtifacts, resolveHistoryRoot } from "../lib/history.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../..");

function usage() {
  return `Usage:
  node orchestrations/automation-review-pipeline/scripts/build-stage-context.mjs --run-id <runId>

Options:
  --history-root <path>     override history root
  --no-write-files          do not write history/context/*.md,json
  --help                    show this message
`;
}

function main() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--no-write-files"] });
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const runId = String(args.runId || "").trim();
  if (!runId) throw new Error("--run-id is required");

  const historyRoot = resolveHistoryRoot(repoRoot, args.historyRoot || "");
  const { historyDir, runState, runIndex } = loadRunArtifacts(historyRoot, runId);
  const packet = buildStagePacket({ repoRoot, historyDir, runState, runIndex });
  const artifacts = args.noWriteFiles ? { jsonPath: "", markdownPath: "" } : writeStagePacketFiles(historyDir, packet);

  printJson({
    ok: true,
    actionId: "automation_review_build_stage_context",
    runId,
    terminal: packet.terminal,
    finalizeReady: packet.finalizeReady,
    nextStageId: packet.nextStageId || "",
    nextStageName: packet.nextStageName || "",
    contextFiles: packet.contextFiles,
    promptPath: packet.stagePromptPath || "",
    schemaPath: packet.schemaPath || "",
    outputTargets: packet.outputTargets || {},
    contextMarkdown: artifacts.markdownPath,
    contextJson: artifacts.jsonPath,
  });
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    actionId: "automation_review_build_stage_context",
    error: error.message,
  }, process.stderr);
  process.exitCode = 1;
}

#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFlags, printJson } from "../lib/cli.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../..");

const DIRECT_PIPELINE_PHRASES = [
  "subagent链路",
  "subagent 链路",
  "子agent链路",
  "子 agent 链路",
  "走subagent链路",
  "走 subagent 链路",
  "按子agent",
  "按子 agent",
  "按subagent",
  "按 subagent",
  "多subagent",
  "多 subagent",
  "automation-review-pipeline",
];

const REGRESSION_PIPELINE_PHRASES = [
  "全量回归",
  "全链路回归",
  "组合回归",
  "跨域回归",
  "跨活动后台",
  "跨fin admin",
  "跨 fin admin",
  "跨前端",
];

function usage() {
  return `Usage:
  node orchestrations/automation-review-pipeline/scripts/resolve-entry-mode.mjs --requirement <原始需求>

Options:
  --requirement <text>      raw requirement text
  --case-count <n>          optional case count hint
  --cross-skill             force treat as cross-skill workflow
  --help                    show this message
`;
}

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function hasPhrase(source, phrases) {
  return phrases.filter(item => source.includes(item));
}

function main() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--cross-skill"] });
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const requirement = String(args.requirement || "").trim();
  if (!requirement) throw new Error("--requirement is required");

  const caseCount = args.caseCount === undefined ? null : Number(args.caseCount);
  if (args.caseCount !== undefined && !Number.isFinite(caseCount)) {
    throw new Error(`Invalid --case-count: ${args.caseCount}`);
  }

  const normalized = normalize(requirement);
  const directMatches = hasPhrase(normalized, DIRECT_PIPELINE_PHRASES);
  const regressionMatches = hasPhrase(normalized, REGRESSION_PIPELINE_PHRASES);
  const crossSkill = Boolean(args.crossSkill);
  const caseCountExceeded = Number.isFinite(caseCount) && caseCount > 10;

  const reasons = [];
  if (directMatches.length) reasons.push(`命中显式 subagent 编排话术: ${directMatches.join(", ")}`);
  if (regressionMatches.length) reasons.push(`命中默认走编排的回归话术: ${regressionMatches.join(", ")}`);
  if (crossSkill) reasons.push("显式标记为跨 skill 任务");
  if (caseCountExceeded) reasons.push(`用例数 ${caseCount} > 10`);

  const usePipeline = Boolean(
    directMatches.length
    || regressionMatches.length
    || crossSkill
    || caseCountExceeded
  );

  printJson({
    ok: true,
    actionId: "automation_review_resolve_entry_mode",
    repoRoot,
    requirement,
    routingDecision: usePipeline ? "automation_review_pipeline" : "direct_skill_flow",
    mustUseAutomationReviewPipeline: usePipeline,
    historyRequired: usePipeline,
    matchedSignals: {
      directPipelinePhrases: directMatches,
      regressionPipelinePhrases: regressionMatches,
      crossSkill,
      caseCount,
      caseCountExceeded,
    },
    reasons,
    requiredSteps: usePipeline
      ? [
          "prepare-run",
          "build-stage-context",
          "subagent staged execution",
          "record-stage",
          "finalize-run",
          "history/<runId>/ artifacts",
        ]
      : [],
    forbiddenFallbacks: usePipeline
      ? [
          "不得只做 worker 并行而跳过阶段审阅",
          "不得直接串行执行 orchestrations/*/scripts/run-*.mjs 代替父编排器",
          "不得在没有 history/<runId>/ 产物时宣称已走 subagent 链路",
        ]
      : [],
  });
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({
    ok: false,
    actionId: "automation_review_resolve_entry_mode",
    error: error.message,
  }, process.stderr);
  process.exitCode = 1;
}

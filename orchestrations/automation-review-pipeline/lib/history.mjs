import fs from "node:fs";
import path from "node:path";

import { STAGES } from "./stages.mjs";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveHistoryRoot(repoRoot, override = "") {
  return path.resolve(override || path.join(repoRoot, "history"));
}

export function allocateRunId(historyRoot, dateText) {
  ensureDir(historyRoot);
  const prefix = `${dateText}-`;
  const suffixes = fs.readdirSync(historyRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .map(entry => entry.name)
    .filter(name => /^\d{4}-\d{2}-\d{2}-\d{3}$/.test(name))
    .map(name => Number(name.slice(-3)))
    .filter(number => Number.isInteger(number) && number > 0);
  const next = (suffixes.length ? Math.max(...suffixes) : 0) + 1;
  return `${dateText}-${String(next).padStart(3, "0")}`;
}

export function makeInitialRunState({ runId, title, requirement, tags, historyDir, createdAt }) {
  const stageEntries = Object.fromEntries(STAGES.map(stage => [
    stage.id,
    {
      stageId: stage.id,
      stageName: stage.name,
      status: "PENDING",
      decision: "",
      reportMarkdown: "",
      reportJson: "",
      recordedAt: "",
    },
  ]));
  return {
    version: 1,
    runId,
    title,
    requirement,
    tags,
    historyDir,
    createdAt,
    updatedAt: createdAt,
    overallStatus: "IN_PROGRESS",
    currentStageId: "",
    nextStageId: "linkage_analysis",
    stages: stageEntries,
  };
}

export function makeInitialRunIndex(runState) {
  return {
    version: 1,
    runId: runState.runId,
    title: runState.title,
    historyDir: runState.historyDir,
    createdAt: runState.createdAt,
    updatedAt: runState.updatedAt,
    files: {
      task: "00-任务说明.md",
      final: "07-最终结论报告.md",
      runState: "run-state.json",
      runIndex: "run-index.json",
    },
    stages: STAGES.map(stage => ({
      stageId: stage.id,
      stageName: stage.name,
      status: "PENDING",
      markdownFile: stage.markdownFile,
      jsonFile: stage.jsonFile,
      recordedAt: "",
    })),
  };
}

export function taskMarkdown({ runId, title, requirement, tags, createdAt }) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`- runId: \`${runId}\``);
  lines.push(`- 创建时间: \`${createdAt}\``);
  if (tags.length) lines.push(`- 标签: ${tags.join(", ")}`);
  lines.push("");
  lines.push("## 原始需求");
  lines.push(requirement);
  lines.push("");
  lines.push("## 固定阶段");
  for (const stage of STAGES) lines.push(`- ${stage.order}. ${stage.name}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function writeRunFiles({ runState, runIndex, taskMd }) {
  ensureDir(runState.historyDir);
  fs.writeFileSync(path.join(runState.historyDir, "00-任务说明.md"), taskMd);
  fs.writeFileSync(path.join(runState.historyDir, "run-state.json"), JSON.stringify(runState, null, 2));
  fs.writeFileSync(path.join(runState.historyDir, "run-index.json"), JSON.stringify(runIndex, null, 2));
}

export function loadRunArtifacts(historyRoot, runId) {
  const historyDir = path.join(historyRoot, runId);
  if (!fs.existsSync(historyDir)) throw new Error(`Run not found: ${runId}`);
  const runStatePath = path.join(historyDir, "run-state.json");
  const runIndexPath = path.join(historyDir, "run-index.json");
  if (!fs.existsSync(runStatePath)) throw new Error(`Missing run-state.json for ${runId}`);
  if (!fs.existsSync(runIndexPath)) throw new Error(`Missing run-index.json for ${runId}`);
  return {
    historyDir,
    runStatePath,
    runIndexPath,
    runState: JSON.parse(fs.readFileSync(runStatePath, "utf8")),
    runIndex: JSON.parse(fs.readFileSync(runIndexPath, "utf8")),
  };
}

export function updateRunArtifacts({ runStatePath, runIndexPath, runState, runIndex }) {
  fs.writeFileSync(runStatePath, JSON.stringify(runState, null, 2));
  fs.writeFileSync(runIndexPath, JSON.stringify(runIndex, null, 2));
}

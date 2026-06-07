import fs from "node:fs";
import path from "node:path";

import { getStage, STAGES } from "./stages.mjs";

export function buildStagePacket({ repoRoot, historyDir, runState, runIndex }) {
  if (!runState.nextStageId) {
    return {
      runId: runState.runId,
      overallStatus: runState.overallStatus,
      nextStageId: "",
      terminal: true,
      finalizeReady: runState.overallStatus !== "IN_PROGRESS",
      contextFiles: collectContextFiles(historyDir, runState, ""),
    };
  }

  const stage = getStage(runState.nextStageId);
  const promptPath = path.join(repoRoot, "orchestrations/automation-review-pipeline/prompts", stage.promptFile);
  const schemaPath = path.join(repoRoot, "orchestrations/automation-review-pipeline/schemas/stage-report.schema.json");
  const contextFiles = collectContextFiles(historyDir, runState, stage.id);
  const pipelineSignals = readPipelineSignals(runState);
  const stageBaseReport = {
    runId: runState.runId,
    stageId: stage.id,
    stageName: stage.name,
    agentRole: stageAgentRole(stage.id),
  };
  return {
    runId: runState.runId,
    title: runState.title,
    requirement: runState.requirement,
    tags: runState.tags,
    historyDir,
    overallStatus: runState.overallStatus,
    currentStageId: runState.currentStageId,
    nextStageId: stage.id,
    nextStageName: stage.name,
    terminal: false,
    finalizeReady: false,
    stagePromptPath: promptPath,
    stagePromptText: fs.readFileSync(promptPath, "utf8"),
    schemaPath,
    schemaRef: "stage-report.schema.json",
    contextFiles,
    outputTargets: {
      markdown: path.join(historyDir, stage.markdownFile),
      json: path.join(historyDir, stage.jsonFile),
    },
    reportSkeleton: {
      ...stageBaseReport,
      status: "",
      decision: "",
      summary: "",
      inputs: [],
      findings: [],
      evidence: [],
      risks: [],
      nextAction: "",
      relatedCommands: [],
      relatedFiles: [],
      timestamp: "",
    },
    stageSpecificHints: stageSpecificHints(stage.id, pipelineSignals),
    parentInstructions: buildParentInstructions(stage.id, pipelineSignals),
    recordedStages: (runIndex.stageTimeline || []).map(item => ({
      stageId: item.stageId,
      stageName: item.stageName,
      status: item.status,
      recordedAt: item.recordedAt,
    })),
    pipelineSignals,
  };
}

function buildParentInstructions(stageId, pipelineSignals) {
  const instructions = [
      "读取本次阶段 prompt 和 contextFiles。",
      "调用对应 subagent 完成当前阶段。",
      "要求 subagent 输出中文 Markdown 报告和 machine-readable JSON。",
      "JSON 必须符合 stage-report.schema.json，并写入 outputTargets 指向的文件。",
      "完成后调用 record-stage.mjs 记录当前阶段。",
      "若 nextStageId 为空且 overallStatus 非 IN_PROGRESS，则调用 finalize-run.mjs。",
    ];
  if (
    stageId === "script_integration" &&
    pipelineSignals.coverageDecision === "APPROVE" &&
    (pipelineSignals.existingCoverage === "NONE" || pipelineSignals.existingCoverage === "PARTIAL")
  ) {
    instructions.push("当前需求虽缺少完整现成覆盖，但已被批准纳入自动化；不得因无现成脚本直接终止，必须先补覆盖设计再整合。");
  }
  return instructions;
}

export function writeStagePacketFiles(historyDir, packet) {
  const contextDir = path.join(historyDir, "context");
  fs.mkdirSync(contextDir, { recursive: true });
  const slug = packet.nextStageId
    ? `${String(getStage(packet.nextStageId).order).padStart(2, "0")}-${packet.nextStageName}`
    : "00-终态";
  const jsonPath = path.join(contextDir, `${slug}-上下文.json`);
  const markdownPath = path.join(contextDir, `${slug}-上下文.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(packet, null, 2));
  fs.writeFileSync(markdownPath, stagePacketMarkdown(packet));
  return { jsonPath, markdownPath };
}

function collectContextFiles(historyDir, runState, nextStageId) {
  const files = [
    path.join(historyDir, "00-任务说明.md"),
    path.join(historyDir, "run-state.json"),
    path.join(historyDir, "run-index.json"),
  ];
  const cutoffOrder = nextStageId ? getStage(nextStageId).order : Number.POSITIVE_INFINITY;
  for (const stage of STAGES) {
    if (stage.order >= cutoffOrder) continue;
    const state = runState.stages[stage.id];
    if (!state?.reportMarkdown || !state?.reportJson) continue;
    files.push(state.reportMarkdown, state.reportJson);
  }
  return files;
}

function stagePacketMarkdown(packet) {
  const lines = [];
  lines.push(`# 阶段上下文：${packet.nextStageName || "终态"}`);
  lines.push("");
  lines.push(`- runId: \`${packet.runId}\``);
  lines.push(`- 当前状态: \`${packet.overallStatus}\``);
  if (packet.nextStageId) {
    lines.push(`- 下一阶段: \`${packet.nextStageId}\` / ${packet.nextStageName}`);
    lines.push(`- Prompt: \`${packet.stagePromptPath}\``);
    lines.push(`- Schema: \`${packet.schemaPath}\``);
    lines.push(`- 输出 Markdown: \`${packet.outputTargets.markdown}\``);
    lines.push(`- 输出 JSON: \`${packet.outputTargets.json}\``);
  } else {
    lines.push("- 当前已无下一阶段。");
  }
  lines.push("");
  lines.push("## 必读文件");
  for (const filePath of packet.contextFiles || []) {
    lines.push(`- \`${filePath}\``);
  }
  lines.push("");
  if (packet.nextStageId) {
    lines.push("## 父编排器动作");
    for (const item of packet.parentInstructions || []) lines.push(`- ${item}`);
    lines.push("");
    lines.push("## 阶段特有字段提示");
    for (const item of packet.stageSpecificHints || []) lines.push(`- ${item}`);
    lines.push("");
    lines.push("## 报告骨架");
    lines.push("```json");
    lines.push(JSON.stringify(packet.reportSkeleton, null, 2));
    lines.push("```");
    lines.push("");
  }
  if (packet.recordedStages?.length) {
    lines.push("## 已记录阶段");
    for (const item of packet.recordedStages) {
      lines.push(`- \`${item.recordedAt}\` ${item.stageName}: ${item.status}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function stageAgentRole(stageId) {
  switch (stageId) {
    case "linkage_analysis":
      return "链路分析 subagent";
    case "coverage_review":
      return "覆盖审阅 subagent";
    case "rework_advice":
      return "返工建议 subagent";
    case "script_integration":
      return "脚本整合 subagent";
    case "validation_review":
      return "校验审阅 subagent";
    case "execution_run":
      return "执行落地 subagent";
    default:
      return "通用 subagent";
  }
}

function stageSpecificHints(stageId, pipelineSignals) {
  switch (stageId) {
    case "linkage_analysis":
      return withCoverageGapHints([
        "必须给出 existingCoverage: NONE | PARTIAL | FULL",
        "必须给出 suggestedFlow / dependentSkills / entrypoints",
        "若现有覆盖不足但需求仍可自动化，必须明确给出新增覆盖或补缺建议，不能因为没有现成用例就直接否定。",
      ], pipelineSignals);
    case "coverage_review":
      return withCoverageGapHints([
        "必须给出 coverageDecision: APPROVE | REJECT",
        "仅在 REJECT 时提供 rejectReasonType",
        "existingCoverage=NONE 或 PARTIAL 不等于必须拒绝；若业务价值成立且风险可控，可批准进入脚本整合并要求补设计。",
      ], pipelineSignals);
    case "rework_advice":
      return [
        "必须给出 reworkTargetStage / reworkItems / acceptanceCriteria",
      ];
    case "script_integration":
      return withCoverageGapHints([
        "必须给出 integrationDecision: READY | NOT_READY",
        "必须给出 scriptPlan / artifactPlan",
        "若覆盖审阅已通过但 existingCoverage=NONE，则 scriptPlan 必须包含新增用例设计、脚本补齐和执行入口。",
        "若覆盖审阅已通过但 existingCoverage=PARTIAL，则 scriptPlan 必须拆出复用部分与待补缺口，不能只写复用现有脚本。",
      ], pipelineSignals);
    case "validation_review":
      return [
        "必须给出 validationDecision: APPROVE | REJECT",
        "必须给出 gaps / requiredFixes",
      ];
    case "execution_run":
      return [
        "必须给出 executedCommands / outputArtifacts / verificationEvidence",
        "若 status=BLOCKED，可不提供 executionDecision",
      ];
    default:
      return [];
  }
}

function readPipelineSignals(runState) {
  const linkageReport = readStageReport(runState, "linkage_analysis");
  const coverageReport = readStageReport(runState, "coverage_review");
  return {
    existingCoverage: linkageReport?.existingCoverage || "",
    coverageDecision: coverageReport?.coverageDecision || "",
  };
}

function readStageReport(runState, stageId) {
  const reportPath = runState.stages?.[stageId]?.reportJson;
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return null;
  }
}

function withCoverageGapHints(baseHints, pipelineSignals) {
  const hints = [...baseHints];
  if (pipelineSignals.existingCoverage === "NONE") {
    hints.push("当前链路分析已判定 existingCoverage=NONE：本次需求允许从零设计新增覆盖，只要覆盖审阅批准，就应继续补设计、整合、校验和执行。");
  } else if (pipelineSignals.existingCoverage === "PARTIAL") {
    hints.push("当前链路分析已判定 existingCoverage=PARTIAL：本次需求允许在复用已有覆盖的基础上补齐缺口，不应被误判为“已覆盖完成”。");
  }
  return hints;
}

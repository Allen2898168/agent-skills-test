import path from "node:path";

import { STAGES } from "./stages.mjs";

export function buildFinalMarkdown(runState, runIndex) {
  const lines = [];
  lines.push(`# 最终结论报告：${runState.title}`);
  lines.push("");
  lines.push(`- runId: \`${runState.runId}\``);
  lines.push(`- 最终状态: \`${runState.overallStatus}\``);
  lines.push(`- 创建时间: \`${runState.createdAt}\``);
  lines.push(`- 最后更新时间: \`${runState.updatedAt}\``);
  lines.push("");
  lines.push("## 原始需求");
  lines.push(runState.requirement);
  lines.push("");
  lines.push("## 阶段结果");
  for (const stage of STAGES) {
    const entry = runState.stages[stage.id];
    lines.push(`- ${stage.order}. ${stage.name}: \`${entry.status}\`${entry.decision ? `，${entry.decision}` : ""}`);
  }
  lines.push("");
  lines.push("## 报告索引");
  for (const stage of STAGES) {
    const entry = runState.stages[stage.id];
    if (!entry.reportMarkdown) continue;
    lines.push(`- ${stage.name}: ${path.basename(entry.reportMarkdown)} / ${path.basename(entry.reportJson)}`);
  }
  lines.push("");
  const execution = runState.stages.execution_run;
  if (execution.reportJson) {
    lines.push("## 执行产物");
    lines.push(`- 执行报告: ${path.basename(execution.reportMarkdown)}`);
    lines.push(`- 执行 JSON: ${path.basename(execution.reportJson)}`);
    lines.push("");
  }
  lines.push("## 索引文件");
  lines.push(`- run-state.json`);
  lines.push(`- run-index.json`);
  lines.push("");
  if (Array.isArray(runIndex?.stageTimeline) && runIndex.stageTimeline.length) {
    lines.push("## 记录时间线");
    for (const item of runIndex.stageTimeline) {
      lines.push(`- \`${item.recordedAt}\` ${item.stageName}: ${item.status}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

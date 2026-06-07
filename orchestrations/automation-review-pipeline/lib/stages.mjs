export const STAGES = [
  {
    id: "linkage_analysis",
    order: 1,
    name: "链路分析",
    markdownFile: "01-链路分析报告.md",
    jsonFile: "01-链路分析报告.json",
    promptFile: "01-链路分析.md",
  },
  {
    id: "coverage_review",
    order: 2,
    name: "覆盖审阅",
    markdownFile: "02-覆盖审阅报告.md",
    jsonFile: "02-覆盖审阅报告.json",
    promptFile: "02-覆盖审阅.md",
  },
  {
    id: "rework_advice",
    order: 3,
    name: "返工建议",
    markdownFile: "03-返工建议报告.md",
    jsonFile: "03-返工建议报告.json",
    promptFile: "03-返工建议.md",
  },
  {
    id: "script_integration",
    order: 4,
    name: "脚本整合",
    markdownFile: "04-脚本整合报告.md",
    jsonFile: "04-脚本整合报告.json",
    promptFile: "04-脚本整合.md",
  },
  {
    id: "validation_review",
    order: 5,
    name: "校验审阅",
    markdownFile: "05-校验审阅报告.md",
    jsonFile: "05-校验审阅报告.json",
    promptFile: "05-校验审阅.md",
  },
  {
    id: "execution_run",
    order: 6,
    name: "执行落地",
    markdownFile: "06-执行报告.md",
    jsonFile: "06-执行报告.json",
    promptFile: "06-执行落地.md",
  },
];

export const STAGE_ORDER = STAGES.map(item => item.id);
export const STAGE_IDS = new Set(STAGE_ORDER);
export const STAGE_MAP = new Map(STAGES.map(item => [item.id, item]));

export const STAGE_STATUS = new Set(["PENDING", "PASS", "FAIL", "SKIPPED", "BLOCKED"]);
export const RUN_STATUS = new Set(["IN_PROGRESS", "PASS", "FAIL", "BLOCKED"]);

export function getStage(stageId) {
  const stage = STAGE_MAP.get(stageId);
  if (!stage) throw new Error(`Unknown stageId: ${stageId}`);
  return stage;
}

export function stageAgentRole(stageId) {
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

import { collectCaseIdsForScenarios } from "./lottery-regression-manifest.mjs";

export function buildScenarioExecutionReport({ selectedScenarios, manifest, executionResults }) {
  const caseResults = buildCompleteCaseResults(selectedScenarios, manifest, executionResults);
  const executionByEntrypoint = new Map((executionResults || []).map(item => [item.entrypoint, item]));
  const labels = manifest?.executionPolicy?.statusLabels || {};

  return (selectedScenarios || []).map(scenario => {
    const relevantCaseIds = new Set(scenario.caseIds || []);
    const relevantCases = caseResults.filter(item => relevantCaseIds.has(item.caseId));
    const entryExecution = scenario.entrypoint ? executionByEntrypoint.get(scenario.entrypoint) : null;
    const fallbackStatus = !scenario.entrypoint
      ? scenario.status === "blocked"
        ? "BLOCKED"
        : "SKIPPED"
      : "SKIPPED";
    const status = summarizeScenarioStatus(relevantCases, fallbackStatus);
    return {
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      status,
      manifestStatus: scenario.status,
      manifestStatusLabel: labels[scenario.status] || scenario.status,
      entrypoint: scenario.entrypoint || "",
      caseIds: scenario.caseIds || [],
      caseResults: relevantCases,
      executionContext: entryExecution?.context || null,
      note: buildScenarioNote(scenario, relevantCases),
    };
  });
}

export function summarizeDispatcherResult({ selectedScenarios, manifest, executionResults }) {
  const caseResults = buildCompleteCaseResults(selectedScenarios, manifest, executionResults);
  const scenarioResults = buildScenarioExecutionReport({ selectedScenarios, manifest, executionResults });
  return {
    scenarioResults,
    caseResults,
    summary: {
      selectedScenarioCount: selectedScenarios.length,
      selectedCaseCount: collectCaseIdsForScenarios(selectedScenarios).length,
      executedEntrypoints: executionResults.map(item => item.entrypoint),
      scenarioStatusCounts: countByStatus(scenarioResults),
      caseStatusCounts: countByStatus(caseResults),
    },
  };
}

function buildCompleteCaseResults(selectedScenarios, manifest, executionResults) {
  const actualCaseResults = executionResults.flatMap(item => item.caseResults || []);
  const caseEntries = new Map((manifest?.entries || []).map(item => [item.caseId, item]));
  const resultByCaseId = new Map(actualCaseResults.map(item => [item.caseId, item]));
  const completed = [...actualCaseResults];

  for (const scenario of selectedScenarios || []) {
    const automationCaseIds = new Set(scenario.automationCaseIds || []);
    for (const caseId of scenario.caseIds || []) {
      if (resultByCaseId.has(caseId)) continue;
      const entry = caseEntries.get(caseId) || { caseId, caseName: "", module: "", priority: "" };
      const status = scenario.status === "blocked" ? "BLOCKED" : "SKIPPED";
      const evidence = {
        recordType: "manifest_only",
        scenarioId: scenario.scenarioId,
        reason: automationCaseIds.has(caseId)
          ? "本次没有产出该 case 的实际执行结果。"
          : "该 case 已登记到场景，但当前未接入自动化执行。",
      };
      const synthetic = {
        caseId: entry.caseId,
        caseName: entry.caseName || "",
        module: entry.module || "",
        priority: entry.priority || "",
        phaseId: "",
        status,
        evidence,
        errorMessage: "",
      };
      resultByCaseId.set(caseId, synthetic);
      completed.push(synthetic);
    }
  }

  return completed;
}

function summarizeScenarioStatus(caseResults, fallbackStatus) {
  if (!caseResults.length) return fallbackStatus;
  const statuses = new Set(caseResults.map(item => item.status));
  if (statuses.size === 1) return caseResults[0].status;
  if (statuses.has("FAIL")) return "FAIL";
  if (statuses.has("PASS") && (statuses.has("SKIPPED") || statuses.has("BLOCKED"))) return "PARTIAL";
  if (statuses.has("BLOCKED") && !statuses.has("PASS")) return "BLOCKED";
  return "PARTIAL";
}

function countByStatus(items) {
  const summary = {};
  for (const item of items || []) {
    const key = item.status || "UNKNOWN";
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}

function buildScenarioNote(scenario, caseResults) {
  if (!scenario.entrypoint) return "当前仅登记用例，尚未接入可执行入口。";
  if (!caseResults.length) return "本次执行仅跑前置依赖，暂无直接归属的 case 结果。";
  return "";
}

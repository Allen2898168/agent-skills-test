import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./cli.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "../../../../");
const manifestPath = path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json");

export function loadLotteryRegressionManifest() {
  return readJson(manifestPath);
}

export function buildScenarioMenu(manifest = loadLotteryRegressionManifest()) {
  const labels = manifest.executionPolicy?.statusLabels || {};
  const groups = new Map((manifest.scenarioGroups || []).map(group => [group.groupId, {
    groupId: group.groupId,
    title: group.title,
    description: group.description || "",
    selectionAliases: group.selectionAliases || [],
    scenarios: [],
  }]));
  for (const scenario of manifest.scenarioCatalog || []) {
    const group = groups.get(scenario.groupId);
    if (!group) continue;
    group.scenarios.push({
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      status: scenario.status,
      statusLabel: labels[scenario.status] || scenario.status,
      executable: Boolean(scenario.entrypoint),
      allowInAll: Boolean(scenario.allowInAll),
      description: scenario.description || "",
      selectionAliases: scenario.selectionAliases || [],
      caseCount: Array.isArray(scenario.caseIds) ? scenario.caseIds.length : 0,
      automationCaseCount: Array.isArray(scenario.automationCaseIds) ? scenario.automationCaseIds.length : 0,
      caseIds: scenario.caseIds || [],
      automationCaseIds: scenario.automationCaseIds || [],
      preconditions: scenario.preconditions || [],
      entrypoint: scenario.entrypoint || "",
    });
  }
  return Array.from(groups.values());
}

export function findScenarioById(scenarioId, manifest = loadLotteryRegressionManifest()) {
  return (manifest.scenarioCatalog || []).find(item => item.scenarioId === scenarioId) || null;
}

export function findGroupById(groupId, manifest = loadLotteryRegressionManifest()) {
  return (manifest.scenarioGroups || []).find(item => item.groupId === groupId) || null;
}

export function resolveScenarioSelection(input, manifest = loadLotteryRegressionManifest()) {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return {
      mode: "none",
      requested: [],
      selectedScenarios: [],
      unresolved: [],
    };
  }

  if (matchesAll(normalized)) {
    const statuses = new Set(manifest.executionPolicy?.runStatusesForAll || ["ready", "partial"]);
    const selectedScenarios = (manifest.scenarioCatalog || []).filter(item => statuses.has(item.status) && item.allowInAll !== false);
    return {
      mode: "all",
      requested: ["全部"],
      selectedScenarios,
      unresolved: [],
    };
  }

  const tokens = splitSelection(normalized);
  const resolved = [];
  const unresolved = [];
  const seen = new Set();

  for (const token of tokens) {
    const exactScenario = findScenarioByToken(token, manifest);
    if (exactScenario) {
      if (!seen.has(exactScenario.scenarioId)) {
        seen.add(exactScenario.scenarioId);
        resolved.push(exactScenario);
      }
      continue;
    }
    const exactGroup = findGroupByToken(token, manifest);
    if (exactGroup) {
      for (const scenario of (manifest.scenarioCatalog || []).filter(item => item.groupId === exactGroup.groupId)) {
        if (!seen.has(scenario.scenarioId)) {
          seen.add(scenario.scenarioId);
          resolved.push(scenario);
        }
      }
      continue;
    }
    unresolved.push(token);
  }

  return {
    mode: resolved.length ? "selection" : "none",
    requested: tokens,
    selectedScenarios: resolved,
    unresolved,
  };
}

export function collectCaseIdsForScenarios(scenarios) {
  return Array.from(new Set((scenarios || []).flatMap(item => item.caseIds || [])));
}

export function collectAutomationCaseIdsForScenarios(scenarios) {
  return Array.from(new Set((scenarios || []).flatMap(item => {
    if (Array.isArray(item.automationCaseIds) && item.automationCaseIds.length) return item.automationCaseIds;
    return item.entrypoint ? (item.caseIds || []) : [];
  })));
}

function findScenarioByToken(token, manifest) {
  const normalizedToken = normalizeInput(token);
  return (manifest.scenarioCatalog || []).find(item => {
    if (normalizeInput(item.scenarioId) === normalizedToken) return true;
    if (normalizeInput(item.title) === normalizedToken) return true;
    return (item.selectionAliases || []).some(alias => normalizeInput(alias) === normalizedToken);
  }) || null;
}

function findGroupByToken(token, manifest) {
  const normalizedToken = normalizeInput(token);
  return (manifest.scenarioGroups || []).find(item => {
    if (normalizeInput(item.groupId) === normalizedToken) return true;
    if (normalizeInput(item.title) === normalizedToken) return true;
    return (item.selectionAliases || []).some(alias => normalizeInput(alias) === normalizedToken);
  }) || null;
}

function matchesAll(value) {
  const normalized = normalizeInput(value);
  return ["全部", "全部回归", "all"].includes(normalized);
}

function splitSelection(value) {
  return String(value)
    .split(/[,+，、\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeInput(value) {
  return String(value || "").trim().toLowerCase();
}

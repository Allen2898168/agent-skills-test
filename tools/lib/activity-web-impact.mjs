import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_ACTIVITY_WEB_CANDIDATES = [
  "activity-web",
  "../activity-web",
  "../../activity-web",
];

const IMPACT_RULES = [
  {
    id: "lottery_base_config",
    title: "转盘活动基础配置",
    patterns: [
      /activity-ui\/src\/views\/activity\/lottery\/components\/baseForm\.vue$/,
      /ActivityConfigController\.java$/,
    ],
    scenarioIds: ["admin_activity_config", "admin_activity_list", "frontend_page_basic", "frontend_backend_linkage"],
    caseIds: ["AC-01", "AC-02", "AC-03", "AC-11", "AC-12", "AL-01", "FE-02", "FE-03", "FE-73", "FE-75", "FE-76"],
    actionIds: ["configure_lottery_activity", "configure_lottery_activity_modules", "lottery_admin_main_regression"],
  },
  {
    id: "lottery_prize_config",
    title: "转盘奖池 / 奖品配置",
    patterns: [
      /activity-ui\/src\/views\/activity\/lottery\/components\/prizeConfigForm\.vue$/,
      /ActivityPrizeController\.java$/,
      /activity-ui\/src\/api\/activity\/task\.js$/,
    ],
    scenarioIds: ["admin_prize_management", "admin_activity_config", "frontend_single_draw", "frontend_five_draw", "frontend_reward_record", "special_low_stock", "special_five_draw"],
    caseIds: ["PM-01", "PM-02", "PM-03", "PM-08", "AC-04", "AC-05", "FE-24", "FE-32", "FE-33", "FE-36", "FE-37", "FE-25", "FE-40", "FE-41", "FE-48", "FE-57"],
    actionIds: ["create_prizes", "configure_lottery_activity", "configure_lottery_activity_modules", "lottery_admin_main_regression"],
  },
  {
    id: "lottery_task_config",
    title: "转盘任务绑定 / 抽奖次数",
    patterns: [
      /activity-ui\/src\/views\/activity\/lottery\/components\/activityTaskForm\.vue$/,
      /ActivityTaskController\.java$/,
      /activity-ui\/src\/api\/activity\/task\.js$/,
    ],
    scenarioIds: ["admin_task_management", "admin_activity_config", "frontend_state_ui", "frontend_signup_flow", "frontend_backend_linkage", "special_recharge_mq"],
    caseIds: ["TM-01", "TM-08", "TM-10", "AC-10", "FE-16", "FE-18", "FE-21", "FE-79", "FE-80", "FE-81", "FE-84"],
    actionIds: ["create_roulette_participant_scope_tasks", "verify_activity_tasks_all_types", "configure_lottery_activity", "lottery_admin_main_regression"],
  },
  {
    id: "lottery_style_display",
    title: "转盘抽奖样式展示",
    patterns: [
      /activity-ui\/src\/views\/activity\/lottery\/components\/styleForm\.vue$/,
    ],
    scenarioIds: ["frontend_style_display", "admin_activity_config"],
    caseIds: ["AC-06", "FE-09", "FE-10", "FE-11", "FE-12", "FE-13", "FE-14", "FE-15"],
    actionIds: ["configure_lottery_activity", "create_lottery_activity_draft"],
  },
  {
    id: "lottery_i18n_faq",
    title: "多语言 / FAQ / 前后端联动",
    patterns: [
      /activity-ui\/src\/views\/activity\/lottery\/components\/i18nConfigForm\.vue$/,
      /activity-ui\/src\/views\/activity\/lottery\/components\/FAQForm\.vue$/,
      /ActivityI18nTemplate.*Controller\.java$/,
      /activity-ui\/src\/api\/activity\/langsTemplate\.js$/,
    ],
    scenarioIds: ["admin_activity_config", "frontend_backend_linkage"],
    caseIds: ["AC-12", "AC-13", "FE-73", "FE-75", "FE-76", "FE-77", "FE-78"],
    actionIds: ["create_multilanguage_templates", "manage_multilanguage_template_items", "batch_bind_i18n_templates", "configure_lottery_activity_modules"],
  },
  {
    id: "lottery_status_flow",
    title: "转盘上下线 / 删除 / 状态流转",
    patterns: [
      /ActivityLotteryConfigController\.java$/,
      /activity-ui\/src\/api\/activity\/lottery\.js$/,
      /activity-ui\/src\/views\/activity\/lottery\/index\.vue$/,
    ],
    scenarioIds: ["admin_status_flow", "admin_activity_list", "frontend_state_ui"],
    caseIds: ["ST-01", "ST-02", "ST-03", "AL-07", "FE-17", "FE-19", "FE-20"],
    actionIds: ["online_lottery_activity", "lottery_admin_main_regression"],
  },
  {
    id: "resource_card",
    title: "资源位信息卡片",
    patterns: [
      /ActivityResourceController\.java$/,
      /activity-ui\/src\/api\/activity\/resource\.js$/,
      /ResourceCardForm\.vue$/,
    ],
    scenarioIds: [],
    caseIds: [],
    actionIds: ["create_resource_cards"],
  },
  {
    id: "task_package",
    title: "任务包",
    patterns: [
      /ActivityTaskPackageController\.java$/,
      /activity-ui\/src\/api\/activity\/taskPackage\.js$/,
    ],
    scenarioIds: [],
    caseIds: [],
    actionIds: ["create_task_packages"],
  },
];

export function resolveActivityWebDir(repoRoot, explicitDir = "") {
  const candidates = [
    explicitDir,
    process.env.ACTIVITY_WEB_DIR,
    ...DEFAULT_ACTIVITY_WEB_CANDIDATES.map(item => path.resolve(repoRoot, item)),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const abs = path.resolve(repoRoot, candidate);
    if (fs.existsSync(abs)) return abs;
  }
  return path.resolve(repoRoot, "activity-web");
}

export function readChangedFilesFromGit(activityWebDir, { base = "origin/main", head = "HEAD" } = {}) {
  const result = spawnSync("git", ["diff", "--name-only", `${base}...${head}`], {
    cwd: activityWebDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git diff failed").trim());
  }
  return result.stdout
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function analyzeActivityWebImpact({ repoRoot, activityWebDir, changedFiles }) {
  const manifest = readJsonIfExists(path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json")) || {};
  const actionManifests = [
    readJsonIfExists(path.join(repoRoot, "skills/weex-admin-ops/scripts/action-cache.json")),
    readJsonIfExists(path.join(repoRoot, "skills/weex-frontend-ops/scripts/action-cache.json")),
  ].filter(Boolean);
  const actionsById = new Map(actionManifests.flatMap(item => item.actions || []).map(action => [action.id, action]));
  const scenariosById = new Map((manifest.scenarioCatalog || []).map(item => [item.scenarioId, item]));
  const normalizedChangedFiles = unique((changedFiles || []).map(normalizeRelPath).filter(Boolean));
  const affectedAreas = [];
  const scenarioIds = new Set();
  const caseIds = new Set();
  const actionIds = new Set();

  for (const file of normalizedChangedFiles) {
    for (const rule of IMPACT_RULES) {
      if (!rule.patterns.some(re => re.test(file))) continue;
      let area = affectedAreas.find(item => item.id === rule.id);
      if (!area) {
        area = { id: rule.id, title: rule.title, files: [] };
        affectedAreas.push(area);
      }
      area.files.push(file);
      for (const id of rule.scenarioIds) scenarioIds.add(id);
      for (const id of rule.caseIds) caseIds.add(id);
      for (const id of rule.actionIds) actionIds.add(id);
    }
  }

  for (const scenarioId of scenarioIds) {
    const scenario = scenariosById.get(scenarioId);
    for (const caseId of scenario?.caseIds || []) caseIds.add(caseId);
  }

  const recommendedScenarios = [...scenarioIds].map(id => {
    const scenario = scenariosById.get(id);
    return {
      id,
      title: scenario?.title || id,
      status: scenario?.status || "unknown",
      entrypoint: scenario?.entrypoint || "",
      selectionAliases: scenario?.selectionAliases || [],
    };
  });

  const recommendedActions = [...actionIds].map(id => {
    const action = actionsById.get(id);
    return {
      id,
      script: action?.script || "",
      status: action?.status || "unknown",
      description: action?.description || "",
      dryRunCommand: buildDryRunCommand(id, action),
    };
  });

  const automationCorpus = buildAutomationCorpus(repoRoot);
  const sourceFacts = extractSourceFacts(activityWebDir, normalizedChangedFiles);
  const coverageGaps = [
    ...findPotentialCoverageGaps(sourceFacts, automationCorpus),
    ...findUncoveredScenarioCases(recommendedScenarios, scenariosById),
  ];

  const selection = buildSelection(recommendedScenarios);
  const recommendedCommands = [];
  if (selection) {
    recommendedCommands.push(`node orchestrations/lottery-regression/scripts/run-full-headless.mjs --selection "${selection}" --dry-run`);
  }
  for (const action of recommendedActions) {
    if (action.dryRunCommand) recommendedCommands.push(action.dryRunCommand);
  }

  return {
    ok: true,
    activityWebDir,
    changedFiles: normalizedChangedFiles,
    affectedAreas,
    recommendedScenarios,
    recommendedCaseIds: sortCaseIds([...caseIds]),
    recommendedActions,
    recommendedCommands: unique(recommendedCommands),
    coverageGaps,
    sourceFacts,
  };
}

function buildDryRunCommand(id, action) {
  if (!action?.script) return "";
  if (action.script.startsWith("scripts/")) {
    return `node skills/weex-admin-ops/scripts/run-cached-action.mjs --action ${id} --dry-run`;
  }
  return "";
}

function buildSelection(scenarios) {
  const titles = scenarios
    .filter(item => item.entrypoint)
    .map(item => item.selectionAliases?.[0] || item.title)
    .filter(Boolean);
  return unique(titles).join(",");
}

function extractSourceFacts(activityWebDir, changedFiles) {
  const endpoints = [];
  const fields = [];
  const fieldModels = [];
  const enums = [];
  for (const relPath of changedFiles) {
    const abs = path.join(activityWebDir, relPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const text = fs.readFileSync(abs, "utf8");
    for (const value of extractApiEndpoints(text)) endpoints.push({ file: relPath, value });
    for (const value of extractLabels(text)) fields.push({ file: relPath, value });
    for (const value of extractModels(text)) fieldModels.push({ file: relPath, value });
    for (const value of extractEnums(text)) enums.push({ file: relPath, value });
  }
  return {
    endpoints: uniqueByValue(endpoints),
    fields: uniqueByValue(fields),
    fieldModels: uniqueByValue(fieldModels),
    enums: uniqueByValue(enums),
  };
}

function findPotentialCoverageGaps(sourceFacts, automationCorpus) {
  const gaps = [];
  for (const item of sourceFacts.endpoints) {
    const candidates = [item.value, `/prod-api${item.value}`];
    if (!candidates.some(candidate => automationCorpus.includes(candidate))) {
      gaps.push({ type: "endpoint", name: item.value, file: item.file, severity: "medium", reason: "changed API endpoint is not referenced by current automation corpus" });
    }
  }
  for (const item of sourceFacts.fields) {
    if (!automationCorpus.includes(item.value)) {
      gaps.push({ type: "field", name: item.value, file: item.file, severity: "low", reason: "changed UI label is not referenced by current automation corpus" });
    }
  }
  for (const item of sourceFacts.fieldModels) {
    if (!automationCorpus.includes(item.value)) {
      gaps.push({ type: "field-model", name: item.value, file: item.file, severity: "low", reason: "changed form model key is not referenced by current automation corpus" });
    }
  }
  for (const item of sourceFacts.enums) {
    if (!automationCorpus.includes(item.value)) {
      gaps.push({ type: "enum", name: item.value, file: item.file, severity: "medium", reason: "changed enum value is not referenced by current automation corpus" });
    }
  }
  return gaps;
}

function findUncoveredScenarioCases(scenarios, scenariosById) {
  const gaps = [];
  for (const scenarioRef of scenarios) {
    const scenario = scenariosById.get(scenarioRef.id);
    const automated = new Set(scenario?.automationCaseIds || []);
    const missing = (scenario?.caseIds || []).filter(caseId => !automated.has(caseId));
    if (!missing.length) continue;
    gaps.push({
      type: "case-automation",
      name: scenarioRef.id,
      title: scenario?.title || scenarioRef.id,
      severity: scenario?.status === "planned" ? "high" : "medium",
      missingCaseIds: missing,
      reason: "affected scenario has caseIds not connected to automationCaseIds",
    });
  }
  return gaps;
}

function buildAutomationCorpus(repoRoot) {
  const roots = [
    "docs/workflows",
    "docs/test-cases",
    "orchestrations",
    "skills/weex-admin-ops/scripts",
    "skills/weex-admin-ops/references",
    "skills/weex-frontend-ops/scripts",
    "skills/weex-frontend-ops/references",
  ];
  const chunks = [];
  for (const relRoot of roots) {
    const absRoot = path.join(repoRoot, relRoot);
    for (const file of listFiles(absRoot)) {
      if (!/\.(mjs|js|json|md|vue)$/.test(file)) continue;
      chunks.push(fs.readFileSync(file, "utf8"));
    }
  }
  return chunks.join("\n");
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "artifacts" || entry.name === "generated") continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(abs);
      else if (entry.isFile()) out.push(abs);
    }
  }
  return out;
}

function extractApiEndpoints(text) {
  const hits = [];
  for (const match of text.matchAll(/url:\s*['"`]([^'"`]+)['"`]/g)) {
    const value = match[1].trim();
    if (value.startsWith("/activity/") || value.startsWith("activity/")) {
      hits.push(value.startsWith("/") ? value : `/${value}`);
    }
  }
  return unique(hits);
}

function extractLabels(text) {
  const hits = [];
  for (const match of text.matchAll(/<(?:el-form-item|el-table-column|el-card)\b[^>]*\s(?:label|header)="([^"]+)"/g)) {
    const value = cleanLabel(match[1]);
    if (value) hits.push(value);
  }
  return unique(hits);
}

function extractModels(text) {
  const hits = [];
  for (const match of text.matchAll(/\bv-model(?:\.number)?="([^"]+)"/g)) {
    const value = lastIdentifier(match[1]);
    if (value) hits.push(value);
  }
  for (const match of text.matchAll(/\bprop="([^"]+)"/g)) {
    const value = lastIdentifier(match[1]);
    if (value) hits.push(value);
  }
  return unique(hits).filter(item => item.length > 1);
}

function extractEnums(text) {
  const hits = [];
  for (const match of text.matchAll(/\bvalue=['"]([A-Z][A-Z0-9_]{2,})['"]/g)) hits.push(match[1]);
  for (const match of text.matchAll(/\bvalue:\s*['"]([A-Z][A-Z0-9_]{2,})['"]/g)) hits.push(match[1]);
  return unique(hits);
}

function cleanLabel(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.includes("${") || text.length > 40) return "";
  return text;
}

function lastIdentifier(value) {
  const text = String(value || "").trim();
  if (!text || text.includes("[") || text.includes("${")) return "";
  const parts = text.split(".");
  return parts[parts.length - 1].replace(/[^A-Za-z0-9_]/g, "");
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeRelPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.?\//, "").trim();
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueByValue(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.file}:${item.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sortCaseIds(caseIds) {
  return unique(caseIds).sort((a, b) => {
    const pa = String(a).match(/^([A-Z]+)-(\d+)$/);
    const pb = String(b).match(/^([A-Z]+)-(\d+)$/);
    if (!pa || !pb || pa[1] !== pb[1]) return String(a).localeCompare(String(b));
    return Number(pa[2]) - Number(pb[2]);
  });
}

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function auditOne({ repoRoot, actionCache, spec }) {
  const missing = [];

  const mustExist = [
    ...(spec.mappings || []),
    ...(spec.operations || []),
    ...(spec.scripts || []),
  ];
  for (const rel of mustExist) {
    if (!exists(repoRoot, rel)) missing.push(rel);
  }

  const actions = Array.isArray(actionCache?.actions) ? actionCache.actions : [];
  const haveWizard = actions.some(a => a?.id === spec.actions?.wizardId && a?.script === spec.actions?.wizardScript);
  const haveModules = actions.some(a => a?.id === spec.actions?.modulesId && a?.script === spec.actions?.modulesScript);
  if (!haveWizard) missing.push(`action-cache: ${spec.actions?.wizardId || "<missing>"}`);
  if (!haveModules) missing.push(`action-cache: ${spec.actions?.modulesId || "<missing>"}`);

  return { ok: missing.length === 0, type: spec.type, label: spec.label, missing };
}

function print(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(__filename), "../../../..");

  const actionCachePath = path.join(repoRoot, "skills/weex-admin-ops/scripts/action-cache.json");
  const actionCache = readJson(actionCachePath);

  // Scope: non-newbie & non-lottery activity types that are expected to support:
  // - wizard (NL full-config) + modules config
  // - mappings (modules + fields)
  // - operations doc
  // - explicit deps full-config script + module-config script
  const specs = [
    {
      type: "TRADING_COMPETITION",
      label: "交易大赛",
      mappings: [
        "skills/weex-admin-ops/references/mappings/competition-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/competition-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-competition.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/competition-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/competition-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-competition-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_trading_competition_activity",
        wizardScript: "scripts/competition-config-wizard-api.mjs",
        modulesId: "configure_trading_competition_activity_modules",
        modulesScript: "scripts/competition-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "RACE_COMPETITION",
      label: "交易竞速赛",
      mappings: [
        "skills/weex-admin-ops/references/mappings/race-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/race-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-race.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/race-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_race_competition_activity",
        wizardScript: "scripts/race-config-wizard-api.mjs",
        modulesId: "configure_race_competition_activity_modules",
        modulesScript: "scripts/race-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "TRACE_PRO",
      label: "小活动型活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/tracepro-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/tracepro-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-tracepro.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/tracepro-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/tracepro-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_trace_pro_activity",
        wizardScript: "scripts/tracepro-config-wizard-api.mjs",
        modulesId: "configure_trace_pro_activity_modules",
        modulesScript: "scripts/tracepro-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "CUSTOMIZED",
      label: "定制化活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/customized-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/customized-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-customized.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/customized-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/customized-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_customized_activity",
        wizardScript: "scripts/customized-config-wizard-api.mjs",
        modulesId: "configure_customized_activity_modules",
        modulesScript: "scripts/customized-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "RECHARGE_TRANS_TASK",
      label: "充值交易活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/recharge-trans-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/recharge-trans-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-recharge-trans-task.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/recharge-trans-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/recharge-trans-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-recharge-trans-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_recharge_trans_task_activity",
        wizardScript: "scripts/recharge-trans-config-wizard-api.mjs",
        modulesId: "configure_recharge_trans_task_activity_modules",
        modulesScript: "scripts/recharge-trans-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "AGENT",
      label: "人人代理活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/agent-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/agent-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-agent.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/agent-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/agent-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-agent-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_agent_activity",
        wizardScript: "scripts/agent-config-wizard-api.mjs",
        modulesId: "configure_agent_activity_modules",
        modulesScript: "scripts/agent-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "CONTRACT_MINING",
      label: "合约挖矿活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/contract-mining-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/contract-mining-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-contract-mining.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/contract-mining-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/contract-mining-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_contract_mining_activity",
        wizardScript: "scripts/contract-mining-config-wizard-api.mjs",
        modulesId: "configure_contract_mining_activity_modules",
        modulesScript: "scripts/contract-mining-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "FLIP",
      label: "小丑牌活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/flip-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/flip-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-flip.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/flip-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/flip-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-flip-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_flip_activity",
        wizardScript: "scripts/flip-config-wizard-api.mjs",
        modulesId: "configure_flip_activity_modules",
        modulesScript: "scripts/flip-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "GUESS",
      label: "竞猜大赛",
      mappings: [
        "skills/weex-admin-ops/references/mappings/guess-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/guess-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-guess.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/guess-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_guess_activity",
        wizardScript: "scripts/guess-config-wizard-api.mjs",
        modulesId: "configure_guess_activity_modules",
        modulesScript: "scripts/guess-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "MONOPOLY_WORLD_CUP",
      label: "大富翁世界杯",
      mappings: [
        "skills/weex-admin-ops/references/mappings/monopoly-worldcup-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/monopoly-worldcup-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-monopoly-worldcup.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/monopoly-worldcup-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/monopoly-worldcup-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_monopoly_world_cup_activity",
        wizardScript: "scripts/monopoly-worldcup-config-wizard-api.mjs",
        modulesId: "configure_monopoly_world_cup_activity_modules",
        modulesScript: "scripts/monopoly-worldcup-activity-module-config-fast-api.mjs",
      },
    },
    {
      type: "AGENT_TRACE_PRO",
      label: "代理小活动",
      mappings: [
        "skills/weex-admin-ops/references/mappings/agent-tracepro-activity-modules.md",
        "skills/weex-admin-ops/references/mappings/agent-tracepro-activity-fields.md",
      ],
      operations: ["skills/weex-admin-ops/references/operations/activity-management-agent-tracepro.md"],
      scripts: [
        "skills/weex-admin-ops/scripts/agent-tracepro-config-wizard-api.mjs",
        "skills/weex-admin-ops/scripts/agent-tracepro-activity-module-config-fast-api.mjs",
        "skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs",
      ],
      actions: {
        wizardId: "configure_agent_trace_pro_activity",
        wizardScript: "scripts/agent-tracepro-config-wizard-api.mjs",
        modulesId: "configure_agent_trace_pro_activity_modules",
        modulesScript: "scripts/agent-tracepro-activity-module-config-fast-api.mjs",
      },
    },
  ];

  const results = specs.map(spec => auditOne({ repoRoot, actionCache, spec }));
  const ok = results.every(r => r.ok);
  print({
    ok,
    scope: "weex-admin-ops activity full-config coverage (excluding BEGINNER_TASK, LOTTERY)",
    actionCachePath: "skills/weex-admin-ops/scripts/action-cache.json",
    results,
  });
  return ok ? 0 : 2;
}

try {
  process.exitCode = await run();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}


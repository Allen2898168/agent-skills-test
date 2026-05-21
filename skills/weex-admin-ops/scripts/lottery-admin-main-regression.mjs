#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson, readJson } from "./lib/cli.mjs";
import { loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import {
  buildRegressionCaseResults,
  resolvePhaseCommands,
} from "./lib/lottery-admin-main-regression-lib.mjs";

const { repoRoot } = pathsFrom(import.meta.url);
const manifestPath = path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json");

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs --dry-run
  node skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs --visible

Options:
  --title-prefix <text>   activity title prefix for the created draft
  --alias-prefix <text>   activity alias prefix for the created draft
  --uid <uid>             uid used by agent/user participant-scope task defaults
  --country <text>        country used by country participant-scope task default
  --case-ids <csv>        limit execution/reporting to selected regression case ids
  --visible               run child browser workflows in headed mode
  --dry-run               print the planned phases without writing data
  --help                  show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.caseIds = String(args.caseIds || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return args;
}

function buildTimeWindow() {
  const now = new Date();
  const start = new Date(now.getTime() + 10 * 60 * 1000);
  const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTime(start),
    end: formatDateTime(end),
  };
}

function formatDateTime(value) {
  const pad = number => String(number).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

export function buildPlan(args) {
  const timeWindow = buildTimeWindow();
  return {
    actionId: "lottery_admin_main_regression",
    mode: args.visible ? "visible_browser" : "headless_ui",
    phases: [
      {
        phaseId: "create_prizes",
        dependsOn: [],
        description: "Create stable admin regression prizes.",
        caseIds: ["PM-01", "PM-02", "PM-03", "PM-04", "PM-05", "PM-06", "PM-07", "PM-08", "PM-09", "PM-10", "PM-11"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-regression-prizes.mjs"],
          ["skills/weex-admin-ops/scripts/prize-row-actions.mjs", "--category", "赠金", "--subtype", "赠金", "--count", "1", "--name-prefix", "操作列临时奖品", "--alias-prefix", "prize_row_action_temp"]
        ]
      },
      {
        phaseId: "create_register_templates",
        dependsOn: [],
        description: "Create stable registration templates for admin regression.",
        caseIds: ["RT-03", "RT-04", "RT-05", "RT-06", "RT-07", "RT-08", "RT-09"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--name-prefix", "自动化报名模板"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "manual", "--name-prefix", "自动化报名模板"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "team", "--name-prefix", "自动化报名模板", "--min-team", "2"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto_manual", "--name-prefix", "自动化报名模板"]
        ]
      },
      {
        phaseId: "create_roulette_tasks",
        dependsOn: [],
        description: "Create roulette tasks for representative participant scopes.",
        caseIds: ["TM-07", "TM-08", "TM-09", "TM-10", "TM-11"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks.mjs", "--scopes", "all,vip,newuser,nocharge,olduser,agent,user,country", "--uid", String(args.uid || "9881271952"), "--country", String(args.country || "中国"), "--reward-max", "100"]
        ]
      },
      {
        phaseId: "create_lottery_activity_draft",
        dependsOn: ["create_prizes", "create_register_templates", "create_roulette_tasks"],
        description: "Create the main regression lottery draft with the verified template chain.",
        caseIds: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-11", "AC-12", "AC-13"],
        commands: [
          [
            "skills/weex-admin-ops/scripts/create-lottery-activity-draft.mjs",
            "--headless-ui",
            "--title-prefix",
            String(args.titlePrefix || "后管主回归"),
            "--alias-prefix",
            String(args.aliasPrefix || "lottery-admin-main"),
            "--start",
            timeWindow.start,
            "--end",
            timeWindow.end,
            "--style",
            "圆形转盘",
            "--no-preapply"
          ]
        ]
      },
      {
        phaseId: "online_lottery_activity",
        dependsOn: ["create_lottery_activity_draft"],
        description: "Put the created draft online.",
        caseIds: ["ST-01"],
        commands: [
          ["skills/weex-admin-ops/scripts/online-lottery-activity.mjs", "--activity-alias", "<created-alias>"]
        ]
      }
    ]
  };
}

function parseLastJson(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  let last = null;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{") continue;
    const candidate = source.slice(index);
    try {
      last = JSON.parse(candidate);
    } catch {}
  }
  return last;
}

function runNodeJson(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
  });
  const stdoutJson = parseLastJson(result.stdout);
  const stderrJson = parseLastJson(result.stderr);
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    payload: stdoutJson || stderrJson,
  };
}

function applyMode(command, args) {
  const withMode = [...command];
  if (args.visible) withMode.push("--visible");
  return withMode;
}

function readCoveredEntries(caseIds) {
  const manifest = readJson(manifestPath);
  return manifest.entries.filter(item => caseIds.includes(item.caseId));
}

function hydratePlanWithCases(plan) {
  return {
    ...plan,
    phases: plan.phases.map(phase => ({
      ...phase,
      caseEntries: readCoveredEntries(phase.caseIds),
    })),
  };
}

function filterPlanByCaseIds(plan, selectedCaseIds) {
  if (!selectedCaseIds?.length) return { ...plan, selectedCaseIds: [] };
  const selected = new Set(selectedCaseIds);
  const phaseById = new Map(plan.phases.map(phase => [phase.phaseId, phase]));
  const selectedPhaseIds = new Set();

  for (const phase of plan.phases) {
    const matchingCases = (phase.caseEntries || []).filter(item => selected.has(item.caseId));
    if (!matchingCases.length) continue;
    selectedPhaseIds.add(phase.phaseId);
    for (const dependency of phase.dependsOn || []) selectedPhaseIds.add(dependency);
  }

  if (!selectedPhaseIds.size) {
    throw new Error(`No admin main regression phases matched case ids: ${selectedCaseIds.join(", ")}`);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const phaseId of Array.from(selectedPhaseIds)) {
      const phase = phaseById.get(phaseId);
      for (const dependency of phase?.dependsOn || []) {
        if (!selectedPhaseIds.has(dependency)) {
          selectedPhaseIds.add(dependency);
          changed = true;
        }
      }
    }
  }

  return {
    ...plan,
    selectedCaseIds,
    phases: plan.phases
      .filter(phase => selectedPhaseIds.has(phase.phaseId))
      .map(phase => {
        const caseEntries = (phase.caseEntries || []).filter(item => selected.has(item.caseId));
        return {
          ...phase,
          caseEntries,
          caseIds: caseEntries.map(item => item.caseId),
        };
      }),
  };
}

function resolveActivityTarget(payload) {
  const activityId = payload?.verifyFirst?.id || payload?.verifyFirst?.activityId || payload?.activityId || "";
  const activityAlias = payload?.alias || payload?.verifyFirst?.showUrl || payload?.activityAlias || "";
  return { activityId: activityId ? String(activityId) : "", activityAlias: activityAlias ? String(activityAlias) : "" };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  loadLocalEnv(repoRoot);
  const plan = filterPlanByCaseIds(hydratePlanWithCases(buildPlan(args)), args.caseIds);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, ...plan });
    return 0;
  }

  const phaseResults = [];
  let createdActivity = { activityId: "", activityAlias: "" };

  for (const phase of plan.phases) {
    if (phase.phaseId === "online_lottery_activity" && !createdActivity.activityAlias && !createdActivity.activityId) {
      const failedCaseResults = buildRegressionCaseResults(plan, phaseResults);
      printJson({
        ok: false,
        actionId: plan.actionId,
        failedPhase: phase.phaseId,
        mode: plan.mode,
        phaseResults,
        caseResults: failedCaseResults,
        error: "Missing created activity target from previous phase.",
      }, process.stderr);
      return 1;
    }
    const commandArgsList = resolvePhaseCommands(phase, args, createdActivity);
    const childResults = [];
    let phaseOk = true;
    let phasePayload = null;
    for (const commandArgs of commandArgsList) {
      const result = runNodeJson(commandArgs);
      childResults.push({
        command: [process.execPath, ...commandArgs],
        ok: result.exitCode === 0 && result.payload?.ok !== false,
        payload: result.payload,
      });
      if (!childResults[childResults.length - 1].ok) {
        phaseOk = false;
        phasePayload = result.payload;
        break;
      }
      phasePayload = result.payload;
      if (phase.phaseId === "create_lottery_activity_draft") {
        createdActivity = resolveActivityTarget(result.payload);
      }
    }
    const phaseSummary = {
      phaseId: phase.phaseId,
      description: phase.description,
      caseIds: phase.caseIds,
      cases: phase.caseEntries,
      commands: childResults.map(item => item.command),
      ok: phaseOk,
      payload: phasePayload,
      childResults,
    };
    phaseResults.push(phaseSummary);

    if (!phaseSummary.ok) {
      const caseResults = buildRegressionCaseResults(plan, phaseResults);
      printJson({
        ok: false,
        actionId: plan.actionId,
        failedPhase: phase.phaseId,
        mode: plan.mode,
        phaseResults,
        caseResults,
      }, process.stderr);
      return 1;
    }
  }

  const caseResults = buildRegressionCaseResults(plan, phaseResults);
  printJson({
    ok: true,
    actionId: plan.actionId,
    mode: plan.mode,
    selectedCaseIds: plan.selectedCaseIds || [],
    createdActivity,
    phaseResults,
    caseResults,
  });
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await run();
  } catch (error) {
    printJson({ ok: false, error: error.message }, process.stderr);
    process.exitCode = 1;
  }
}

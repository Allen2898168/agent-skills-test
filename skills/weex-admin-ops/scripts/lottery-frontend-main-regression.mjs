#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson, readJson } from "./lib/cli.mjs";
import { loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import {
  buildFrontendRegressionCaseResults,
  resolvePhaseCommands,
} from "./lib/lottery-frontend-main-regression-lib.mjs";

const { repoRoot, skillRoot } = pathsFrom(import.meta.url);
const manifestPath = path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json");

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/lottery-frontend-main-regression.mjs --dry-run
  node skills/weex-admin-ops/scripts/lottery-frontend-main-regression.mjs --activity-alias <alias> --visible

Options:
  --activity-alias <text> existing online lottery alias to reuse
  --case-ids <csv>        limit execution/reporting to selected regression case ids
  --recharge-amount <n>   mq recharge amount used to prepare draw count
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
  const start = new Date(now.getTime() + 2 * 60 * 1000);
  const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  const pad = number => String(number).padStart(2, "0");
  const format = value => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  return { start: format(start), end: format(end) };
}

export function buildPlan(args) {
  const timeWindow = buildTimeWindow();
  const phases = [];
  if (!args.activityAlias) {
    phases.push({
      phaseId: "create_lottery_activity_draft",
      dependsOn: [],
      description: "Create an online-capable lottery activity for frontend regression.",
      caseIds: [],
      commands: [[
        "skills/weex-admin-ops/scripts/create-lottery-activity-draft.mjs",
        "--headless-ui",
        "--title-prefix",
        String(args.titlePrefix || "前端主回归"),
        "--alias-prefix",
        String(args.aliasPrefix || "lf"),
        "--start",
        timeWindow.start,
        "--end",
        timeWindow.end,
        "--style",
        "圆形转盘",
        "--no-preapply",
      ]],
    });
    phases.push({
      phaseId: "online_lottery_activity",
      dependsOn: ["create_lottery_activity_draft"],
      description: "Put the created frontend regression activity online.",
      caseIds: [],
      commands: [[
        "skills/weex-admin-ops/scripts/online-lottery-activity.mjs",
        "--activity-alias",
        "<created-alias>",
      ]],
    });
  }
  phases.push({
    phaseId: "run_frontend_main_flow",
    dependsOn: args.activityAlias ? [] : ["online_lottery_activity"],
    description: "Run the frontend signup, mq recharge, single draw, and reward-record flow.",
    caseIds: ["FE-01", "FE-07", "FE-17", "FE-19", "FE-22", "FE-32", "FE-33", "FE-34", "FE-35", "FE-48", "FE-49", "FE-50", "FE-79", "FE-81", "FE-82", "FE-83", "FE-84"],
    commands: [[
      "skills/weex-admin-ops/scripts/lottery-frontend-main-flow.mjs",
      "--activity-alias",
      args.activityAlias ? String(args.activityAlias) : "<created-alias>",
      "--recharge-amount",
      String(args.rechargeAmount || "1000"),
      "--wait-for-start-ms",
      String(args.waitForStartMs || "240000"),
    ]],
  });
  return {
    actionId: "lottery_frontend_main_regression",
    mode: args.visible ? "visible_browser" : "headless_ui",
    phases,
  };
}

function parseLastJson(text) {
  const source = String(text || "").trim();
  if (!source) return null;
  const lines = source.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trimStart();
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    const candidate = lines.slice(index).join("\n").trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function runNodeJson(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    payload: parseLastJson(result.stdout) || parseLastJson(result.stderr),
  };
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
  if (!selectedPhaseIds.size) throw new Error(`No frontend main regression phases matched case ids: ${selectedCaseIds.join(", ")}`);
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

function resolveActivityTarget(payload, explicitAlias) {
  const activityId = payload?.verifyFirst?.id || payload?.verifyFirst?.activityId || payload?.activityId || "";
  const activityAlias = explicitAlias || payload?.alias || payload?.verifyFirst?.showUrl || payload?.activityAlias || "";
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
  let createdActivity = { activityId: "", activityAlias: args.activityAlias ? String(args.activityAlias) : "" };
  let hadPhaseFailure = false;

  for (const phase of plan.phases) {
    const unmetDependencies = (phase.dependsOn || []).filter(dependency => {
      const dependencyPhase = phaseResults.find(item => item.phaseId === dependency);
      return !dependencyPhase || !dependencyPhase.ok;
    });
    if (unmetDependencies.length) continue;
    const commandArgsList = resolvePhaseCommands(phase, args, createdActivity);
    const childResults = [];
    let phaseOk = true;
    let phasePayload = null;
    for (const commandArgs of commandArgsList) {
      const result = runNodeJson(commandArgs);
      const child = {
        command: [process.execPath, ...commandArgs],
        ok: result.exitCode === 0 && result.payload?.ok !== false,
        payload: result.payload,
      };
      childResults.push(child);
      if (!child.ok) {
        phaseOk = false;
        phasePayload = result.payload;
        break;
      }
      phasePayload = result.payload;
      if (phase.phaseId === "create_lottery_activity_draft") {
        createdActivity = resolveActivityTarget(result.payload, createdActivity.activityAlias);
      }
      if (phase.phaseId === "run_frontend_main_flow") {
        createdActivity = resolveActivityTarget(result.payload, createdActivity.activityAlias);
      }
    }
    phaseResults.push({
      phaseId: phase.phaseId,
      description: phase.description,
      caseIds: phase.caseIds,
      cases: phase.caseEntries,
      commands: childResults.map(item => item.command),
      ok: phaseOk,
      payload: phasePayload,
      childResults,
    });
    if (!phaseOk) hadPhaseFailure = true;
  }

  const caseResults = buildFrontendRegressionCaseResults(plan, phaseResults);
  printJson({
    ok: !hadPhaseFailure,
    actionId: plan.actionId,
    mode: plan.mode,
    selectedCaseIds: plan.selectedCaseIds || [],
    createdActivity,
    phaseResults,
    caseResults,
  }, hadPhaseFailure ? process.stderr : process.stdout);
  return hadPhaseFailure ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await run();
  } catch (error) {
    printJson({ ok: false, error: error.message }, process.stderr);
    process.exitCode = 1;
  }
}

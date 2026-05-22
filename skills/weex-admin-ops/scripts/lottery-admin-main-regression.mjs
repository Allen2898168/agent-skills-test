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
  const shanghaiNow = pseudoDateInTimeZone(now, "Asia/Shanghai");
  const start = new Date(shanghaiNow.getTime() + 30 * 60 * 1000);
  const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTime(start),
    end: formatDateTime(end),
  };
}

function formatDateTime(value) {
  const pad = number => String(number).padStart(2, "0");
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
}

function pseudoDateInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ));
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
        caseIds: ["RT-03", "RT-04", "RT-05", "RT-06"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--name-prefix", "自动化报名模板"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "manual", "--name-prefix", "自动化报名模板"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "team", "--name-prefix", "自动化报名模板", "--min-team", "2"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto_manual", "--name-prefix", "自动化报名模板"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--platform-scopes", "channel_invite,natural,non_active,mixed,fake_money", "--name-prefix", "自动化报名模板"],
          ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--platform-scopes", "non_active", "--register-start", timeWindow.start, "--register-end", timeWindow.end, "--name-prefix", "自动化报名模板"]
        ]
      },
      {
        phaseId: "verify_register_template_search",
        dependsOn: ["create_register_templates"],
        description: "Verify registration template search by name and template id.",
        caseIds: ["RT-01", "RT-02"],
        commands: [
          ["skills/weex-admin-ops/scripts/register-template-search-checks.mjs", "--name-prefix", "自动化报名模板"]
        ]
      },
      {
        phaseId: "verify_register_template_row_actions",
        dependsOn: [],
        description: "Verify registration template row actions view/modify/delete.",
        caseIds: ["RT-07", "RT-08", "RT-09"],
        commands: [
          ["skills/weex-admin-ops/scripts/register-template-row-actions.mjs", "--name-prefix", "操作列临时模板"]
        ]
      },
      {
        phaseId: "create_roulette_tasks",
        dependsOn: [],
        description: "Create roulette tasks for representative participant scopes.",
        caseIds: ["TM-01", "TM-02", "TM-03", "TM-04", "TM-05", "TM-06", "TM-07", "TM-09"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks.mjs", "--scopes", "all,vip,newuser,nocharge,olduser,agent,user,country", "--uid", String(args.uid || "9881271952"), "--country", String(args.country || "中国"), "--reward-max", "100"]
        ]
      },
      {
        phaseId: "create_roulette_condition_tasks",
        dependsOn: [],
        description: "Create roulette tasks for representative task-condition branches.",
        caseIds: ["TM-08"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-roulette-condition-tasks.mjs", "--conditions", "kol,contract,spot,recharge"]
        ]
      },
      {
        phaseId: "create_roulette_reward_mode_tasks",
        dependsOn: [],
        description: "Create roulette tasks for limited and normal+rights reward modes.",
        caseIds: ["TM-10", "TM-11"],
        commands: [
          ["skills/weex-admin-ops/scripts/create-roulette-reward-mode-tasks.mjs", "--modes", "limited,rights"]
        ]
      },
      {
        phaseId: "create_lottery_activity_draft",
        dependsOn: [],
        description: "Create the main regression lottery draft with the verified template chain.",
        caseIds: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-11", "AC-12", "AC-13"],
        commands: [
          [
            "skills/weex-admin-ops/scripts/create-lottery-activity-draft.mjs",
            "--headless-ui",
            "--title-prefix",
            String(args.titlePrefix || "后管主回归"),
            "--alias-prefix",
            String(args.aliasPrefix || "ln"),
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
        phaseId: "verify_activity_list_draft",
        dependsOn: ["create_lottery_activity_draft"],
        description: "Verify draft activity list search filters and draft-row action visibility.",
        caseIds: ["AL-01", "AL-02", "AL-03", "AL-04", "AL-05", "AL-06"],
        commands: [
          ["skills/weex-admin-ops/scripts/lottery-activity-list-draft-checks.mjs", "--activity-alias", "<created-alias>"]
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
      },
      {
        phaseId: "verify_activity_list_online",
        dependsOn: ["online_lottery_activity"],
        description: "Verify online activity row actions and copied draft creation from the list.",
        caseIds: ["AL-07", "AC-15", "ST-03"],
        commands: [
          ["skills/weex-admin-ops/scripts/lottery-activity-list-online-checks.mjs", "--activity-alias", "<created-alias>"]
        ]
      },
      {
        phaseId: "offline_lottery_activity",
        dependsOn: ["online_lottery_activity"],
        description: "Take the created online activity offline after copy and draft-delete checks pass.",
        caseIds: ["ST-02"],
        commands: [
          ["skills/weex-admin-ops/scripts/offline-lottery-activity.mjs", "--activity-alias", "<created-alias>"]
        ]
      }
    ]
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

function compactPhasePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const verifyFirst = payload.verifyFirst || {};
  const verifyItem = payload.verifyItem || {};
  const target = payload.target || {};
  return {
    ok: payload.ok,
    error: payload.error || "",
    finalUrl: payload.finalUrl || payload.url || "",
    title: payload.title || "",
    alias: payload.alias || target.activityAlias || verifyFirst.showUrl || "",
    activityId: payload.activityId || target.activityId || verifyFirst.id || verifyFirst.activityId || "",
    status: verifyItem.status || verifyFirst.status || "",
    verifyTotal: payload.verifyTotal || 0,
    createStatus: payload.createStatus || null,
    createBody: payload.createBody ? { code: payload.createBody.code || null, msg: payload.createBody.msg || "" } : null,
    onlineBody: payload.onlineBody ? { code: payload.onlineBody.code || null, msg: payload.onlineBody.msg || "" } : null,
    offlineBody: payload.offlineBody ? { code: payload.offlineBody.code || null, msg: payload.offlineBody.msg || "" } : null,
    verifyFirst: Object.keys(verifyFirst).length ? {
      activityId: verifyFirst.activityId || verifyFirst.id || "",
      showUrl: verifyFirst.showUrl || "",
      title: verifyFirst.title || "",
      status: verifyFirst.status || "",
      prizeCount: Array.isArray(verifyFirst.prize) ? verifyFirst.prize.length : 0,
      taskCount: Array.isArray(verifyFirst.taskConfig)
        ? verifyFirst.taskConfig.length
        : Array.isArray(verifyFirst.taskRequirement)
          ? verifyFirst.taskRequirement.length
          : 0,
    } : null,
    verifyItem: Object.keys(verifyItem).length ? {
      activityId: verifyItem.activityId || verifyItem.id || "",
      showUrl: verifyItem.showUrl || "",
      title: verifyItem.title || "",
      status: verifyItem.status || "",
    } : null,
    searchChecks: payload.searchChecks || null,
    draftRowActions: payload.draftRowActions || null,
    onlineRowActions: payload.onlineRowActions || null,
    copyCheck: payload.copyCheck ? {
      copiedId: payload.copyCheck.copiedId || "",
      copiedAlias: payload.copyCheck.copiedAlias || "",
      submit: payload.copyCheck.submit || null,
      directCopy: payload.copyCheck.directCopy || null,
    } : null,
    deleteCopiedDraft: payload.deleteCopiedDraft || null,
    responses: Array.isArray(payload.responses) ? payload.responses.slice(-6) : [],
    errors: payload.errors ? {
      formErrors: Array.isArray(payload.errors.formErrors) ? payload.errors.formErrors.slice(0, 8) : [],
      messages: Array.isArray(payload.errors.messages) ? payload.errors.messages.slice(0, 8) : [],
    } : null,
  };
}

function compactPhaseResults(phaseResults) {
  return phaseResults.map(phase => ({
    phaseId: phase.phaseId,
    description: phase.description,
    caseIds: phase.caseIds,
    cases: phase.cases,
    commands: phase.commands,
    ok: phase.ok,
    payload: compactPhasePayload(phase.payload),
    childResults: Array.isArray(phase.childResults)
      ? phase.childResults.map(child => ({
          command: child.command,
          ok: child.ok,
          payload: compactPhasePayload(child.payload),
        }))
      : [],
  }));
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
  let hadPhaseFailure = false;

  for (const phase of plan.phases) {
    const unmetDependencies = (phase.dependsOn || []).filter(dependency => {
      const dependencyPhase = phaseResults.find(item => item.phaseId === dependency);
      return !dependencyPhase || !dependencyPhase.ok;
    });
    if (unmetDependencies.length) {
      continue;
    }
    if (phase.phaseId === "online_lottery_activity" && !createdActivity.activityAlias && !createdActivity.activityId) {
      hadPhaseFailure = true;
      phaseResults.push({
        phaseId: phase.phaseId,
        description: phase.description,
        caseIds: phase.caseIds,
        cases: phase.caseEntries,
        commands: [],
        ok: false,
        payload: { ok: false, error: "Missing created activity target from previous phase." },
        childResults: [],
      });
      continue;
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
      hadPhaseFailure = true;
    }
  }

  const caseResults = buildRegressionCaseResults(plan, phaseResults);
  const reportPhaseResults = compactPhaseResults(phaseResults);
  printJson({
    ok: !hadPhaseFailure,
    actionId: plan.actionId,
    mode: plan.mode,
    selectedCaseIds: plan.selectedCaseIds || [],
    createdActivity,
    phaseResults: reportPhaseResults,
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

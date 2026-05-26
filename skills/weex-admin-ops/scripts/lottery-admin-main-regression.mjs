#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";
import fs from "node:fs";
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
  --concurrency <n>       max parallel phases without dependencies (default 10)
  --command-timeout-ms <n>
                        per child command timeout in milliseconds (default 300000)
  --report-path <path>   write the full JSON report to this path (recommended for full runs)
  --compact              print only compact summary JSON to stdout/stderr
  --visible               run child browser workflows in headed mode
  --dry-run               print the planned phases without writing data
  --help                  show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run", "--compact"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.concurrency = Math.max(1, Math.min(10, Number(args.concurrency || 10)));
  args.commandTimeoutMs = Math.max(30000, Number(args.commandTimeoutMs || 300000));
  args.reportPath = args.reportPath ? String(args.reportPath) : "";
  args.compact = Boolean(args.compact);
  args.caseIds = String(args.caseIds || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return args;
}

function buildTimeWindow() {
  const now = new Date();
  const start = new Date(now.getTime() + 30 * 60 * 1000);
  const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function formatDateTimeInTimeZone(date, timeZone) {
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
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function buildPlan(args) {
  const timeWindow = buildTimeWindow();
  const useFastApi = !args.visible;
  const script = (fastApiScript, uiScript) => useFastApi ? fastApiScript : uiScript;
  return {
    actionId: "lottery_admin_main_regression",
    mode: args.visible ? "visible_browser" : "headless_api",
    phases: [
      {
        phaseId: "create_regression_prizes",
        dependsOn: [],
        description: "Create stable admin regression prizes.",
        caseIds: ["PM-01", "PM-02", "PM-03", "PM-04", "PM-05", "PM-06", "PM-07"],
        commands: [
          [script("skills/weex-admin-ops/scripts/create-regression-prizes-fast-api.mjs", "skills/weex-admin-ops/scripts/create-regression-prizes.mjs")],
        ]
      },
      {
        phaseId: "prize_row_actions",
        dependsOn: ["create_regression_prizes"],
        description: "Verify prize row actions view/modify/copy/delete by creating a temporary prize and performing operations.",
        caseIds: ["PM-08", "PM-09", "PM-10", "PM-11"],
        commands: [
          [script("skills/weex-admin-ops/scripts/prize-row-actions-fast-api.mjs", "skills/weex-admin-ops/scripts/prize-row-actions.mjs"), "--category", "赠金", "--subtype", "赠金", "--count", "1", "--name-prefix", "操作列临时奖品", "--alias-prefix", "prize_row_action_temp"]
        ]
      },
      {
        phaseId: "create_register_templates",
        dependsOn: [],
        description: "Create stable registration templates for admin regression.",
        caseIds: ["RT-03", "RT-04", "RT-05", "RT-06"],
        commands: [
          [script("skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs", "skills/weex-admin-ops/scripts/create-register-templates.mjs"), "--signup-modes", "auto", "--name-prefix", "自动化报名模板"],
          [script("skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs", "skills/weex-admin-ops/scripts/create-register-templates.mjs"), "--signup-modes", "manual", "--name-prefix", "自动化报名模板"],
          [script("skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs", "skills/weex-admin-ops/scripts/create-register-templates.mjs"), "--signup-modes", "team", "--name-prefix", "自动化报名模板", "--min-team", "2"],
          [script("skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs", "skills/weex-admin-ops/scripts/create-register-templates.mjs"), "--signup-modes", "auto_manual", "--name-prefix", "自动化报名模板"],
          [script("skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs", "skills/weex-admin-ops/scripts/create-register-templates.mjs"), "--signup-modes", "auto", "--platform-scopes", "channel_invite,natural,non_active,mixed,fake_money", "--name-prefix", "自动化报名模板"],
          [script("skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs", "skills/weex-admin-ops/scripts/create-register-templates.mjs"), "--signup-modes", "auto", "--platform-scopes", "non_active", "--register-start", timeWindow.start, "--register-end", timeWindow.end, "--name-prefix", "自动化报名模板"]
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
          [script("skills/weex-admin-ops/scripts/register-template-row-actions-fast-api.mjs", "skills/weex-admin-ops/scripts/register-template-row-actions.mjs"), "--name-prefix", "操作列临时模板"]
        ]
      },
      {
        phaseId: "create_roulette_tasks",
        dependsOn: [],
        description: "Create roulette tasks for representative participant scopes.",
        caseIds: ["TM-01", "TM-02", "TM-03", "TM-04", "TM-05", "TM-06", "TM-07", "TM-09"],
        commands: [
          [script("skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks-fast-api.mjs", "skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks.mjs"), "--scopes", "all,vip,newuser,nocharge,olduser,agent,user,country", "--uid", String(args.uid || "9881271952"), "--country", String(args.country || "中国"), "--reward-max", "100"]
        ]
      },
      {
        phaseId: "create_roulette_condition_tasks",
        dependsOn: [],
        description: "Create roulette tasks for representative task-condition branches.",
        caseIds: ["TM-08"],
        commands: [
          [script("skills/weex-admin-ops/scripts/create-roulette-condition-tasks-fast-api.mjs", "skills/weex-admin-ops/scripts/create-roulette-condition-tasks.mjs"), "--conditions", "kol,contract,spot,recharge"]
        ]
      },
      {
        phaseId: "create_roulette_reward_mode_tasks",
        dependsOn: [],
        description: "Create roulette tasks for limited and normal+rights reward modes.",
        caseIds: ["TM-10", "TM-11"],
        commands: [
          [script("skills/weex-admin-ops/scripts/create-roulette-reward-mode-tasks-fast-api.mjs", "skills/weex-admin-ops/scripts/create-roulette-reward-mode-tasks.mjs"), "--modes", "limited,rights"]
        ]
      },
      {
        phaseId: "create_lottery_activity_draft",
        dependsOn: [
          "create_regression_prizes",
          "create_register_templates",
          "create_roulette_tasks",
          "create_roulette_condition_tasks",
          "create_roulette_reward_mode_tasks",
        ],
        description: "Create the main regression lottery draft with the verified template chain.",
        caseIds: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-11", "AC-12", "AC-13"],
        commands: [
          useFastApi
            ? ["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "create-draft", "--title-prefix", String(args.titlePrefix || "后管主回归"), "--alias-prefix", String(args.aliasPrefix || "ln")]
            : [
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
          [script("skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "skills/weex-admin-ops/scripts/lottery-activity-list-draft-checks.mjs"), ...(useFastApi ? ["--action", "draft-checks"] : []), "--activity-alias", "<created-alias>"]
        ]
      },
      {
        phaseId: "online_lottery_activity",
        dependsOn: ["create_lottery_activity_draft"],
        description: "Put the created draft online.",
        caseIds: ["ST-01"],
        commands: [
          [script("skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "skills/weex-admin-ops/scripts/online-lottery-activity.mjs"), ...(useFastApi ? ["--action", "online"] : []), "--activity-alias", "<created-alias>"]
        ]
      },
      {
        phaseId: "verify_activity_list_online",
        dependsOn: ["online_lottery_activity"],
        description: "Verify online activity row actions and copied draft creation from the list.",
        caseIds: ["AL-07", "AC-15", "ST-03"],
        commands: [
          [script("skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "skills/weex-admin-ops/scripts/lottery-activity-list-online-checks.mjs"), ...(useFastApi ? ["--action", "online-checks"] : []), "--activity-alias", "<created-alias>"]
        ]
      },
      {
        phaseId: "offline_lottery_activity",
        dependsOn: ["online_lottery_activity"],
        description: "Take the created online activity offline after copy and draft-delete checks pass.",
        caseIds: ["ST-02"],
        commands: [
          [script("skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "skills/weex-admin-ops/scripts/offline-lottery-activity.mjs"), ...(useFastApi ? ["--action", "offline"] : []), "--activity-alias", "<created-alias>"]
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
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let killedByTimeout = false;
    const timeoutMs = Math.max(0, Number(commandArgs?.timeoutMs || 0));
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          killedByTimeout = true;
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 2000).unref();
        }, timeoutMs)
      : null;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", error => {
      if (timer) clearTimeout(timer);
      const nextStderr = `${stderr}${error.message}\n`;
      resolve({
        exitCode: 1,
        stdout,
        stderr: nextStderr,
        payload: parseLastJson(stdout) || parseLastJson(nextStderr),
      });
    });
    child.on("close", code => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: killedByTimeout ? 124 : (code ?? 1),
        stdout,
        stderr,
        payload: killedByTimeout
          ? { ok: false, error: `Command timeout after ${timeoutMs}ms` }
          : (parseLastJson(stdout) || parseLastJson(stderr)),
      });
    });
  });
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

  const phaseById = new Map(plan.phases.map(phase => [phase.phaseId, phase]));
  const pending = new Set(plan.phases.map(phase => phase.phaseId));
  const finished = new Map();
  const running = new Map();

  const resolveUnmetDependencies = phase => (phase.dependsOn || []).filter(dependency => {
    const dependencyPhase = finished.get(dependency);
    return !dependencyPhase || !dependencyPhase.ok;
  });

  async function runPhase(phase) {
    const commandArgsList = resolvePhaseCommands(phase, args, createdActivity);
    const childResults = [];
    let phaseOk = true;
    let phasePayload = null;
    for (const commandArgs of commandArgsList) {
      const startedAt = Date.now();
      process.stderr.write(`{"step":"admin_phase","phaseId":"${phase.phaseId}","status":"START"}\n`);
      const result = await runNodeJson(Object.assign([...commandArgs], { timeoutMs: args.commandTimeoutMs }));
      const childOk = result.exitCode === 0 && result.payload?.ok !== false;
      process.stderr.write(`{"step":"admin_phase","phaseId":"${phase.phaseId}","status":"DONE","ok":${childOk ? "true" : "false"},"durationMs":${Date.now() - startedAt}}\n`);
      childResults.push({
        command: [process.execPath, ...commandArgs],
        ok: childOk,
        payload: result.payload,
      });
      if (!childOk) {
        phaseOk = false;
        phasePayload = result.payload;
        break;
      }
      phasePayload = result.payload;
      if (phase.phaseId === "create_lottery_activity_draft") {
        createdActivity = resolveActivityTarget(result.payload);
      }
    }
    return {
      phaseId: phase.phaseId,
      description: phase.description,
      caseIds: phase.caseIds,
      cases: phase.caseEntries,
      commands: childResults.map(item => item.command),
      ok: phaseOk,
      payload: phasePayload,
      childResults,
    };
  }

  while (pending.size) {
    let madeProgress = false;

    for (const phaseId of [...pending]) {
      const phase = phaseById.get(phaseId);
      if (!phase) {
        pending.delete(phaseId);
        continue;
      }
      const blockedByFailedDependency = (phase.dependsOn || []).some(dependency => {
        const dependencyPhase = finished.get(dependency);
        return dependencyPhase && !dependencyPhase.ok;
      });
      if (blockedByFailedDependency) {
        pending.delete(phaseId);
      }
    }

    for (const phaseId of [...pending]) {
      if (running.size >= args.concurrency) break;
      const phase = phaseById.get(phaseId);
      if (!phase) continue;
      const unmetDependencies = resolveUnmetDependencies(phase);
      if (unmetDependencies.length) continue;
      if (phase.phaseId === "online_lottery_activity" && !createdActivity.activityAlias && !createdActivity.activityId) {
        const failed = {
          phaseId: phase.phaseId,
          description: phase.description,
          caseIds: phase.caseIds,
          cases: phase.caseEntries,
          commands: [],
          ok: false,
          payload: { ok: false, error: "Missing created activity target from previous phase." },
          childResults: [],
        };
        pending.delete(phaseId);
        finished.set(phaseId, failed);
        phaseResults.push(failed);
        hadPhaseFailure = true;
        madeProgress = true;
        continue;
      }
      pending.delete(phaseId);
      madeProgress = true;
      const promise = runPhase(phase).then(summary => {
        finished.set(phaseId, summary);
        phaseResults.push(summary);
        if (!summary.ok) hadPhaseFailure = true;
        running.delete(phaseId);
      });
      running.set(phaseId, promise);
    }

    if (!running.size) {
      if (!madeProgress) break;
      continue;
    }

    await Promise.race(running.values());
  }

  if (running.size) {
    await Promise.all(running.values());
  }

  const caseResults = buildRegressionCaseResults(plan, phaseResults);
  const reportPhaseResults = compactPhaseResults(phaseResults);
  const fullReport = {
    ok: !hadPhaseFailure,
    actionId: plan.actionId,
    mode: plan.mode,
    selectedCaseIds: plan.selectedCaseIds || [],
    createdActivity,
    phaseResults: reportPhaseResults,
    caseResults,
  };
  if (args.reportPath) {
    try {
      fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
      fs.writeFileSync(args.reportPath, JSON.stringify(fullReport, null, 2));
    } catch (error) {
      process.stderr.write(`{"step":"report_write","ok":false,"error":"${String(error.message || error)}"}\n`);
    }
  }
  const compact = {
    ok: !hadPhaseFailure,
    actionId: plan.actionId,
    mode: plan.mode,
    selectedCaseCount: (plan.selectedCaseIds || []).length,
    createdActivity,
    phaseStatus: reportPhaseResults.map(item => ({ phaseId: item.phaseId, ok: item.ok })),
    caseStatusCounts: caseResults.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}),
    reportPath: args.reportPath || "",
  };
  const output = args.compact || args.reportPath ? compact : fullReport;
  printJson(output, hadPhaseFailure ? process.stderr : process.stdout);
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

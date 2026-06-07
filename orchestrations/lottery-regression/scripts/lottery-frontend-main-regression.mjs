#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson, readJson } from "../lib/cli.mjs";
import {
  buildFrontendRegressionCaseResults,
  resolvePhaseCommands,
} from "../lib/lottery-frontend-main-regression-lib.mjs";
import { runNodeJson } from "../../../tools/lib/run-node-json.mjs";

const currentFile = fileURLToPath(import.meta.url);
const orchestrationRoot = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(orchestrationRoot, "../..");
const manifestPath = path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json");

function usage() {
  return `Usage:
  node orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs --dry-run
  node orchestrations/lottery-regression/scripts/lottery-frontend-main-regression.mjs --activity-alias <alias> --visible

Options:
  --activity-alias <text> existing online lottery alias to reuse
  --case-ids <csv>        limit execution/reporting to selected regression case ids
  --recharge-amount <n>   mq recharge amount used to prepare draw count
  --visible               run child browser workflows in headed mode
  --dry-run               print the planned phases without writing data
  --help                  show this message
`;
}

export function buildPhaseProgressLine({ status, phaseId, description = "", attempt = 1, totalAttempts = 1, ok = null, reason = "" }) {
  const normalizedStatus = String(status || "").toUpperCase();
  if (normalizedStatus === "START") {
    const attemptText = totalAttempts > 1 ? ` (attempt ${attempt}/${totalAttempts})` : "";
    const descriptionText = description ? ` ${description}` : "";
    return `[frontend-main] START ${phaseId}${attemptText}${descriptionText}`;
  }
  if (normalizedStatus === "DONE") {
    return `[frontend-main] DONE ${phaseId} ${ok ? "PASS" : "FAIL"}`;
  }
  if (normalizedStatus === "RETRY") {
    const detail = reason ? ` ${reason}` : "";
    return `[frontend-main] RETRY ${phaseId} attempt ${attempt}/${totalAttempts}${detail}`;
  }
  if (normalizedStatus === "SKIP") {
    const detail = reason ? ` ${reason}` : "";
    return `[frontend-main] SKIP ${phaseId}${detail}`;
  }
  return `[frontend-main] ${normalizedStatus} ${phaseId}`;
}

function logPhaseProgress(event) {
  process.stderr.write(`${buildPhaseProgressLine(event)}\n`);
}

function relayChildProgress(text) {
  const lines = String(text || "")
    .split("\n")
    .map(item => item.trimEnd())
    .filter(Boolean)
    .filter(item => item.startsWith("[frontend-flow:"));
  for (const line of lines) process.stderr.write(`${line}\n`);
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

export function buildPlan(args) {
  const phases = [];
  const needsPrestartChecks = Array.isArray(args.caseIds) && (args.caseIds.includes("FE-18") || args.caseIds.includes("FE-80"));
  const needsGuestChecks = Array.isArray(args.caseIds) && args.caseIds.includes("FE-16");
  if (!args.activityAlias) {
    phases.push({
      phaseId: "create_lottery_activity_draft",
      dependsOn: [],
      description: "Create an online-capable lottery activity for frontend regression.",
      caseIds: [],
      commands: [[
        "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
        "--action",
        "create-draft",
        "--title-prefix",
        String(args.titlePrefix || "前端主回归"),
        "--alias-prefix",
        String(args.aliasPrefix || "lf"),
        "--start-offset-seconds",
        String(args.startOffsetSeconds || "30"),
        "--end-days",
        String(args.endDays || "30"),
      ]],
    });
    phases.push({
      phaseId: "online_lottery_activity",
      dependsOn: ["create_lottery_activity_draft"],
      description: "Put the created frontend regression activity online.",
      caseIds: [],
      commands: [[
        "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
        "--action",
        "online",
        "--activity-alias",
        "<created-alias>",
      ]],
    });
    if (needsPrestartChecks) {
      phases.push({
        phaseId: "create_lottery_activity_draft_prestart",
        dependsOn: [],
        description: "Create an online lottery activity that stays in not-started state for prestart assertions.",
        caseIds: [],
        commands: [[
          "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
          "--action",
          "create-draft",
          "--title-prefix",
          String(args.titlePrefixPrestart || "未开始态回归"),
          "--alias-prefix",
          String(args.aliasPrefixPrestart || "lp"),
          "--start-offset-seconds",
          String(args.startOffsetSecondsPrestart || "1800"),
          "--end-days",
          String(args.endDays || "30"),
        ]],
      });
      phases.push({
        phaseId: "online_lottery_activity_prestart",
        dependsOn: ["create_lottery_activity_draft_prestart"],
        description: "Put the prestart regression activity online (not started yet).",
        caseIds: [],
        commands: [[
          "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
          "--action",
          "online",
          "--activity-alias",
          "<prestart-alias>",
        ]],
      });
    }
  }
  const baseDependsOn = args.activityAlias ? [] : ["online_lottery_activity"];
  const activityAliasToken = args.activityAlias ? String(args.activityAlias) : "<created-alias>";
  phases.push({
    phaseId: "admin_activity_snapshot",
    dependsOn: baseDependsOn,
    description: "Fetch admin snapshot for frontend consistency assertions.",
    caseIds: [],
    commands: [[
      "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
      "--action",
      "snapshot",
      "--activity-alias",
      activityAliasToken,
    ]],
  });
  if (needsGuestChecks) {
    phases.push({
      phaseId: "frontend_guest_checks",
      dependsOn: ["admin_activity_snapshot"],
      description: "Open the draw page without login and assert guest state.",
      caseIds: ["FE-16"],
      commands: [[
        "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
        "--phase",
        "guest",
        "--activity-alias",
        activityAliasToken,
      ]],
    });
  }
  if (needsPrestartChecks && !args.activityAlias) {
    phases.push({
      phaseId: "frontend_prestart_checks",
      dependsOn: ["online_lottery_activity_prestart"],
      description: "Open the not-started activity page and assert prestart UI state.",
      caseIds: ["FE-18", "FE-80"],
      commands: [[
        "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
        "--phase",
        "prestart",
        "--activity-alias",
        "<prestart-alias>",
      ]],
    });
  }
  phases.push({
    phaseId: "frontend_readonly_checks",
    dependsOn: ["admin_activity_snapshot"],
    description: "Open the draw page and verify readonly logged-in frontend signals.",
    caseIds: ["FE-79", "FE-01", "FE-02", "FE-03", "FE-05", "FE-06", "FE-07", "FE-08", "FE-17", "FE-19"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "readonly",
      "--activity-alias",
      activityAliasToken,
      "--admin-snapshot-path",
      "<admin-snapshot-path>",
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_signup_flow",
    dependsOn: ["frontend_readonly_checks"],
    description: "Verify not-signed-up to signed-up state transition.",
    caseIds: ["FE-81", "FE-82", "FE-83"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "signup",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_backend_linkage",
    dependsOn: ["frontend_signup_flow"],
    description: "Mutate admin config and verify frontend reflects the changes.",
    caseIds: ["FE-73"],
    commands: [[
      "skills/weex-admin-ops/scripts/lottery-frontend-backend-linkage-basic.mjs",
      "--activity-alias",
      activityAliasToken,
    ]],
  });
  phases.push({
    phaseId: "frontend_backend_linkage_readonly",
    dependsOn: ["frontend_signup_flow"],
    description: "Verify frontend linkage display via URL locale switch and page sections.",
    caseIds: ["FE-75", "FE-76", "FE-77", "FE-78"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "readonly",
      "--activity-alias",
      activityAliasToken,
      "--admin-snapshot-path",
      "<admin-snapshot-path>",
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_style_display",
    dependsOn: ["frontend_readonly_checks"],
    description: "Verify frontend lottery style display and prize assets.",
    caseIds: ["FE-09", "FE-10", "FE-11", "FE-12", "FE-13", "FE-14", "FE-15"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "style_display",
      "--activity-alias",
      activityAliasToken,
      "--admin-snapshot-path",
      "<admin-snapshot-path>",
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_recharge_prepare",
    dependsOn: ["frontend_readonly_checks"],
    description: "Prepare draw count through recharge task linkage.",
    caseIds: ["FE-21", "FE-22", "FE-84"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "recharge",
      "--activity-alias",
      activityAliasToken,
      "--recharge-amount",
      String(args.rechargeAmount || "1000"),
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_exception_ui",
    dependsOn: ["frontend_recharge_prepare"],
    description: "Verify injected draw failure, timeout, network error, and recovery UI.",
    caseIds: ["FE-38", "FE-39", "FE-58", "FE-59", "FE-60", "FE-61", "FE-62", "FE-63"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "exception_ui",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_five_draw",
    dependsOn: ["frontend_recharge_prepare"],
    description: "Run the five-draw transaction checks.",
    caseIds: ["FE-25", "FE-29", "FE-40", "FE-41", "FE-42", "FE-43", "FE-44", "FE-47"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "five_draw",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_low_stock_five_draw",
    dependsOn: ["frontend_recharge_prepare"],
    description: "Run low-stock five-draw failure and no-deduction checks.",
    caseIds: ["FE-23", "FE-45", "FE-46", "FE-57"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "five_draw",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_low_stock_single_draw",
    dependsOn: ["frontend_recharge_prepare", "frontend_low_stock_five_draw"],
    description: "Run low-stock single-draw success then shortage checks.",
    caseIds: ["FE-85"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "low_stock_single_draw",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_weight_special",
    dependsOn: ["frontend_recharge_prepare"],
    description: "Run cumulative re-weighting frontend checks.",
    caseIds: ["FE-64", "FE-65", "FE-66", "FE-67"],
    commands: [[
      "skills/weex-frontend-ops/scripts/frontend-draw-weight-special-verify.mjs",
      "--activity-alias",
      activityAliasToken,
      "--expected-prize-text",
      "100 USDT 合约赠金",
      "--draw-times",
      "6",
      "--timeout-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_single_draw",
    dependsOn: ["frontend_recharge_prepare"],
    description: "Run the single-draw transaction checks.",
    caseIds: ["FE-24", "FE-26", "FE-27", "FE-28", "FE-32", "FE-33", "FE-34", "FE-35"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "draw",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_reward_record",
    dependsOn: ["frontend_readonly_checks"],
    description: "Open reward record after the single draw and assert fields.",
    caseIds: ["FE-36", "FE-37", "FE-48", "FE-49", "FE-50", "FE-55", "FE-56"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "reward_record",
      "--activity-alias",
      activityAliasToken,
      "--draw-payload-path",
      "<draw-payload-path>",
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_reward_record_extended",
    dependsOn: ["frontend_readonly_checks"],
    description: "Verify reward record empty/data states, time filter, and scroll loading.",
    caseIds: ["FE-51", "FE-52", "FE-53", "FE-54"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "reward_record_extended",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  phases.push({
    phaseId: "frontend_responsive_ui",
    dependsOn: ["frontend_readonly_checks"],
    description: "Verify H5/mobile responsive layout, dialogs, and long text overflow.",
    caseIds: ["FE-68", "FE-69", "FE-70", "FE-71", "FE-72"],
    commands: [[
      "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs",
      "--phase",
      "responsive_ui",
      "--activity-alias",
      activityAliasToken,
      "--wait-for-start-ms",
      String(args.waitForStartMs || "720000"),
    ]],
  });
  return {
    actionId: "lottery_frontend_main_regression",
    mode: args.visible ? "visible_browser" : "headless_ui",
    phases,
  };
}

function caseTransitivelyDependsOn(caseId, targetCaseId, manifest = readJson(manifestPath), seen = new Set()) {
  if (!caseId || seen.has(caseId)) return false;
  if (caseId === targetCaseId) return true;
  seen.add(caseId);
  const entry = (manifest.entries || []).find(item => item.caseId === caseId);
  return Boolean((entry?.dependsOnCaseIds || []).some(dependency => (
    caseTransitivelyDependsOn(dependency, targetCaseId, manifest, seen)
  )));
}

export function expandFrontendSelectedCaseIds(selectedCaseIds, manifest = readJson(manifestPath)) {
  if (!selectedCaseIds?.length) return [];
  const entryByCaseId = new Map((manifest.entries || []).map(item => [item.caseId, item]));
  const expanded = [];
  const seen = new Set();

  function visit(caseId) {
    if (!caseId || seen.has(caseId)) return;
    seen.add(caseId);
    const entry = entryByCaseId.get(caseId);
    for (const dependency of entry?.dependsOnCaseIds || []) visit(dependency);
    expanded.push(caseId);
  }

  for (const caseId of selectedCaseIds) visit(caseId);
  return expanded;
}

export function resolveFrontendExecutionSelection(args, manifest = readJson(manifestPath)) {
  const requestedCaseIds = args.caseIds || [];
  const expandedCaseIds = expandFrontendSelectedCaseIds(requestedCaseIds, manifest);
  const selectedEntries = (manifest.entries || []).filter(item => expandedCaseIds.includes(item.caseId));
  const activityAliasProvided = Boolean(String(args.activityAlias || "").trim());
  const forceFreshActivity = selectedEntries.some(item => item.executionClass === "FRESH_ROOT") && !activityAliasProvided;
  return {
    requestedCaseIds,
    expandedCaseIds,
    selectedEntries,
    forceFreshActivity,
    effectiveActivityAlias: forceFreshActivity ? "" : String(args.activityAlias || ""),
    ignoredActivityAlias: forceFreshActivity && activityAliasProvided ? String(args.activityAlias) : "",
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function now() {
  return Date.now();
}

function runOrchestrationNodeJson(commandArgs) {
  const startedAt = now();
  const result = runNodeJson(commandArgs, { cwd: repoRoot, env: process.env });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    payload: result.payload,
    durationMs: now() - startedAt,
  };
}

function isRetryableFrontendGuestState(phase, child) {
  if (!phase?.phaseId?.startsWith("frontend_")) return false;
  const payload = child?.payload || {};
  const page = payload.page || {};
  return Boolean(page.guestVisible || page.mainButtonState === "注册");
}

function readCoveredEntries(caseIds, manifest = readJson(manifestPath)) {
  return manifest.entries.filter(item => caseIds.includes(item.caseId));
}

function hydratePlanWithCases(plan, manifest = readJson(manifestPath)) {
  return {
    ...plan,
    phases: plan.phases.map(phase => ({
      ...phase,
      caseEntries: readCoveredEntries(phase.caseIds, manifest),
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

export function prepareFrontendRegressionPlan(args, manifest = readJson(manifestPath)) {
  const selection = resolveFrontendExecutionSelection(args, manifest);
  const effectiveArgs = {
    ...args,
    activityAlias: selection.effectiveActivityAlias,
  };
  const filteredPlan = filterPlanByCaseIds(
    hydratePlanWithCases(buildPlan(effectiveArgs), manifest),
    selection.expandedCaseIds,
  );
  const plan = {
    ...filteredPlan,
    phases: filteredPlan.phases.map(phase => {
      if (phase.phaseId !== "frontend_reward_record") return phase;
      const needsSingleDraw = (phase.caseIds || []).some(caseId => caseTransitivelyDependsOn(caseId, "FE-32", manifest));
      if (!needsSingleDraw) return phase;
      return {
        ...phase,
        dependsOn: Array.from(new Set([...(phase.dependsOn || []), "frontend_single_draw"])),
      };
    }),
  };
  return {
    ...plan,
    requestedCaseIds: selection.requestedCaseIds,
    selectedCaseIds: selection.expandedCaseIds,
    executionSelection: selection,
  };
}

export async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const plan = prepareFrontendRegressionPlan(args);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, ...plan });
    return 0;
  }

  const phaseResults = [];
  let createdActivity = {
    activityId: "",
    activityAlias: plan.executionSelection?.effectiveActivityAlias
      ? String(plan.executionSelection.effectiveActivityAlias)
      : "",
    adminSnapshotPath: "",
    prestartActivityId: "",
    prestartActivityAlias: "",
    drawPayloadPath: "",
  };
  let hadPhaseFailure = false;
  const timings = [];
  const startedAt = now();

  for (const phase of plan.phases) {
    const unmetDependencies = (phase.dependsOn || []).filter(dependency => {
      const dependencyPhase = phaseResults.find(item => item.phaseId === dependency);
      return !dependencyPhase || !dependencyPhase.ok;
    });
    if (unmetDependencies.length) {
      logPhaseProgress({
        status: "skip",
        phaseId: phase.phaseId,
        reason: `blocked by ${unmetDependencies.join(", ")}`,
      });
      continue;
    }
    const phaseStartedAt = now();
    let commandArgsList = resolvePhaseCommands(phase, args, createdActivity);
    if (Array.isArray(phase.caseIds) && phase.caseIds.length) {
      commandArgsList = commandArgsList.map(commandArgs => {
        if (!Array.isArray(commandArgs) || !commandArgs.includes("skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs")) return commandArgs;
        const phaseIndex = commandArgs.indexOf("--phase");
        if (phaseIndex === -1) return commandArgs;
        const phaseValue = String(commandArgs[phaseIndex + 1] || "");
        if (phaseValue !== "readonly") return commandArgs;
        return [...commandArgs, "--assert-case-ids", phase.caseIds.join(",")];
      });
    }
    const childResults = [];
    let phaseOk = true;
    let phasePayload = null;
    for (const commandArgs of commandArgsList) {
      let child = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        logPhaseProgress({
          status: "start",
          phaseId: phase.phaseId,
          description: phase.description,
          attempt: attempt + 1,
          totalAttempts: 2,
        });
        const result = runOrchestrationNodeJson(commandArgs);
        child = {
          command: [process.execPath, ...commandArgs],
          ok: result.exitCode === 0 && result.payload?.ok !== false,
          payload: result.payload,
          attempt: attempt + 1,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
        };
        childResults.push(child);
        relayChildProgress(result.stderr);
        logPhaseProgress({
          status: "done",
          phaseId: phase.phaseId,
          ok: child.ok,
        });
        if (child.ok || !isRetryableFrontendGuestState(phase, child) || attempt > 0) break;
        logPhaseProgress({
          status: "retry",
          phaseId: phase.phaseId,
          attempt: attempt + 2,
          totalAttempts: 2,
          reason: "guest state detected, retrying once",
        });
        await sleep(2000);
      }
      if (!child.ok) {
        phaseOk = false;
        phasePayload = child.payload;
        break;
      }
      phasePayload = child.payload;
      if (phase.phaseId === "admin_activity_snapshot") {
        const snapshot = child.payload?.snapshot || null;
        if (snapshot && typeof snapshot === "object") {
          const dir = path.join(orchestrationRoot, "artifacts", "tmp");
          fs.mkdirSync(dir, { recursive: true });
          const safeAlias = String(createdActivity.activityAlias || child.payload?.alias || "").replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 24);
          const fileName = `admin-snapshot-${safeAlias || Date.now()}.json`;
          const snapshotPath = path.join(dir, fileName);
          try {
            fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
            createdActivity.adminSnapshotPath = snapshotPath;
            if (child.payload) child.payload.adminSnapshotPath = snapshotPath;
          } catch {}
        }
        createdActivity = { ...createdActivity, ...resolveActivityTarget(child.payload, createdActivity.activityAlias) };
      }
      if (phase.phaseId === "create_lottery_activity_draft") {
        createdActivity = { ...createdActivity, ...resolveActivityTarget(child.payload, createdActivity.activityAlias) };
      }
      if (phase.phaseId === "create_lottery_activity_draft_prestart") {
        const target = resolveActivityTarget(child.payload, "");
        createdActivity.prestartActivityId = target.activityId;
        createdActivity.prestartActivityAlias = target.activityAlias;
      }
      if (phase.phaseId.startsWith("frontend_")) {
        createdActivity = { ...createdActivity, ...resolveActivityTarget(child.payload, createdActivity.activityAlias) };
      }
      if (phase.phaseId === "frontend_single_draw") {
        const drawPayload = child.payload && typeof child.payload === "object"
          ? child.payload
          : null;
        if (drawPayload?.draw) {
          const dir = path.join(orchestrationRoot, "artifacts", "tmp");
          fs.mkdirSync(dir, { recursive: true });
          const safeAlias = String(createdActivity.activityAlias || drawPayload?.page?.activityAlias || "").replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 24);
          const fileName = `draw-payload-${safeAlias || Date.now()}.json`;
          const drawPath = path.join(dir, fileName);
          try {
            fs.writeFileSync(drawPath, JSON.stringify(drawPayload, null, 2));
            createdActivity.drawPayloadPath = drawPath;
            if (child.payload) child.payload.drawPayloadPath = drawPath;
          } catch {}
        }
      }
    }
    const phaseDurationMs = now() - phaseStartedAt;
    phaseResults.push({
      phaseId: phase.phaseId,
      description: phase.description,
      caseIds: phase.caseIds,
      cases: phase.caseEntries,
      commands: childResults.map(item => item.command),
      ok: phaseOk,
      payload: phasePayload,
      childResults,
      durationMs: phaseDurationMs,
    });
    timings.push({
      id: phase.phaseId,
      ok: phaseOk,
      durationMs: phaseDurationMs,
      childCount: childResults.length,
      childDurationsMs: childResults.map(item => item.durationMs).filter(Number.isFinite),
    });
    if (!phaseOk) hadPhaseFailure = true;
  }

  const caseResults = buildFrontendRegressionCaseResults(plan, phaseResults);
  const hasFailedCase = caseResults.some(item => String(item.status || "").toUpperCase() === "FAIL");
  const totalDurationMs = now() - startedAt;
  const overallOk = !hadPhaseFailure && !hasFailedCase;
  printJson({
    ok: overallOk,
    actionId: plan.actionId,
    mode: plan.mode,
    requestedCaseIds: plan.requestedCaseIds || [],
    selectedCaseIds: plan.selectedCaseIds || [],
    executionSelection: plan.executionSelection || {},
    createdActivity,
    timings: {
      totalDurationMs,
      phases: timings,
    },
    phaseResults,
    caseResults,
  }, overallOk ? process.stdout : process.stderr);
  return overallOk ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    process.exitCode = await run();
  } catch (error) {
    printJson({ ok: false, error: error.message }, process.stderr);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson, readJson } from "../lib/cli.mjs";
import { loadLotteryRegressionManifest, resolveScenarioSelection } from "../lib/lottery-regression-manifest.mjs";
import { buildEntrypointCommands } from "./lottery-regression-dispatcher.mjs";
import fs from "node:fs";

const currentFile = fileURLToPath(import.meta.url);
const orchestrationRoot = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(orchestrationRoot, "../..");

function usage() {
  return `Usage:
  node orchestrations/lottery-regression/scripts/run-full-headless.mjs

Options:
  --selection <text>        scenario selection tokens, e.g. "全部" or "活动列表, 单抽主流程"
  --concurrency <n>         max parallel child entrypoints when running "auto" mode (default 10)
  --admin-concurrency <n>   admin internal phase concurrency (default 1)
  --start-offset-seconds <n> activity start offset seconds (default 3)
  --wait-for-start-ms <n>   frontend activity-start wait window (default 60000)
  --recharge-amount <n>     mq recharge amount (default 1000)
  --dry-run                 print plan only
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  if (args.help) return args;
  args.dryRun = Boolean(args.dryRun);
  args.selection = String(args.selection || "").trim();
  args.concurrency = Math.max(1, Math.min(10, Number(args.concurrency || 10)));
  args.adminConcurrency = Math.max(1, Math.min(10, Number(args.adminConcurrency || 1)));
  args.startOffsetSeconds = Math.max(3, Number(args.startOffsetSeconds || 3));
  args.waitForStartMs = Math.max(5000, Number(args.waitForStartMs || 60000));
  args.rechargeAmount = String(args.rechargeAmount || "1000");
  return args;
}

function stamp() {
  const date = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function now() {
  return Date.now();
}

function buildDuration(ms) {
  if (!Number.isFinite(ms)) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runChild(commandArgs, { label = "", captureJsonPath = "" } = {}) {
  return new Promise(resolve => {
    const startedAt = now();
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", error => {
      resolve({
        ok: false,
        exitCode: 1,
        label,
        durationMs: now() - startedAt,
        error: error.message,
        stdout,
        stderr,
      });
    });
    child.on("close", code => {
      if (captureJsonPath) {
        try {
          fs.writeFileSync(captureJsonPath, stdout);
        } catch {}
      }
      resolve({
        ok: (code ?? 1) === 0,
        exitCode: code ?? 1,
        label,
        durationMs: now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

function parseJsonSafely(text) {
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

async function prepareActivitiesBatch({ startOffsetSeconds }) {
  const script = "skills/weex-admin-ops/scripts/create-online-lottery-activities-batch-fast-api.mjs";
  const args = [
    script,
    "--parts",
    "normal,weight,stock",
    "--normal-template-alias", "lf25085715",
    "--weight-template-alias", "lw25121831",
    "--stock-template-alias", "ls25122120",
    "--start-offset-seconds", String(startOffsetSeconds),
  ];
  const result = await runChild(args, { label: "prepare_activities_batch" });
  const payload = parseJsonSafely(result.stdout) || parseJsonSafely(result.stderr);
  return { ...result, payload };
}

function detectRequiredFrontendParts(selectedScenarios = []) {
  const required = new Set();
  const hasFrontendEntrypoint = scenario => String(scenario?.entrypoint || "") === "lottery_frontend_main_regression";
  const isWeightScenario = scenario => (scenario?.preconditions || []).some(item => (
    item === "WEIGHT_ACTIVITY_ONLINE" || item === "WEIGHT_ACTIVITY_DRAW_GE3"
  ));
  const isStockScenario = scenario => (scenario?.preconditions || []).some(item => (
    item === "LOW_STOCK_ACTIVITY_ONLINE" || item === "LOW_STOCK_ACTIVITY_DRAW_GT5"
  ));
  for (const scenario of selectedScenarios) {
    if (!hasFrontendEntrypoint(scenario)) continue;
    if (isWeightScenario(scenario)) required.add("weight");
    else if (isStockScenario(scenario)) required.add("stock");
    else required.add("normal");
  }
  return Array.from(required.values()).sort();
}

function buildPrepareBatchArgs({ startOffsetSeconds, parts }) {
  const script = "skills/weex-admin-ops/scripts/create-online-lottery-activities-batch-fast-api.mjs";
  const partSet = new Set(parts || []);
  const args = [script, "--parts", (parts || []).join(","), "--start-offset-seconds", String(startOffsetSeconds)];
  if (partSet.has("normal")) args.push("--normal-template-alias", "lf25085715");
  if (partSet.has("weight")) args.push("--weight-template-alias", "lw25121831");
  if (partSet.has("stock")) args.push("--stock-template-alias", "ls25122120");
  return args;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const timings = [];
  const startedAt = now();
  const runStamp = stamp();
  const reportRoot = path.join(repoRoot, "orchestrations/lottery-regression/artifacts/reports", runStamp);

  const step = async (id, fn) => {
    const t0 = now();
    process.stderr.write(`{"step":"progress","id":"${id}","status":"START"}\n`);
    const out = await fn();
    const durationMs = now() - t0;
    timings.push({ id, durationMs, ok: out?.ok !== false });
    process.stderr.write(`{"step":"progress","id":"${id}","status":"DONE","ok":${out?.ok !== false ? "true" : "false"},"duration":"${buildDuration(durationMs)}"}\n`);
    return out;
  };

  if (args.dryRun) {
    const manifest = loadLotteryRegressionManifest();
    const selectionInput = args.selection || "全部";
    const resolved = resolveScenarioSelection(selectionInput === "full" ? "全部" : selectionInput, manifest);
    if (resolved.unresolved?.length) {
      printJson({ ok: false, dryRun: true, error: "unresolved selection tokens", selection: resolved }, process.stdout);
      return 2;
    }

    const baseArgsForBuild = {
      all: resolved.mode === "all",
      full: true,
      visible: false,
      dryRun: true,
      concurrency: args.concurrency,
      adminConcurrency: args.adminConcurrency,
      normalActivityAlias: "<normal-alias>",
      weightActivityAlias: "<weight-alias>",
      stockActivityAlias: "<stock-alias>",
      waitForStartMs: String(args.waitForStartMs),
      rechargeAmount: String(args.rechargeAmount),
    };
    const executions = buildEntrypointCommands(resolved.selectedScenarios, baseArgsForBuild);

    printJson({
      ok: true,
      dryRun: true,
      mode: "headless_full",
      note: "Dry-run only prints the plan. It does not run first-run-check, does not create activities, and does not execute admin/frontend phases.",
      selection: resolved,
      plan: executions.map(item => ({
        entrypoint: item.entrypoint,
        partition: item.partition || null,
        commandArgs: item.commandArgs,
      })),
      options: {
        selection: selectionInput,
        concurrency: args.concurrency,
        adminConcurrency: args.adminConcurrency,
        startOffsetSeconds: args.startOffsetSeconds,
        waitForStartMs: args.waitForStartMs,
        rechargeAmount: args.rechargeAmount,
      },
    }, process.stdout);
    return 0;
  }

  const check = await step("first_run_check_all", async () => {
    const child = await runChild(["tools/first-run-check.mjs", "--skill", "all"], { label: "first_run_check" });
    const payload = parseJsonSafely(child.stdout) || parseJsonSafely(child.stderr);
    return { ok: Boolean(payload?.ok), payload };
  });
  if (!check.ok) {
    printJson({ ok: false, error: "first-run-check failed", timings, totalDurationMs: now() - startedAt }, process.stderr);
    return 2;
  }

  const manifest = loadLotteryRegressionManifest();
  const selectionInput = args.selection || "全部";
  const selection = resolveScenarioSelection(selectionInput === "full" ? "全部" : selectionInput, manifest);
  if (selection.unresolved?.length) {
    printJson({ ok: false, error: "unresolved selection tokens", selection, timings, totalDurationMs: now() - startedAt }, process.stderr);
    return 2;
  }

  const requiredFrontendParts = detectRequiredFrontendParts(selection.selectedScenarios);
  const shouldPrepareActivities = requiredFrontendParts.length > 0;

  const prepared = shouldPrepareActivities
    ? await step("prepare_activities_batch", async () => {
      const commandArgs = buildPrepareBatchArgs({ startOffsetSeconds: args.startOffsetSeconds, parts: requiredFrontendParts });
      const result = await runChild(commandArgs, { label: "prepare_activities_batch" });
      const payload = parseJsonSafely(result.stdout) || parseJsonSafely(result.stderr);
      return { ok: result.ok && payload?.ok !== false, payload };
    })
    : { ok: true, payload: { ok: true, aliases: {} } };
  if (!prepared.ok) {
    printJson({ ok: false, error: "prepare activities batch failed", requiredFrontendParts, timings, totalDurationMs: now() - startedAt }, process.stderr);
    return 1;
  }

  const aliases = prepared.payload?.aliases || {};
  const normalAlias = String(aliases.normal || "");
  const weightAlias = String(aliases.weight || "");
  const stockAlias = String(aliases.stock || "");
  const missingRequired = requiredFrontendParts.filter(part => {
    if (part === "normal") return !normalAlias;
    if (part === "weight") return !weightAlias;
    if (part === "stock") return !stockAlias;
    return true;
  });
  if (missingRequired.length) {
    printJson({ ok: false, error: "missing required activity aliases from batch prepare", requiredFrontendParts, missingRequired, aliases, timings, totalDurationMs: now() - startedAt }, process.stderr);
    return 1;
  }

  fs.mkdirSync(reportRoot, { recursive: true });

  const baseArgsForBuild = {
    all: selection.mode === "all",
    full: true,
    visible: false,
    dryRun: false,
    concurrency: args.concurrency,
    adminConcurrency: args.adminConcurrency,
    normalActivityAlias: normalAlias,
    weightActivityAlias: weightAlias,
    stockActivityAlias: stockAlias,
    waitForStartMs: String(args.waitForStartMs),
    rechargeAmount: String(args.rechargeAmount),
  };
  const executions = buildEntrypointCommands(selection.selectedScenarios, baseArgsForBuild);

  const adminExec = executions.find(item => item.entrypoint === "lottery_admin_main_regression") || null;
  const frontendExecs = executions
    .filter(item => item.entrypoint === "lottery_frontend_main_regression")
    .sort((a, b) => String(a.partition || "").localeCompare(String(b.partition || "")));

  const results = [];
  const entrypoints = [];
  const caseDetails = {
    total: 0,
    pass: 0,
    fail: 0,
    skipped: 0,
    failedCases: [],
    skippedCases: [],
    byEntrypoint: {},
  };
  const entrypointTimings = {};

  function addEntrypointSummary(entrypointId, summary) {
    caseDetails.byEntrypoint[entrypointId] = summary;
    caseDetails.total += summary.total || 0;
    caseDetails.pass += summary.pass || 0;
    caseDetails.fail += summary.fail || 0;
    caseDetails.skipped += summary.skipped || 0;
    for (const item of summary.failedCases || []) caseDetails.failedCases.push({ entrypoint: entrypointId, ...item });
    for (const item of summary.skippedCases || []) caseDetails.skippedCases.push({ entrypoint: entrypointId, ...item });
  }

  function parseAdminPhaseTimings(text) {
    const out = {};
    const lines = String(text || "").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{") || !trimmed.includes("\"step\":\"admin_phase\"")) continue;
      try {
        const event = JSON.parse(trimmed);
        if (event?.status !== "DONE") continue;
        if (!event.phaseId) continue;
        out[String(event.phaseId)] = {
          ok: event.ok !== false,
          durationMs: Number(event.durationMs ?? event.duration ?? 0) || null,
        };
      } catch {}
    }
    return out;
  }

  function summarizeFrontendPayload(payload) {
    const results = Array.isArray(payload?.caseResults) ? payload.caseResults : [];
    const total = results.length;
    const pass = results.filter(item => String(item.status).toUpperCase() === "PASS").length;
    const failItems = results.filter(item => String(item.status).toUpperCase() === "FAIL");
    const skippedItems = results.filter(item => String(item.status).toUpperCase() === "SKIPPED");
    return {
      total,
      pass,
      fail: failItems.length,
      skipped: skippedItems.length,
      failedCases: failItems.map(item => ({
        caseId: item.caseId,
        caseName: item.caseName || "",
        phaseId: item.phaseId || "",
        reason: item.errorMessage || "failed",
      })),
      skippedCases: skippedItems.map(item => ({
        caseId: item.caseId,
        caseName: item.caseName || "",
        phaseId: item.phaseId || "",
        reason: item.errorMessage || "skipped",
      })),
      phaseTimings: payload?.timings?.phases || [],
      totalDurationMs: payload?.timings?.totalDurationMs ?? null,
    };
  }

  function summarizeAdminPayload(payload, phaseTimingMap = {}) {
    const caseResults = Array.isArray(payload?.caseResults) ? payload.caseResults : null;
    const phaseResults = Array.isArray(payload?.phaseResults) ? payload.phaseResults : null;

    const normalizedCases = [];
    if (caseResults) {
      for (const item of caseResults) {
        normalizedCases.push({
          caseId: item.caseId,
          caseName: item.caseName || "",
          phaseId: item.phaseId || "",
          status: String(item.status || "").toUpperCase() || "UNKNOWN",
          reason: item.errorMessage || "",
        });
      }
    } else if (phaseResults) {
      for (const phase of phaseResults) {
        const ok = phase.ok !== false;
        for (const entry of phase.cases || []) {
          normalizedCases.push({
            caseId: entry.caseId,
            caseName: entry.caseName || "",
            phaseId: phase.phaseId,
            status: ok ? "PASS" : "FAIL",
            reason: ok ? "" : (phase.payload?.error || "phase failed"),
          });
        }
      }
    }

    const total =
      normalizedCases.length ||
      Number(payload?.selectedCaseCount || 0) ||
      Number(payload?.selectedCaseIds?.length || 0) ||
      0;

    const pass = normalizedCases.filter(item => item.status === "PASS").length || (normalizedCases.length ? 0 : null);
    const failItems = normalizedCases.filter(item => item.status === "FAIL");
    const skippedItems = normalizedCases.filter(item => item.status === "SKIPPED");

    const inferredAllOk =
      Array.isArray(payload?.phaseStatus) &&
      payload.phaseStatus.length > 0 &&
      payload.phaseStatus.every(item => item?.ok !== false);

    const inferredPass = pass ?? (inferredAllOk ? total : 0);
    const inferredFail = pass == null ? (inferredAllOk ? 0 : total) : failItems.length;

    const phaseTimings = Object.entries(phaseTimingMap).map(([phaseId, v]) => ({
      id: phaseId,
      ok: v.ok !== false,
      durationMs: v.durationMs,
    }));
    return {
      total,
      pass: inferredPass,
      fail: inferredFail,
      skipped: skippedItems.length,
      failedCases: failItems.map(item => ({
        caseId: item.caseId,
        caseName: item.caseName || "",
        phaseId: item.phaseId || "",
        reason: item.reason || "failed",
      })),
      skippedCases: skippedItems.map(item => ({
        caseId: item.caseId,
        caseName: item.caseName || "",
        phaseId: item.phaseId || "",
        reason: item.reason || "skipped",
      })),
      phaseTimings,
    };
  }

  if (adminExec?.commandArgs?.length) {
    const adminResult = await step("run_admin", async () => {
      const reportPath = path.join(reportRoot, "admin.json");
      const commandArgs = [...adminExec.commandArgs, "--report-path", reportPath, "--compact"];
      const res = await runChild(commandArgs, { label: "admin" });
      const payload = parseJsonSafely(res.stdout) || parseJsonSafely(res.stderr);
      const reportPayload = (() => {
        try {
          return readJson(reportPath);
        } catch {
          return null;
        }
      })();
      if (payload) {
        try {
          fs.writeFileSync(path.join(reportRoot, "admin.payload.json"), JSON.stringify(payload, null, 2));
        } catch {}
      }
      const phaseTimingMap = parseAdminPhaseTimings(res.stderr);
      entrypointTimings.admin = { phaseTimings: phaseTimingMap };
      addEntrypointSummary("admin", summarizeAdminPayload(reportPayload || payload, phaseTimingMap));
      return { ok: res.ok && (reportPayload?.ok ?? payload?.ok) !== false, payload: reportPayload || payload, stderr: res.stderr };
    });
    results.push({ id: "admin", ...adminResult });
    entrypoints.push({ id: "admin", entrypoint: "lottery_admin_main_regression" });
  } else {
    results.push({ id: "admin", ok: false, error: "admin execution missing" });
  }

  for (const exec of frontendExecs) {
    const part = String(exec.partition || "frontend");
    const runId = `run_frontend_${part}`;
    const frontendResult = await step(runId, async () => {
      const res = await runChild(exec.commandArgs, { label: `frontend_${part}` });
      const payload = parseJsonSafely(res.stdout) || parseJsonSafely(res.stderr);
      if (payload) {
        try {
          fs.writeFileSync(path.join(reportRoot, `frontend_${part}.json`), JSON.stringify(payload, null, 2));
        } catch {}
      }
      addEntrypointSummary(`frontend_${part}`, summarizeFrontendPayload(payload));
      entrypoints.push({ id: `frontend_${part}`, entrypoint: "lottery_frontend_main_regression", partition: part });
      return { ok: res.ok && payload?.ok !== false, payload };
    });
    results.push({ id: `frontend_${part}`, ...frontendResult });
  }

  const totalDurationMs = now() - startedAt;
  const summary = {
    ok: results.every(item => item.ok !== false),
    mode: "headless_full",
    reportRoot,
    aliases: { normal: normalAlias, weight: weightAlias, stock: stockAlias },
    selection: { ...selection, input: selectionInput },
    timings: timings.map(item => ({ ...item, duration: buildDuration(item.durationMs) })),
    entrypoints,
    entrypointTimings,
    caseSummary: {
      total: caseDetails.total,
      pass: caseDetails.pass,
      fail: caseDetails.fail,
      skipped: caseDetails.skipped,
      byEntrypoint: caseDetails.byEntrypoint,
    },
    failedCases: caseDetails.failedCases,
    skippedCases: caseDetails.skippedCases,
    totalDurationMs,
    totalDuration: buildDuration(totalDurationMs),
    results: results.map(item => ({ id: item.id, ok: item.ok !== false })),
  };
  try {
    fs.writeFileSync(path.join(reportRoot, "summary.json"), JSON.stringify(summary, null, 2));
  } catch {}
  printJson(summary, process.stdout);
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

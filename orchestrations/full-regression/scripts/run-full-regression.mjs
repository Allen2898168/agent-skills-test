#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const orchestrationRoot = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(orchestrationRoot, "../..");

function usage() {
  return `Usage:
  node orchestrations/full-regression/scripts/run-full-regression.mjs --dry-run
  node orchestrations/full-regression/scripts/run-full-regression.mjs --confirm-run

Options:
  --selection <text>           lottery-regression selection tokens (default: 全部)
  --include-lottery            include lottery regression suite (default: true)
  --include-universal          include universal regression scripts suite (default: true)
  --include-orchestration      include orchestration YAML cases suite (default: false)
  --cleanup                    cleanup created activities (default: true)
  --report-root <path>         override report output root (default: result/full-regression/<stamp>)
  --recharge-amount <n>        override recharge amount (default: 1000)
  --wait-for-start-ms <n>      override frontend wait-for-start window (default: 60000)
  --dry-run                    print plan only
  --confirm-run                required for any write execution
  --help                       show this message
`;
}

function parseArgs(argv) {
  const args = {
    selection: "全部",
    includeLottery: true,
    includeUniversal: true,
    includeOrchestration: false,
    cleanup: true,
    reportRoot: "",
    rechargeAmount: "1000",
    waitForStartMs: "60000",
    dryRun: false,
    confirmRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--confirm-run") args.confirmRun = true;
    else if (token === "--include-lottery") args.includeLottery = true;
    else if (token === "--include-universal") args.includeUniversal = true;
    else if (token === "--include-orchestration") args.includeOrchestration = true;
    else if (token === "--no-include-lottery") args.includeLottery = false;
    else if (token === "--no-include-universal") args.includeUniversal = false;
    else if (token === "--no-cleanup") args.cleanup = false;
    else if (token === "--cleanup") args.cleanup = true;
    else if (token === "--selection") args.selection = String(argv[++i] || "").trim() || "全部";
    else if (token === "--report-root") args.reportRoot = String(argv[++i] || "").trim();
    else if (token === "--recharge-amount") args.rechargeAmount = String(argv[++i] || "1000").trim() || "1000";
    else if (token === "--wait-for-start-ms") args.waitForStartMs = String(argv[++i] || "60000").trim() || "60000";
    else throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function parseLastJson(text) {
  const source = String(text || "");
  const lines = source.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trimStart();
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    const candidate = lines.slice(i).join("\n").trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function runNodeJson(commandArgs, { cwd = repoRoot } = {}) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const payload = parseLastJson(stdout) || parseLastJson(stderr);
  return {
    exitCode: result.status ?? 1,
    ok: (result.status ?? 1) === 0 && payload?.ok !== false,
    stdout,
    stderr,
    payload,
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeWriteText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(text || ""));
}

function safeWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function listUniversalScripts() {
  const dir = path.join(repoRoot, "skills/weex-admin-ops/scripts");
  const files = fs.readdirSync(dir);
  return files
    .filter(name => /^regression-.*-universal-from-scratch\.mjs$/.test(name))
    .map(name => path.join("skills/weex-admin-ops/scripts", name))
    .sort((a, b) => a.localeCompare(b));
}

function listOrchestrationCaseIds() {
  const casesDir = path.join(repoRoot, "orchestrations/lottery-regression/cases");
  if (!fs.existsSync(casesDir)) return [];
  return fs.readdirSync(casesDir)
    .filter(name => name.endsWith(".yml"))
    .map(name => name.replace(/\.yml$/, ""))
    .sort((a, b) => a.localeCompare(b));
}

function extractCreatedAliasFromCaseRun(result) {
  const caseResults = Array.isArray(result?.caseResults) ? result.caseResults : [];
  for (const caseItem of caseResults) {
    const steps = Array.isArray(caseItem?.steps) ? caseItem.steps : [];
    for (const step of steps) {
      const payload = step?.payload;
      const alias = payload?.alias || payload?.target?.activityAlias || payload?.target?.showUrl;
      if (alias) return String(alias);
    }
  }
  const ctxAlias = result?.context?.activityAlias;
  if (ctxAlias) return String(ctxAlias);
  return "";
}

function cleanupLotteryActivity(alias) {
  if (!alias) return { ok: true, alias, skipped: true };
  const offline = runNodeJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "offline", "--activity-alias", alias]);
  const del = runNodeJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "delete", "--activity-alias", alias]);
  return { ok: Boolean(offline.ok || del.ok), alias, offlineOk: offline.ok, deleteOk: del.ok };
}

function summarizeLotteryDocCases({ lotteryReportsDir, stampText }) {
  const manifest = readJsonFile(path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json"));
  const docEntries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const docCaseIds = docEntries.map(item => String(item.caseId));
  const entrypointFiles = [
    "admin.json",
    "frontend_normal.json",
    "frontend_stock.json",
    "frontend_weight.json",
  ];
  const perCase = new Map();
  for (const file of entrypointFiles) {
    const filePath = path.join(lotteryReportsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const report = readJsonFile(filePath);
    const results = Array.isArray(report.caseResults) ? report.caseResults : [];
    for (const item of results) {
      const caseId = String(item.caseId || "");
      if (!caseId) continue;
      const status = String(item.status || (item.ok === false ? "FAIL" : "PASS")).toUpperCase();
      const prev = perCase.get(caseId) || "PASS";
      perCase.set(caseId, (prev === "FAIL" || status === "FAIL") ? "FAIL" : "PASS");
    }
  }
  const byStatus = { PASS: [], FAIL: [], SKIPPED: [] };
  for (const caseId of docCaseIds) {
    const status = perCase.get(caseId) || "SKIPPED";
    const meta = docEntries.find(item => item.caseId === caseId) || null;
    byStatus[status].push({
      caseId,
      caseName: meta?.caseName || "",
      module: meta?.module || "",
      priority: meta?.priority || "",
      reason: status === "SKIPPED" ? "未纳入当前自动化回归输出口径/无可执行 phase 映射" : "",
    });
  }
  return {
    stamp: stampText,
    total: docCaseIds.length,
    pass: byStatus.PASS.length,
    fail: byStatus.FAIL.length,
    skipped: byStatus.SKIPPED.length,
    failedCases: byStatus.FAIL.map(item => ({ caseId: item.caseId, caseName: item.caseName })),
    skippedCases: byStatus.SKIPPED.map(item => ({ caseId: item.caseId, caseName: item.caseName, reason: item.reason })),
  };
}

function buildMarkdownReport({ outDir, totals, lottery, universal, orchestration, lotteryReportRoot }) {
  const lines = [];
  lines.push(`# 全量回归报告（${totals.stamp}）`);
  lines.push("");
  lines.push("## 总览");
  lines.push(`- 口径：140 文档用例 + 141 脚本子用例 + 4 编排用例 = 285`);
  lines.push(`- 结果：PASS ${totals.pass} / FAIL ${totals.fail} / SKIPPED ${totals.skipped} / TOTAL 285`);
  lines.push("");
  lines.push("## 套件明细");
  lines.push(`- 转盘抽奖文档用例（140）：PASS ${lottery.pass} / FAIL ${lottery.fail} / SKIPPED ${lottery.skipped}`);
  for (const item of lottery.failedCases || []) lines.push(`  - FAIL ${item.caseId} ${item.caseName}`);
  for (const item of lottery.skippedCases || []) lines.push(`  - SKIPPED ${item.caseId} ${item.caseName}（${item.reason}）`);
  lines.push(`  - 产物：${path.join(outDir, "lottery-regression-summary.json")}`);
  lines.push("");
  lines.push(`- 通用回归脚本子用例（141）：PASS ${universal.pass} / FAIL ${universal.fail}`);
  for (const item of universal.rows || []) {
    lines.push(`  - ${item.script}: ${item.ok ? "PASS" : "FAIL"} ${item.resultMd || ""}`.trim());
  }
  lines.push("");
  lines.push(`- 编排用例（4）：PASS ${orchestration.pass} / FAIL ${orchestration.fail} / SKIPPED ${orchestration.skipped}`);
  for (const item of orchestration.details || []) {
    const suffix = item.note ? `（${item.note}）` : "";
    lines.push(`  - ${item.caseId}: ${item.status}${suffix}`.trim());
  }
  lines.push("");
  lines.push("## 原始报告与证据");
  if (lotteryReportRoot) lines.push(`- lottery-regression reportRoot：${lotteryReportRoot}`);
  lines.push(`- 汇总 JSON：${path.join(outDir, "summary.json")}`);
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const stampText = stamp();
  const outDir = args.reportRoot
    ? path.resolve(repoRoot, args.reportRoot)
    : path.join(repoRoot, "result/full-regression", stampText);

  const plan = {
    outDir,
    selection: args.selection,
    includeLottery: args.includeLottery,
    includeUniversal: args.includeUniversal,
    includeOrchestration: args.includeOrchestration,
    cleanup: args.cleanup,
    rechargeAmount: args.rechargeAmount,
    waitForStartMs: args.waitForStartMs,
  };

  if (args.dryRun) {
    safeWriteJson(path.join(outDir, "plan.json"), { ok: true, dryRun: true, plan });
    process.stdout.write(JSON.stringify({ ok: true, dryRun: true, plan, outDir }, null, 2) + "\n");
    return 0;
  }

  if (!args.confirmRun) throw new Error("需要用户确认：请加 --confirm-run 后才允许执行全量回归写操作。");

  fs.mkdirSync(outDir, { recursive: true });
  safeWriteJson(path.join(outDir, "plan.json"), { ok: true, dryRun: false, plan });

  const totals = { stamp: stampText, pass: 0, fail: 0, skipped: 0 };

  const suiteLottery = {
    total: 140,
    pass: 0,
    fail: 0,
    skipped: 140,
    failedCases: [],
    skippedCases: [],
    reportRoot: "",
  };

  const suiteUniversal = { total: 141, pass: 0, fail: 0, rows: [] };
  const suiteOrchestration = { total: 4, pass: 0, fail: 0, skipped: 4, details: [] };

  let lotteryAliases = { normal: "", weight: "", stock: "" };

  if (args.includeLottery) {
    const run = runNodeJson([
      "orchestrations/lottery-regression/scripts/run-full-headless.mjs",
      "--selection",
      args.selection || "全部",
      "--recharge-amount",
      String(args.rechargeAmount || "1000"),
      "--wait-for-start-ms",
      String(args.waitForStartMs || "60000"),
    ]);
    safeWriteText(path.join(outDir, "lottery-regression.stdout.txt"), run.stdout);
    safeWriteText(path.join(outDir, "lottery-regression.stderr.txt"), run.stderr);
    safeWriteJson(path.join(outDir, "lottery-regression.raw.json"), run.payload || { ok: false });

    const reportRoot = run.payload?.reportRoot ? String(run.payload.reportRoot) : "";
    suiteLottery.reportRoot = reportRoot;
    lotteryAliases = run.payload?.aliases || lotteryAliases;

    if (reportRoot) {
      const copy = (name, toName = name) => {
        const src = path.join(reportRoot, name);
        if (!fs.existsSync(src)) return;
        fs.copyFileSync(src, path.join(outDir, toName));
      };
      copy("summary.json", "lottery-regression-summary.json");
      copy("admin.json");
      copy("frontend_normal.json");
      copy("frontend_stock.json");
      copy("frontend_weight.json");
    }

    const summary = summarizeLotteryDocCases({ lotteryReportsDir: outDir, stampText });
    suiteLottery.pass = summary.pass;
    suiteLottery.fail = summary.fail;
    suiteLottery.skipped = summary.skipped;
    suiteLottery.failedCases = summary.failedCases;
    suiteLottery.skippedCases = summary.skippedCases;
  } else {
    suiteLottery.skippedCases = [{ caseId: "ALL", caseName: "", reason: "suite disabled" }];
  }

  if (args.includeUniversal) {
    const scripts = listUniversalScripts();
    const dir = path.join(outDir, "universal");
    fs.mkdirSync(dir, { recursive: true });
    const rows = [];
    for (const script of scripts) {
      const base = path.basename(script, ".mjs");
      const run = runNodeJson([script, "--confirm-run"], { cwd: repoRoot });
      safeWriteText(path.join(dir, `${base}.stdout.txt`), run.stdout);
      safeWriteText(path.join(dir, `${base}.stderr.txt`), run.stderr);
      safeWriteJson(path.join(dir, `${base}.json`), run.payload || { ok: false });
      rows.push({
        script: base,
        ok: Boolean(run.ok),
        exitCode: run.exitCode,
        resultMd: run.payload?.resultMd || "",
        error: run.payload?.error || "",
      });
    }
    suiteUniversal.rows = rows;
    suiteUniversal.pass = rows.filter(item => item.ok).length;
    suiteUniversal.fail = rows.filter(item => !item.ok).length;
    safeWriteJson(path.join(outDir, "universal-summary.json"), { ...suiteUniversal, scriptCount: rows.length });
  }

  if (args.includeOrchestration) {
    const caseIds = listOrchestrationCaseIds();
    const details = [];
    let pass = 0;
    let fail = 0;
    for (const caseId of caseIds) {
      const run = runNodeJson([
        "orchestrations/lottery-regression/scripts/run-case.mjs",
        "--case",
        caseId,
        "--recharge-amount",
        String(args.rechargeAmount || "1000"),
        "--save-screenshots",
      ], { cwd: repoRoot });
      safeWriteJson(path.join(outDir, `orchestration-${caseId}.json`), run.payload || { ok: false });
      safeWriteText(path.join(outDir, `orchestration-${caseId}.stderr.txt`), run.stderr);
      const status = run.ok ? "PASS" : "FAIL";
      details.push({ caseId, status });
      if (status === "PASS") pass += 1;
      else fail += 1;
      const createdAlias = extractCreatedAliasFromCaseRun(run.payload);
      if (args.cleanup && createdAlias) cleanupLotteryActivity(createdAlias);
    }
    suiteOrchestration.pass = pass;
    suiteOrchestration.fail = fail;
    suiteOrchestration.skipped = 0;
    suiteOrchestration.details = details;
  } else {
    suiteOrchestration.details = [{ caseId: "ALL", status: "SKIPPED", note: "默认关闭：避免状态污染与额外耗时；如需执行请加 --include-orchestration" }];
  }

  if (args.cleanup && args.includeLottery) {
    for (const alias of [lotteryAliases.normal, lotteryAliases.weight, lotteryAliases.stock].filter(Boolean)) {
      cleanupLotteryActivity(String(alias));
    }
  }

  const lotteryPass = Number(suiteLottery.pass || 0);
  const lotteryFail = Number(suiteLottery.fail || 0);
  const lotterySkipped = Number(suiteLottery.skipped || 0);
  const universalPass = Number(suiteUniversal.pass || 0);
  const universalFail = Number(suiteUniversal.fail || 0);

  const orchestrationPass = args.includeOrchestration ? Number(suiteOrchestration.pass || 0) : 0;
  const orchestrationFail = args.includeOrchestration ? Number(suiteOrchestration.fail || 0) : 0;
  const orchestrationSkipped = args.includeOrchestration ? 0 : suiteOrchestration.total;

  totals.pass = lotteryPass + universalPass + orchestrationPass;
  totals.fail = lotteryFail + universalFail + orchestrationFail;
  totals.skipped = lotterySkipped + orchestrationSkipped;

  const summary = {
    ok: totals.fail === 0,
    stamp: stampText,
    env: { target: "staging" },
    totals: { total: 285, pass: totals.pass, fail: totals.fail, skipped: totals.skipped },
    suites: {
      lottery_doc_140: suiteLottery,
      universal_regression_141: suiteUniversal,
      orchestration_4: suiteOrchestration,
    },
  };

  safeWriteJson(path.join(outDir, "summary.json"), summary);
  const md = buildMarkdownReport({
    outDir,
    totals: { ...totals, stamp: stampText },
    lottery: suiteLottery,
    universal: suiteUniversal,
    orchestration: {
      total: suiteOrchestration.total,
      pass: args.includeOrchestration ? suiteOrchestration.pass : 0,
      fail: args.includeOrchestration ? suiteOrchestration.fail : 0,
      skipped: orchestrationSkipped,
      details: suiteOrchestration.details,
    },
    lotteryReportRoot: suiteLottery.reportRoot,
  });
  safeWriteText(path.join(outDir, "report.md"), md);

  process.stdout.write(JSON.stringify({
    ok: summary.ok,
    stamp: stampText,
    reportDir: outDir,
    reportMd: path.join(outDir, "report.md"),
    summaryJson: path.join(outDir, "summary.json"),
  }, null, 2) + "\n");
  return summary.ok ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: error.message }, null, 2) + "\n");
  process.exitCode = 1;
}


#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");

const docsRoot = path.join(repoRoot, "docs/test-cases");
const orchestrationsRoot = path.join(repoRoot, "orchestrations");

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function parseDeclaredCount(filePath) {
  const text = readText(filePath);
  const match = text.match(/用例总数：\s*(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

function parseSubcaseCountFromCaseDoc(text) {
  const match = String(text || "").match(/- 子用例总数:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function listSuites() {
  const suites = [];
  const universal = path.join(docsRoot, "universal-regression");
  if (fs.existsSync(universal)) suites.push({ suite: "universal-regression", dir: universal });

  const automationRoot = path.join(docsRoot, "automation");
  if (fs.existsSync(automationRoot)) {
    for (const entry of fs.readdirSync(automationRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      suites.push({ suite: entry.name, dir: path.join(automationRoot, entry.name) });
    }
  }
  suites.sort((a, b) => a.suite.localeCompare(b.suite));
  return suites;
}

function computeSuiteCounts(suiteDir) {
  const casesDir = path.join(suiteDir, "cases");
  if (!fs.existsSync(casesDir)) return { scripts: 0, totalSubcases: 0 };
  const files = fs.readdirSync(casesDir).filter(f => f.endsWith(".md")).sort();
  let totalSubcases = 0;
  for (const f of files) {
    const text = readText(path.join(casesDir, f));
    totalSubcases += parseSubcaseCountFromCaseDoc(text);
  }
  return { scripts: files.length, totalSubcases };
}

function listOrchestrationSuites() {
  if (!fs.existsSync(orchestrationsRoot)) return [];
  const suites = [];
  for (const entry of fs.readdirSync(orchestrationsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const suiteDir = path.join(orchestrationsRoot, entry.name);
    const casesDir = path.join(suiteDir, "cases");
    if (!fs.existsSync(casesDir)) continue;
    const caseFiles = fs
      .readdirSync(casesDir)
      .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
    if (caseFiles.length === 0) continue;
    suites.push({ suite: entry.name, dir: suiteDir, casesDir, caseFiles });
  }
  suites.sort((a, b) => a.suite.localeCompare(b.suite));
  return suites;
}

function computeOrchestrationSuiteCounts(orchestrationSuite) {
  let totalSubcases = 0;
  for (const f of orchestrationSuite.caseFiles) {
    const absPath = path.join(orchestrationSuite.casesDir, f);
    const text = readText(absPath);
    try {
      const doc = YAML.parse(text);
      const steps = Array.isArray(doc?.steps) ? doc.steps : [];
      totalSubcases += steps.length;
    } catch {
      // ignore broken YAML; suite仍可生成索引，子用例数按 0 计
    }
  }
  return { cases: orchestrationSuite.caseFiles.length, totalSubcases };
}

function renderIndex({
  lotteryFrontend,
  lotteryAdmin,
  lotteryTotal,
  automationSuiteRows,
  orchestrationSuiteRows,
  automationTotalSubcases,
  orchestrationTotalSubcases,
  overallAutomatableTotal,
}) {
  const lines = [];
  lines.push("# 用例库总览（统一口径）");
  lines.push("");
  lines.push("> 本文件由 `node tools/generate-test-cases-index.mjs` 生成，请勿手改。");
  lines.push("");
  lines.push("## 统一统计口径（默认）");
  lines.push("- 用户问“总用例数”时，默认按 **“可自动化回归用例总数”** 统计（文档用例 + 已落地自动化子用例）。");
  lines.push("- 自动化脚本若包含子步骤（`steps.push({ name })`），则按 **“子用例 = 1 条 case”** 统计与沉淀。");
  lines.push("- orchestrations YAML 若包含 `steps`，则按 **“steps 条数 = 子用例数”** 统计。");
  lines.push("");
  lines.push("## 可自动化回归用例库（文档用例）");
  lines.push(`- 转盘抽奖（后管）：${lotteryAdmin}`);
  lines.push(`- 转盘抽奖（前端）：${lotteryFrontend}`);
  lines.push(`- 转盘抽奖合计：${lotteryTotal}`);
  lines.push("");
  lines.push("## 已落地自动化用例库（子用例口径）");
  lines.push("");
  lines.push("| 套件 | 用例数 | 子用例总数 | 类型 | 入口 |");
  lines.push("| --- | ---: | ---: | --- | --- |");
  for (const row of automationSuiteRows) {
    lines.push(`| ${row.suite} | ${row.cases} | ${row.totalSubcases} | 自动化文档(脚本) | ${row.entry} |`);
  }
  for (const row of orchestrationSuiteRows) {
    lines.push(`| ${row.suite} | ${row.cases} | ${row.totalSubcases} | 编排(orchestration) | ${row.entry} |`);
  }
  lines.push("");
  lines.push(`- 自动化子用例合计（脚本）：${automationTotalSubcases}`);
  lines.push(`- 自动化子用例合计（编排）：${orchestrationTotalSubcases}`);
  lines.push("");
  lines.push("## 总用例数（默认口径：可自动化回归）");
  lines.push(`- 合计：${overallAutomatableTotal}`);
  lines.push("");
  lines.push("## 维护方式");
  lines.push("- 新增/修改自动化链路脚本后：`npm run generate:test-cases`");
  lines.push("- 新增 step name 如需更友好的中文描述/预期：补充 `tools/lib/result-md.mjs` 的 `DEFAULT_STEP_META_ZH`");
  lines.push("");
  return lines.join("\n");
}

async function run() {
  const lotteryFrontendPath = path.join(docsRoot, "lottery-frontend-regression-cases.md");
  const lotteryAdminPath = path.join(docsRoot, "lottery-admin-regression-cases.md");
  const lotteryFrontend = parseDeclaredCount(lotteryFrontendPath) ?? 0;
  const lotteryAdmin = parseDeclaredCount(lotteryAdminPath) ?? 0;
  const lotteryTotal = lotteryFrontend + lotteryAdmin;

  const suites = listSuites();
  const automationSuiteRows = [];
  let automationTotalSubcases = 0;
  for (const suite of suites) {
    const counts = computeSuiteCounts(suite.dir);
    automationTotalSubcases += counts.totalSubcases;
    const entry = suite.suite === "universal-regression"
      ? "docs/test-cases/universal-regression/README.md"
      : `docs/test-cases/automation/${suite.suite}/README.md`;
    automationSuiteRows.push({ suite: suite.suite, cases: counts.scripts, totalSubcases: counts.totalSubcases, entry });
  }

  const orchestrationSuites = listOrchestrationSuites();
  const orchestrationSuiteRows = [];
  let orchestrationTotalSubcases = 0;
  for (const suite of orchestrationSuites) {
    const counts = computeOrchestrationSuiteCounts(suite);
    orchestrationTotalSubcases += counts.totalSubcases;
    orchestrationSuiteRows.push({
      suite: suite.suite,
      cases: counts.cases,
      totalSubcases: counts.totalSubcases,
      entry: `orchestrations/${suite.suite}/README.md`,
    });
  }

  const overallAutomatableTotal = lotteryTotal + automationTotalSubcases + orchestrationTotalSubcases;
  const content = renderIndex({
    lotteryFrontend,
    lotteryAdmin,
    lotteryTotal,
    automationSuiteRows,
    orchestrationSuiteRows,
    automationTotalSubcases,
    orchestrationTotalSubcases,
    overallAutomatableTotal,
  });

  fs.writeFileSync(path.join(docsRoot, "index.md"), content, "utf8");
  process.stdout.write(
    JSON.stringify(
      { ok: true, lotteryTotal, automationTotalSubcases, orchestrationTotalSubcases, overallAutomatableTotal },
      null,
      2,
    ),
  );
  process.stdout.write("\n");
  return 0;
}

process.exitCode = await run();

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStepMetaZh } from "./lib/result-md.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");

const skillsRoot = path.join(repoRoot, "skills");
const docsRoot = path.join(repoRoot, "docs/test-cases");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function orderedUnique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      out.push(next);
    }
  }
  return out;
}

function extractSteps(scriptText) {
  const names = [];
  const re = /steps\.push\(\s*\{[^}]*\bname\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(scriptText))) names.push(match[1]);
  return orderedUnique(names);
}

function extractCaseId(scriptText) {
  const match = scriptText.match(/\bcaseId\s*:\s*"([A-Z0-9_]+_universal_from_scratch)"/);
  return match ? match[1] : "";
}

function extractWriteResultMarkdownSuccessBlock(scriptText) {
  const blocks = [];
  const re = /writeResultMarkdown\(\{\s*([\s\S]*?)\s*\}\);/g;
  let match;
  while ((match = re.exec(scriptText))) blocks.push(match[1]);

  const candidates = blocks.filter(block => /\btestCase\s*:\s*\{/.test(block));
  const success = candidates.find(block => !/\bcaseId\s*:\s*".+_failed"/.test(block));
  return success || "";
}

function extractLiteral(blockText, key) {
  const match = blockText.match(new RegExp(`\\b${key}\\s*:\\s*\"([^\"]+)\"`));
  return match ? match[1] : "";
}

function extractSuite(blockText) {
  return extractLiteral(blockText, "suite");
}

function extractTitle(blockText) {
  return extractLiteral(blockText, "title");
}

function extractTestCase(blockText, fallbackCaseId) {
  const numberLine = (blockText.match(/\bnumber\s*:\s*([^,\n]+)\s*,?/) || [])[1] || "";
  let number = "";
  const numberLiteral = numberLine.match(/"([^"]+)"/);
  if (numberLiteral) number = numberLiteral[1];
  if (!number && /UR-ADMIN-\$\{result\.caseId\}/.test(numberLine)) number = `UR-ADMIN-${fallbackCaseId}`;
  if (!number) number = fallbackCaseId || "UNKNOWN";

  const description = (blockText.match(/\bdescription\s*:\s*"([^"]+)"/) || [])[1] || "";
  const preconditionsBlock = (blockText.match(/\bpreconditions\s*:\s*\[([\s\S]*?)\]\s*,?\s*(?:tags|})/) || [])[1] || "";
  const preconditions = preconditionsBlock
    ? Array.from(preconditionsBlock.matchAll(/"([^"]+)"/g)).map(m => m[1])
    : [];
  const tagsBlock = (blockText.match(/\btags\s*:\s*\[([\s\S]*?)\]/) || [])[1] || "";
  const tags = tagsBlock ? Array.from(tagsBlock.matchAll(/"([^"]+)"/g)).map(m => m[1]) : [];
  return { number, description, preconditions, tags };
}

function suiteOutputDir(suite) {
  if (suite === "universal-regression") return path.join(docsRoot, "universal-regression");
  return path.join(docsRoot, "automation", suite);
}

function buildCaseDoc({ suite, title, testCase, scriptRelPath, steps }) {
  const lines = [];
  const caseNo = testCase.number;
  lines.push(`# ${title || caseNo}`);
  lines.push("");
  lines.push("## 用例信息");
  lines.push(`- 用例编号: ${caseNo}`);
  lines.push(`- 套件: ${suite}`);
  lines.push(`- 子用例总数: ${steps.length}`);
  lines.push(`- 脚本入口: ${scriptRelPath}`);
  if (testCase.tags.length) lines.push(`- 标签: ${testCase.tags.join(", ")}`);
  if (testCase.description) lines.push(`- 用例描述: ${testCase.description}`);
  lines.push("");
  lines.push("## 前置条件");
  if (testCase.preconditions.length) {
    for (const item of testCase.preconditions) lines.push(`- ${item}`);
  } else {
    lines.push("-（未声明）");
  }
  lines.push("");
  lines.push("## 子用例清单");
  lines.push("");
  lines.push("| 编号 | 子用例名称 | 子用例描述 | 预期结果 |");
  lines.push("| --- | --- | --- | --- |");
  steps.forEach((stepName, idx) => {
    const subNo = `${caseNo}-TC-${String(idx + 1).padStart(2, "0")}`;
    const meta = resolveStepMetaZh(stepName);
    const desc = String(meta.desc || "").replace(/\|/g, "\\|");
    const expected = String(meta.expected || "").replace(/\|/g, "\\|");
    lines.push(`| ${subNo} | ${stepName} | ${desc} | ${expected} |`);
  });
  lines.push("");
  return lines.join("\n");
}

function parseSubcaseCountFromCaseDoc(text) {
  const match = String(text || "").match(/- 子用例总数:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function rebuildSuiteReadme(suiteDir, suite, caseNos) {
  const casesDir = path.join(suiteDir, "cases");
  const items = [];
  let totalSubcases = 0;
  for (const caseNo of caseNos) {
    const p = path.join(casesDir, `${caseNo}.md`);
    const text = fs.readFileSync(p, "utf8");
    const title = (text.match(/^#\s+(.+)$/m) || [])[1] || caseNo;
    const subcases = parseSubcaseCountFromCaseDoc(text);
    totalSubcases += subcases;
    items.push({ caseNo, title, subcases, docRel: `cases/${caseNo}.md` });
  }

  const lines = [];
  lines.push(`# 自动化回归用例库：${suite}`);
  lines.push("");
  lines.push("本目录由脚本元信息自动生成；用例条目按“子用例(step) = case”口径统计。");
  lines.push("");
  lines.push("## 汇总");
  lines.push(`- 脚本用例数: ${items.length}`);
  lines.push(`- 子用例总数: ${totalSubcases}`);
  lines.push("");
  lines.push("| 用例编号 | 用例名称 | 子用例数 | 用例文档 |");
  lines.push("| --- | --- | ---: | --- |");
  for (const item of items) {
    lines.push(`| ${item.caseNo} | ${item.title.replace(/\|/g, "\\|")} | ${item.subcases} | ${item.docRel} |`);
  }
  lines.push("");
  lines.push("## 维护");
  lines.push("- 新增/修改脚本的 `testCase` 或 `steps.push({ name })` 后，运行：`npm run generate:test-cases`");
  lines.push("- 新增 step name 如需更友好的中文描述/预期，请补充：`tools/lib/result-md.mjs` 的 `DEFAULT_STEP_META_ZH`");
  lines.push("");

  fs.writeFileSync(path.join(suiteDir, "README.md"), lines.join("\n"), "utf8");
  return { scripts: items.length, totalSubcases };
}

async function run() {
  const scriptFiles = walkFiles(skillsRoot)
    .filter(p => p.endsWith(".mjs") && p.includes(`${path.sep}scripts${path.sep}`));

  const suites = new Map(); // suite -> Map(caseNo -> { title, scriptRelPath, content })

  for (const absPath of scriptFiles) {
    const text = fs.readFileSync(absPath, "utf8");
    if (!text.includes("writeResultMarkdown({")) continue;
    if (!text.includes("testCase:")) continue;

    const caseId = extractCaseId(text);
    if (!caseId) continue;

    const block = extractWriteResultMarkdownSuccessBlock(text);
    if (!block) continue;

    const suite = extractSuite(block) || "universal-regression";
    const title = extractTitle(block) || caseId;
    const testCase = extractTestCase(block, caseId);
    const steps = extractSteps(text);

    const suiteDir = suiteOutputDir(suite);
    const casesDir = path.join(suiteDir, "cases");
    ensureDir(casesDir);

    const scriptRelPath = path.relative(repoRoot, absPath).replaceAll(path.sep, "/");
    const caseDoc = buildCaseDoc({ suite, title, testCase, scriptRelPath, steps });
    fs.writeFileSync(path.join(casesDir, `${testCase.number}.md`), caseDoc, "utf8");

    if (!suites.has(suite)) suites.set(suite, new Map());
    suites.get(suite).set(testCase.number, { title, scriptRelPath, steps: steps.length });
  }

  const suiteSummaries = [];
  for (const [suite, items] of Array.from(suites.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const suiteDir = suiteOutputDir(suite);
    const caseNos = Array.from(items.keys()).sort();
    const summary = rebuildSuiteReadme(suiteDir, suite, caseNos);
    suiteSummaries.push({ suite, ...summary });
  }

  process.stdout.write(JSON.stringify({ ok: true, suites: suiteSummaries }, null, 2));
  process.stdout.write("\n");
  return 0;
}

process.exitCode = await run();


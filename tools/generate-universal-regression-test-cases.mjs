#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStepMetaZh } from "./lib/result-md.mjs";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");

const scriptsDir = path.join(repoRoot, "skills/weex-admin-ops/scripts");
const outputRoot = path.join(repoRoot, "docs/test-cases/universal-regression");
const outputCasesDir = path.join(outputRoot, "cases");

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
  const re = /writeResultMarkdown\(\{\s*([\s\S]*?)\s*\}\);\s*/g;
  let match;
  while ((match = re.exec(scriptText))) blocks.push(match[1]);
  // pick the success block (not failed) with caseId: result.caseId
  const candidate = blocks.find(block => (
    /\bcaseId\s*:\s*result\.caseId\b/.test(block)
      && /\btestCase\s*:\s*\{/.test(block)
      && !/\bcaseId\s*:\s*".+_failed"/.test(block)
  ));
  return candidate || "";
}

function extractTitleFromBlock(blockText) {
  const match = blockText.match(/\btitle\s*:\s*"([^"]+)"/);
  return match ? match[1] : "";
}

function extractTestCaseFromBlock(blockText, fallbackCaseId) {
  const number = `UR-ADMIN-${fallbackCaseId}`;
  const description = (blockText.match(/\bdescription\s*:\s*"([^"]+)"/) || [])[1] || "";
  const preconditionsBlock = (blockText.match(/\bpreconditions\s*:\s*\[([\s\S]*?)\]\s*,?\s*(?:tags|})/) || [])[1] || "";
  const preconditions = preconditionsBlock
    ? Array.from(preconditionsBlock.matchAll(/"([^"]+)"/g)).map(m => m[1])
    : [];
  const tagsBlock = (blockText.match(/\btags\s*:\s*\[([\s\S]*?)\]/) || [])[1] || "";
  const tags = tagsBlock ? Array.from(tagsBlock.matchAll(/"([^"]+)"/g)).map(m => m[1]) : [];
  return { number, description, preconditions, tags };
}

function buildCaseDoc({ title, caseId, scriptRelPath, testCase, steps }) {
  const lines = [];
  const caseNo = testCase.number;
  lines.push(`# ${title || caseId}`);
  lines.push("");
  lines.push("## 用例信息");
  lines.push(`- 用例编号: ${caseNo}`);
  lines.push(`- 子用例总数: ${steps.length}`);
  lines.push(`- 脚本入口: ${scriptRelPath}`);
  if (testCase.tags.length) lines.push(`- 标签: ${testCase.tags.join(", ")}`);
  if (testCase.description) lines.push(`- 用例描述: ${testCase.description}`);
  lines.push("");
  if (testCase.preconditions.length) {
    lines.push("## 前置条件");
    for (const item of testCase.preconditions) lines.push(`- ${item}`);
    lines.push("");
  }

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

function buildIndexDoc(items, { totalSubcases }) {
  const lines = [];
  lines.push("# 通用回归（从零配置）自动化用例库（后管）");
  lines.push("");
  lines.push("本目录收录 `skills/weex-admin-ops/scripts/regression-*-universal-from-scratch.mjs` 的通用回归用例。");
  lines.push("");
  lines.push("## 统计口径");
  lines.push("- 用例编号：`UR-ADMIN-<caseId>`");
  lines.push("- 子用例编号：`UR-ADMIN-<caseId>-TC-01` 起；每个脚本的每个 `steps.push({ name })` 视为 1 条子用例");
  lines.push("");
  lines.push("## 汇总");
  lines.push(`- 脚本用例数: ${items.length}`);
  lines.push(`- 子用例总数: ${totalSubcases}`);
  lines.push("");
  lines.push("| 用例编号 | 用例名称 | 子用例数 | 脚本入口 | 用例文档 |");
  lines.push("| --- | --- | ---: | --- | --- |");
  for (const item of items) {
    const docRel = `cases/${item.caseNo}.md`;
    lines.push(`| ${item.caseNo} | ${item.title.replace(/\|/g, "\\|")} | ${item.subcaseCount} | ${item.scriptRelPath} | ${docRel} |`);
  }
  lines.push("");
  lines.push("## 维护方式");
  lines.push("- 新增/修改通用回归脚本后，运行：`node tools/generate-universal-regression-test-cases.mjs` 更新本目录用例库");
  lines.push("- 新增子步骤 name 时，如需更友好的中文描述/预期，请补充：`tools/lib/result-md.mjs` 的 `DEFAULT_STEP_META_ZH`");
  lines.push("");
  return lines.join("\n");
}

async function run() {
  const files = fs.readdirSync(scriptsDir)
    .filter(name => /^regression-.*-universal-from-scratch\.mjs$/.test(name))
    .sort();

  const items = [];
  let totalSubcases = 0;

  for (const fileName of files) {
    const absPath = path.join(scriptsDir, fileName);
    const scriptText = fs.readFileSync(absPath, "utf8");
    const caseId = extractCaseId(scriptText);
    if (!caseId) throw new Error(`无法从脚本解析 caseId: ${fileName}`);

    const block = extractWriteResultMarkdownSuccessBlock(scriptText);
    if (!block) throw new Error(`无法定位 writeResultMarkdown 成功输出块: ${fileName}`);

    const title = extractTitleFromBlock(block);
    const testCase = extractTestCaseFromBlock(block, caseId);
    const steps = extractSteps(scriptText);
    const caseNo = testCase.number;

    const scriptRelPath = `skills/weex-admin-ops/scripts/${fileName}`;
    const caseDoc = buildCaseDoc({ title, caseId, scriptRelPath, testCase, steps });

    ensureDir(outputCasesDir);
    fs.writeFileSync(path.join(outputCasesDir, `${caseNo}.md`), caseDoc, "utf8");

    items.push({
      caseId,
      caseNo,
      title: title || caseId,
      subcaseCount: steps.length,
      scriptRelPath,
    });
    totalSubcases += steps.length;
  }

  ensureDir(outputRoot);
  const indexDoc = buildIndexDoc(items, { totalSubcases });
  fs.writeFileSync(path.join(outputRoot, "README.md"), indexDoc, "utf8");

  process.stdout.write(JSON.stringify({ ok: true, scripts: items.length, totalSubcases }, null, 2));
  process.stdout.write("\n");
  return 0;
}

process.exitCode = await run();


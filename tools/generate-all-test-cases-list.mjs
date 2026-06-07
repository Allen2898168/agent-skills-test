#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function getLotteryDocCases() {
  const manifestPath = path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json");
  const manifest = readJson(manifestPath);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  return entries.map((item) => ({
    id: String(item.caseId || "").trim(),
    name: String(item.caseName || "").trim(),
    briefZhDesc: `模块：${String(item.module || "未分类").trim()}`,
  })).filter((item) => item.id && item.name);
}

function parseUniversalCaseRows(mdText) {
  const rows = [];
  const lines = String(mdText || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("| UR-ADMIN-")) continue;
    const cells = trimmed.split("|").map((cell) => cell.trim());
    if (cells.length < 6) continue;
    const id = cells[1] || "";
    const name = cells[2] || "";
    const desc = cells[3] || "";
    if (!id || !name) continue;
    rows.push({ id, name, briefZhDesc: desc || `执行子步骤：${name}` });
  }
  return rows;
}

function getUniversalSubCases() {
  const casesDir = path.join(repoRoot, "docs/test-cases/universal-regression/cases");
  const files = fs.readdirSync(casesDir)
    .filter((name) => name.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  const rows = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(casesDir, file), "utf8");
    rows.push(...parseUniversalCaseRows(content));
  }
  return rows;
}

function getOrchestrationCases() {
  const casesDir = path.join(repoRoot, "orchestrations/lottery-regression/cases");
  if (!fs.existsSync(casesDir)) return [];
  const files = fs.readdirSync(casesDir)
    .filter((name) => name.endsWith(".yml"))
    .sort((a, b) => a.localeCompare(b));

  const rows = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(casesDir, file), "utf8");
    const idMatch = text.match(/^id:\s*(.+)$/m);
    const nameMatch = text.match(/^name:\s*(.+)$/m);
    const id = idMatch ? idMatch[1].trim() : file.replace(/\.yml$/, "");
    const name = nameMatch ? nameMatch[1].trim() : "编排用例";
    rows.push({ id, name, briefZhDesc: "编排链路校验（YAML case）" });
  }
  return rows;
}

function appendSection(lines, title, rows, startIndex) {
  lines.push(`## ${title}（${rows.length}）`);
  lines.push("");
  lines.push("| 序号 | 用例编号 | 用例内容 | 简要中文描述 |",);
  lines.push("| --- | --- | --- | --- |");
  let index = startIndex;
  for (const row of rows) {
    lines.push(`| ${index} | ${escapeCell(row.id)} | ${escapeCell(row.name)} | ${escapeCell(row.briefZhDesc)} |`);
    index += 1;
  }
  lines.push("");
  return index;
}

function main() {
  const lotteryRows = getLotteryDocCases();
  const universalRows = getUniversalSubCases();
  const orchestrationRows = getOrchestrationCases();

  const total = lotteryRows.length + universalRows.length + orchestrationRows.length;

  const lines = [];
  lines.push(`# 当前全量用例清单（${total}）`);
  lines.push("");

  let idx = 1;
  idx = appendSection(lines, "1. Lottery 文档用例", lotteryRows, idx);
  idx = appendSection(lines, "2. 通用回归脚本子用例", universalRows, idx);
  idx = appendSection(lines, "3. 编排用例", orchestrationRows, idx);

  lines.push("## 统计");
  lines.push("");
  lines.push(`- Lottery 文档用例：${lotteryRows.length}`);
  lines.push(`- 通用回归脚本子用例：${universalRows.length}`);
  lines.push(`- 编排用例：${orchestrationRows.length}`);
  lines.push(`- 合计：${lotteryRows.length}+${universalRows.length}+${orchestrationRows.length}=${total}`);
  lines.push("");

  const outPath = path.join(repoRoot, "result/all-test-cases-285.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  process.stdout.write(JSON.stringify({
    ok: true,
    outPath,
    counts: {
      lotteryDoc: lotteryRows.length,
      universalSubCases: universalRows.length,
      orchestration: orchestrationRows.length,
      total,
    },
  }, null, 2) + "\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: error.message }, null, 2) + "\n");
  process.exitCode = 1;
}

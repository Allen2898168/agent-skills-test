#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureActivityWebDir,
  extractActivityTaskListTypes,
  extractLotteryRaffleStyles,
} from "../lib/activity-web-mappings.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../../..");

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractLotterySupportedTasks(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/const/index.js");
  const text = readFileSafe(filePath);
  const start = text.indexOf("export const LOTTERY_TASKS");
  if (start < 0) return { filePath, tasks: [] };
  const bracketStart = text.indexOf("[", start);
  if (bracketStart < 0) return { filePath, tasks: [] };
  const bracketEnd = text.indexOf("]", bracketStart);
  if (bracketEnd < 0) return { filePath, tasks: [] };
  const chunk = text.slice(bracketStart + 1, bracketEnd);
  const keys = [];
  const keyRe = /'([A-Z0-9_]+)'/g;
  for (const match of chunk.matchAll(keyRe)) keys.push(match[1]);
  const labelByKey = {};
  for (const key of keys) {
    const re = new RegExp(`${key}\\\\s*:\\\\s*\\\\{\\\\s*label\\\\s*:\\\\s*'([^']+)'\\\\s*,\\\\s*value\\\\s*:\\\\s*'${key}'`, "m");
    const hit = text.match(re);
    labelByKey[key] = hit?.[1] || "";
  }
  const tasks = keys.map(key => ({ key, label: labelByKey[key] || key }));
  return { filePath, tasks };
}

function extractObjectLiteral(text, exportName) {
  const marker = `export const ${exportName} =`;
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const braceStart = text.indexOf("{", start);
  if (braceStart < 0) return "";
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(braceStart, i + 1);
    }
  }
  return "";
}

function parseActivityBackendMapping(block) {
  const mapping = {};
  const re = /([A-Z0-9_]+)\s*:\s*([0-9]+)\s*(,|\/|$)/g;
  for (const match of block.matchAll(re)) mapping[match[1]] = Number(match[2]);
  return mapping;
}

function buildMappingByValue({ list, backendMapping }) {
  const mappingByValue = {};
  for (const item of list) {
    if (!item?.value || item.value === "NONE") continue;
    const code = backendMapping[item.value];
    if (code !== undefined) mappingByValue[item.value] = code;
  }
  return mappingByValue;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(absPath, data) {
  fs.writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const outDir = path.join(repoRoot, "skills/weex-admin-ops/references/catalogs");
  ensureDir(outDir);

  const activityTypes = extractActivityTaskListTypes(activityWebDir);
  const constIndexPath = path.join(activityWebDir, "activity-ui/src/views/activity/const/index.js");
  const constIndexText = readFileSafe(constIndexPath);
  const backendBlock = extractObjectLiteral(constIndexText, "ACTIVITY_BACKEND_MAPPING");
  const backendMapping = parseActivityBackendMapping(backendBlock);
  const backendWithCustom = { ...backendMapping, CUSTOMIZED: 9, CONTRACT_MINING: 15 };
  writeJson(path.join(outDir, "activity-task-types.json"), {
    source: activityTypes.filePath,
    list: activityTypes.options || [],
    backendMapping: backendWithCustom,
    mappingByValue: buildMappingByValue({ list: activityTypes.options || [], backendMapping: backendWithCustom }),
  });

  const styles = extractLotteryRaffleStyles(activityWebDir);
  writeJson(path.join(outDir, "lottery-raffle-styles.json"), { source: styles.filePath, styles: styles.styles || [] });

  const tasks = extractLotterySupportedTasks(activityWebDir);
  writeJson(path.join(outDir, "lottery-supported-tasks.json"), { source: tasks.filePath, tasks: tasks.tasks || [] });

  process.stdout.write(
    `${JSON.stringify({ ok: true, activityWebDir, written: ["references/catalogs/activity-task-types.json", "references/catalogs/lottery-raffle-styles.json", "references/catalogs/lottery-supported-tasks.json"] }, null, 2)}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  process.exitCode = 1;
}

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const currentFile = fileURLToPath(import.meta.url);
const orchestrationRoot = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(orchestrationRoot, "../..");
const casesRoot = path.join(orchestrationRoot, "cases");

function usage() {
  return `Usage:
  node orchestrations/lottery-regression/scripts/run-case.mjs --case FE-22
  node orchestrations/lottery-regression/scripts/run-case.mjs --case FE-22 --activity-alias <alias>

Options:
  --case <id>             case id, e.g. FE-22
  --activity-alias <t>    reuse an existing online activity alias (optional)
  --recharge-amount <n>   override recharge amount (default 1000)
  --save-screenshots      save step screenshots to frontend artifacts
  --dry-run               print the resolved execution order and exit
  --help                  show this message
`;
}

function parseFlags(argv) {
  const args = { caseId: "", activityAlias: "", rechargeAmount: "1000", saveScreenshots: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--save-screenshots") args.saveScreenshots = true;
    else if (token === "--case") args.caseId = String(argv[++index] || "");
    else if (token === "--activity-alias") args.activityAlias = String(argv[++index] || "");
    else if (token === "--recharge-amount") args.rechargeAmount = String(argv[++index] || "");
    else throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function readYamlFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error(`Invalid YAML: ${filePath}`);
  return parsed;
}

function resolveCasePath(caseId) {
  return path.join(casesRoot, `${caseId}.yml`);
}

function getByPath(value, pathText) {
  if (!pathText) return undefined;
  const parts = String(pathText)
    .split(".")
    .map(item => item.trim())
    .filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function renderTemplate(text, ctx) {
  return String(text).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = getByPath(ctx, key);
    return value == null ? "" : String(value);
  });
}

function shouldRunStep(step, ctx) {
  const whenUnset = Array.isArray(step?.whenUnset) ? step.whenUnset : [];
  const whenSet = Array.isArray(step?.whenSet) ? step.whenSet : [];
  const isSet = value => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (typeof value === "boolean") return value === true;
    return true;
  };
  for (const key of whenUnset) {
    const value = getByPath(ctx, key);
    if (isSet(value)) return false;
  }
  for (const key of whenSet) {
    const value = getByPath(ctx, key);
    if (!isSet(value)) return false;
  }
  return true;
}

function normalizeSteps(spec, specDir) {
  const includes = Array.isArray(spec?.includes) ? spec.includes : [];
  const steps = [];
  for (const include of includes) {
    const includePath = path.resolve(specDir, String(include));
    const next = readYamlFile(includePath);
    const nextSteps = normalizeSteps(next, path.dirname(includePath));
    steps.push(...nextSteps);
  }
  steps.push(...(Array.isArray(spec?.steps) ? spec.steps : []));
  return steps;
}

function readCaseSpec(caseId) {
  const filePath = resolveCasePath(caseId);
  if (!fs.existsSync(filePath)) throw new Error(`Case file not found: ${filePath}`);
  const spec = readYamlFile(filePath);
  return { filePath, spec };
}

function resolveDependencyOrder(rootCaseId) {
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(caseId) {
    if (visited.has(caseId)) return;
    if (visiting.has(caseId)) throw new Error(`Cyclic dependency detected at ${caseId}`);
    visiting.add(caseId);
    const { spec } = readCaseSpec(caseId);
    const deps = Array.isArray(spec?.deps) ? spec.deps.map(item => String(item)) : [];
    for (const dep of deps) visit(dep);
    visiting.delete(caseId);
    visited.add(caseId);
    ordered.push(caseId);
  }

  visit(rootCaseId);
  return ordered;
}

function assertPayload(assertion, payload, ctx) {
  const pathText = String(assertion?.path || "");
  const actual = getByPath(payload, pathText);
  if (Object.prototype.hasOwnProperty.call(assertion, "equals")) {
    const expected = assertion.equals;
    const passed = actual === expected;
    return { passed, actual, expected, op: "equals", path: pathText };
  }
  if (Object.prototype.hasOwnProperty.call(assertion, "gte")) {
    const expected = Number(assertion.gte);
    const actualNumber = Number(actual);
    const passed = Number.isFinite(actualNumber) && actualNumber >= expected;
    return { passed, actual: actualNumber, expected, op: "gte", path: pathText };
  }
  if (Object.prototype.hasOwnProperty.call(assertion, "truthy")) {
    const passed = Boolean(actual);
    return { passed, actual, expected: true, op: "truthy", path: pathText };
  }
  throw new Error(`Unsupported assertion: ${JSON.stringify(assertion)}`);
}

function runNodeStep(step, ctx) {
  const args = (Array.isArray(step?.args) ? step.args : []).map(token => renderTemplate(token, ctx));
  if (!args.length) throw new Error(`Step args missing: ${step?.id || "<unknown>"}`);
  const command = [process.execPath, ...args];
  process.stderr.write(`[case-run] STEP ${String(step?.id || "").trim() || "<unknown>"}\n`);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const payload = parseLastJson(stdout) || parseLastJson(stderr);
  const ok = (result.status ?? 1) === 0 && payload?.ok !== false;
  const finishedAt = Date.now();
  process.stderr.write(`[case-run] STEP ${String(step?.id || "").trim() || "<unknown>"} ${ok ? "PASS" : "FAIL"}\n`);
  return {
    ok,
    exitCode: result.status ?? 1,
    command,
    payload,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };
}

function applyCaptures(step, payload, ctx) {
  const capture = step?.capture && typeof step.capture === "object" ? step.capture : {};
  for (const [key, valuePath] of Object.entries(capture)) {
    const next = getByPath(payload, String(valuePath));
    if (next === undefined) continue;
    ctx[key] = next;
  }
}

function evaluateStepAssertions(step, payload, ctx) {
  const assertions = Array.isArray(step?.assert) ? step.assert : [];
  const results = [];
  for (const assertion of assertions) {
    const evaluated = assertPayload(assertion, payload, ctx);
    results.push(evaluated);
  }
  const ok = results.every(item => item.passed);
  return { ok, results };
}

function runCaseOnce(caseId, ctx) {
  const { filePath, spec } = readCaseSpec(caseId);
  const specDir = path.dirname(filePath);
  const steps = normalizeSteps(spec, specDir);
  const defaultRecharge = spec?.defaults?.rechargeAmount ? String(spec.defaults.rechargeAmount) : "";
  if (!ctx.rechargeAmount) ctx.rechargeAmount = defaultRecharge || "1000";

  const results = [];
  let ok = true;
  process.stderr.write(`[case-run] CASE ${caseId}\n`);
  for (const step of steps) {
    const stepId = String(step?.id || "");
    if (!shouldRunStep(step, ctx)) {
      results.push({ id: stepId, skipped: true, ok: true });
      continue;
    }
    if (String(step?.run || "node") !== "node") throw new Error(`Unsupported step runner: ${step?.run}`);
    const attemptCount = Math.max(1, Number(step?.retry?.times || 1));
    let final = null;
    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      const execution = runNodeStep(step, ctx);
      const assertionEval = execution.payload ? evaluateStepAssertions(step, execution.payload, ctx) : { ok: true, results: [] };
      const stepOk = Boolean(execution.ok && assertionEval.ok);
      final = {
        id: stepId,
        ok: stepOk,
        attempt,
        attempts: attemptCount,
        command: execution.command,
        durationMs: execution.durationMs,
        exitCode: execution.exitCode,
        assertionResults: assertionEval.results,
        error: execution.payload?.error || "",
        payload: execution.payload || null,
      };
      if (stepOk) {
        applyCaptures(step, execution.payload || {}, ctx);
        break;
      }
      if (attempt < attemptCount) {
        // Retry delay is optional; keep minimal.
      }
    }
    results.push(final);
    if (!final?.ok) {
      ok = false;
      break;
    }
  }

  return {
    caseId,
    name: String(spec?.name || ""),
    ok,
    steps: results,
  };
}

async function main() {
  const args = parseFlags(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.caseId) throw new Error("--case is required");

  const order = resolveDependencyOrder(args.caseId);
  const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const screenshotDir = path.join(repoRoot, "skills/weex-frontend-ops/artifacts/screenshots/抽奖回归", runStamp);
  if (args.saveScreenshots) fs.mkdirSync(screenshotDir, { recursive: true });
  const ctx = {
    activityAlias: String(args.activityAlias || "").trim(),
    activityOnline: Boolean(String(args.activityAlias || "").trim()) ? true : null,
    rechargeAmount: String(args.rechargeAmount || "1000"),
    saveScreenshots: args.saveScreenshots,
    runStamp,
    screenshotDir: args.saveScreenshots ? screenshotDir : "",
  };
  if (args.dryRun) {
    process.stdout.write(JSON.stringify({ ok: true, dryRun: true, order, context: ctx }, null, 2) + "\n");
    return 0;
  }

  const startedAt = Date.now();
  const caseResults = [];
  let ok = true;
  for (const caseId of order) {
    const result = runCaseOnce(caseId, ctx);
    caseResults.push(result);
    if (!result.ok) {
      ok = false;
      break;
    }
  }
  const finishedAt = Date.now();
  process.stdout.write(JSON.stringify({
    ok,
    rootCaseId: args.caseId,
    order,
    context: {
      activityAlias: ctx.activityAlias || "",
      rechargeAmount: ctx.rechargeAmount || "",
    },
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    caseResults,
  }, null, 2) + "\n");
  return ok ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: error.message }, null, 2) + "\n");
  process.exitCode = 1;
}

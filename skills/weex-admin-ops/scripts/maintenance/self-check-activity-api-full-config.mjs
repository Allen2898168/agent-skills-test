#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "../lib/cli.mjs";
import { parseLastJson } from "../../../../tools/lib/parse-last-json.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../../..");

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/maintenance/self-check-activity-api-full-config.mjs

Options:
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: [] });
  return args;
}

function runChildJson(commandArgs, { timeoutMs = 120000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, Math.max(10000, Number(timeoutMs)));
    child.stdout.on("data", chunk => (stdout += chunk.toString()));
    child.stderr.on("data", chunk => (stderr += chunk.toString()));
    child.on("close", code => {
      clearTimeout(timer);
      const parsed = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({
        ok: code === 0,
        code,
        killedByTimeout,
        json: parsed || null,
        stderrTail: String(stderr || "").trim().split("\n").slice(-3).join("\n"),
      });
    });
  });
}

function simplifyWizardOut(out) {
  const json = out?.json || {};
  let wizard = json?.wizard || (json?.wizard === true ? json : null);
  if (wizard && typeof wizard === "object" && !Array.isArray(wizard)) {
    const keys = Object.keys(wizard);
    if (keys.length === 1 && !("moduleNameMap" in wizard) && !("fieldNameMap" in wizard)) {
      const inner = wizard[keys[0]];
      if (inner && typeof inner === "object" && !Array.isArray(inner)) wizard = inner;
    }
  }
  return {
    ok: Boolean(json?.ok !== false),
    mode: json?.mode || null,
    domain: json?.domain || wizard?.domain || null,
    moduleNameMapSource: json?.moduleNameMapSource || wizard?.moduleNameMapSource || null,
    fieldNameMapSource: json?.fieldNameMapSource || wizard?.fieldNameMapSource || null,
    hasModuleNameMap: Boolean((json?.moduleNameMap && Object.keys(json.moduleNameMap).length) || (wizard?.moduleNameMap && Object.keys(wizard.moduleNameMap).length)),
    hasFieldNameMap: Boolean((json?.fieldNameMap && Object.keys(json.fieldNameMap).length) || (wizard?.fieldNameMap && Object.keys(wizard.fieldNameMap).length)),
  };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const audits = {
    coverageAll: await runChildJson(["skills/weex-admin-ops/scripts/maintenance/audit-activity-api-full-config-coverage-all.mjs"], { timeoutMs: 120000 }),
    noActivityWebRuntime: await runChildJson(["skills/weex-admin-ops/scripts/maintenance/audit-no-activity-web-runtime.mjs"], { timeoutMs: 120000 }),
    nlActionCacheMatch: await runChildJson(["skills/weex-admin-ops/scripts/maintenance/audit-activity-nl-action-cache-match.mjs"], { timeoutMs: 120000 }),
  };

  const coverage = audits.coverageAll.json;
  const results = Array.isArray(coverage?.results) ? coverage.results : [];
  const actionCachePath = String(coverage?.actionCachePath || "skills/weex-admin-ops/scripts/action-cache.json");
  const actionCacheAbs = path.join(repoRoot, actionCachePath);
  const actionCache = fs.existsSync(actionCacheAbs) ? JSON.parse(fs.readFileSync(actionCacheAbs, "utf8")) : {};
  const actions = Array.isArray(actionCache?.actions) ? actionCache.actions : [];

  const specs = [
    { type: "BEGINNER_TASK", label: "新手活动", wizard: "skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/newbie-activity-module-config-fast-api.mjs" },
    { type: "LOTTERY", label: "转盘抽奖", wizard: "skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/lottery-activity-module-config-fast-api.mjs" },
    { type: "TRADING_COMPETITION", label: "交易大赛", wizard: "skills/weex-admin-ops/scripts/competition-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/competition-activity-module-config-fast-api.mjs" },
    { type: "RACE_COMPETITION", label: "交易竞速赛", wizard: "skills/weex-admin-ops/scripts/race-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs" },
    { type: "TRACE_PRO", label: "小活动型活动", wizard: "skills/weex-admin-ops/scripts/tracepro-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/tracepro-activity-module-config-fast-api.mjs" },
    { type: "CUSTOMIZED", label: "定制化活动", wizard: "skills/weex-admin-ops/scripts/customized-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/customized-activity-module-config-fast-api.mjs" },
    { type: "RECHARGE_TRANS_TASK", label: "充值交易活动", wizard: "skills/weex-admin-ops/scripts/recharge-trans-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/recharge-trans-activity-module-config-fast-api.mjs" },
    { type: "AGENT", label: "人人代理活动", wizard: "skills/weex-admin-ops/scripts/agent-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/agent-activity-module-config-fast-api.mjs" },
    { type: "CONTRACT_MINING", label: "合约挖矿活动", wizard: "skills/weex-admin-ops/scripts/contract-mining-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/contract-mining-activity-module-config-fast-api.mjs" },
    { type: "FLIP", label: "小丑牌活动", wizard: "skills/weex-admin-ops/scripts/flip-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/flip-activity-module-config-fast-api.mjs" },
    { type: "GUESS", label: "竞猜大赛", wizard: "skills/weex-admin-ops/scripts/guess-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs" },
    { type: "MONOPOLY_WORLD_CUP", label: "大富翁世界杯", wizard: "skills/weex-admin-ops/scripts/monopoly-worldcup-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/monopoly-worldcup-activity-module-config-fast-api.mjs" },
    { type: "AGENT_TRACE_PRO", label: "代理小活动", wizard: "skills/weex-admin-ops/scripts/agent-tracepro-config-wizard-api.mjs", modules: "skills/weex-admin-ops/scripts/agent-tracepro-activity-module-config-fast-api.mjs" },
  ];

  const checks = [];
  for (const spec of specs) {
    const wizardOut = await runChildJson([spec.wizard, "--wizard"], { timeoutMs: 120000 });
    const modulesOut = await runChildJson([spec.modules, "--wizard"], { timeoutMs: 120000 });
    const coverageRow = results.find(r => r.type === spec.type) || null;

    const wizard = simplifyWizardOut(wizardOut);
    const modulesWizard = simplifyWizardOut(modulesOut);

    checks.push({
      type: spec.type,
      label: spec.label,
      coverageOk: Boolean(coverageRow?.ok),
      wizard: { script: spec.wizard.replace(/^skills\/weex-admin-ops\//, ""), ...wizard },
      modulesWizard: { script: spec.modules.replace(/^skills\/weex-admin-ops\//, ""), ...modulesWizard },
      actionCacheHint: { actionIdsCount: actions.length },
      stderrTail: {
        wizard: wizardOut.ok ? null : wizardOut.stderrTail,
        modulesWizard: modulesOut.ok ? null : modulesOut.stderrTail,
      },
    });
  }

  const ok =
    Boolean(audits.coverageAll.ok && audits.coverageAll.json?.ok) &&
    Boolean(audits.noActivityWebRuntime.ok && audits.noActivityWebRuntime.json?.ok) &&
    Boolean(audits.nlActionCacheMatch.ok && audits.nlActionCacheMatch.json?.ok) &&
    checks.every(item => (
      item.coverageOk &&
      item.wizard.ok &&
      item.wizard.hasModuleNameMap &&
      item.wizard.hasFieldNameMap &&
      item.modulesWizard.ok &&
      item.modulesWizard.hasModuleNameMap &&
      item.modulesWizard.hasFieldNameMap
    ));

  printJson({
    ok,
    mode: "headless_api",
    audits: {
      coverageAll: { ok: audits.coverageAll.ok, jsonOk: audits.coverageAll.json?.ok ?? null },
      noActivityWebRuntime: { ok: audits.noActivityWebRuntime.ok, jsonOk: audits.noActivityWebRuntime.json?.ok ?? null },
      nlActionCacheMatch: { ok: audits.nlActionCacheMatch.ok, jsonOk: audits.nlActionCacheMatch.json?.ok ?? null },
    },
    checks,
    nextStep: ok ? "能力自检通过：可以在用户确认后执行 staging 写操作验证（min/full/cleanup）。" : "自检失败：请根据 checks.stderrTail 修复对应脚本。",
  });
  return ok ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { pathsFrom } from "./lib/runtime.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Default: dry-run plan only
  node skills/weex-admin-ops/scripts/verify-nonlottery-api-full-config-staging.mjs --dry-run

  # Run min verify + cleanup for all non-lottery activities (writes)
  node skills/weex-admin-ops/scripts/verify-nonlottery-api-full-config-staging.mjs --confirm-run --verify-level min

  # Run full verify + cleanup for all (writes; includes online/offline)
  node skills/weex-admin-ops/scripts/verify-nonlottery-api-full-config-staging.mjs --confirm-run --verify-level full --confirm-full-verify

Options:
  --verify-level <min|full>     default min
  --only <competition|race|tracepro|customized|recharge|agent|contract_mining|flip|guess|monopoly|agent_trace_pro|all> default all
  --required-volume <n>         default 1
  --start-offset-seconds <n>    default 120
  --end-days <n>                default 7
  --resource-cards <n>          default 3 (only for tracepro/agent_trace_pro)
  --confirm-run                 required for any write execution
  --confirm-full-verify         required when --verify-level=full
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--dry-run", "--confirm-run", "--confirm-full-verify"],
  });
  args.dryRun = Boolean(args.dryRun);
  args.confirmRun = Boolean(args.confirmRun);
  args.confirmFullVerify = Boolean(args.confirmFullVerify);
  args.verifyLevel = args.verifyLevel ? String(args.verifyLevel) : "min";
  args.only = args.only ? String(args.only) : "all";
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 120;
  args.endDays = args.endDays ? Number(args.endDays) : 7;
  args.resourceCards = args.resourceCards ? Number(args.resourceCards) : 3;
  return args;
}

function runChildJson(commandArgs, { timeoutMs = 600000 } = {}) {
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
    }, Math.max(30000, Number(timeoutMs)));
    child.stdout.on("data", chunk => (stdout += chunk.toString()));
    child.stderr.on("data", chunk => (stderr += chunk.toString()));
    child.on("close", code => {
      clearTimeout(timer);
      const parsed = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({ ok: code === 0 && Boolean(parsed?.ok !== false), code, killedByTimeout, stdout, stderr, json: parsed });
    });
  });
}

function buildSteps(args) {
  const verifyLevel = String(args.verifyLevel || "min");
  if (!["min", "full"].includes(verifyLevel)) throw new Error(`--verify-level must be min|full, got: ${verifyLevel}`);
  if (verifyLevel === "full" && !args.confirmFullVerify && !args.dryRun) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }

  const common = ["--confirm-create", "--verify-level", verifyLevel, "--cleanup", "--confirm-cleanup", "--required-volume", String(args.requiredVolume)];
  const timeArgs = ["--start-offset-seconds", String(args.startOffsetSeconds), "--end-days", String(args.endDays)];
  const fullFlag = verifyLevel === "full" ? ["--confirm-full-verify"] : [];

  const candidates = [
    {
      key: "competition",
      label: "交易大赛（TRADING_COMPETITION）",
      script: "skills/weex-admin-ops/scripts/create-competition-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-competition-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "race",
      label: "交易竞速赛（RACE_COMPETITION）",
      script: "skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-race-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "tracepro",
      label: "小活动型活动（TRACE_PRO）",
      script: "skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-tracepro-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        "--resource-cards",
        String(args.resourceCards),
        ...timeArgs,
      ],
    },
    {
      key: "customized",
      label: "定制化活动（CUSTOMIZED）",
      script: "skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "recharge",
      label: "充值交易活动（RECHARGE_TRANS_TASK）",
      script: "skills/weex-admin-ops/scripts/create-recharge-trans-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-recharge-trans-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "agent",
      label: "人人代理活动（AGENT）",
      script: "skills/weex-admin-ops/scripts/create-agent-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-agent-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "contract_mining",
      label: "合约挖矿活动（CONTRACT_MINING）",
      script: "skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "flip",
      label: "小丑牌活动（FLIP）",
      script: "skills/weex-admin-ops/scripts/create-flip-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-flip-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "guess",
      label: "竞猜大赛（GUESS）",
      script: "skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-guess-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "monopoly",
      label: "大富翁世界杯（MONOPOLY_WORLD_CUP）",
      script: "skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-monopoly-worldcup-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        ...timeArgs,
      ],
    },
    {
      key: "agent_trace_pro",
      label: "代理小活动（AGENT_TRACE_PRO）",
      script: "skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-agent-tracepro-full-config-explicit-deps-fast-api.mjs",
        ...common,
        ...fullFlag,
        "--resource-cards",
        String(args.resourceCards),
        ...timeArgs,
      ],
    },
  ];

  const only = String(args.only || "all");
  if (only === "all") return candidates;
  const found = candidates.find(item => item.key === only);
  if (!found) throw new Error(`Unknown --only: ${only}`);
  return [found];
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const steps = buildSteps(args);
  const plan = {
    mode: "headless_api",
    environment: "staging",
    verifyLevel: args.verifyLevel,
    only: args.only,
    requiredVolume: args.requiredVolume,
    resourceCards: args.resourceCards,
    startOffsetSeconds: args.startOffsetSeconds,
    endDays: args.endDays,
    steps: steps.map(item => ({ key: item.key, label: item.label, script: item.script, command: [process.execPath, ...item.commandArgs] })),
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmRun) throw new Error("需要用户确认：请传 --confirm-run 后才允许执行 staging 写操作验证（含 cleanup 删除）。");

  const results = [];
  for (const step of steps) {
    const startedAt = Date.now();
    const result = await runChildJson(step.commandArgs);
    results.push({ key: step.key, label: step.label, ok: result.ok, durationMs: Date.now() - startedAt, json: result.json || null });
    if (!result.ok) {
      printJson({ ok: false, failedAt: step.key, plan, results });
      return 2;
    }
  }

  printJson({ ok: true, plan, results });
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { pathsFrom } from "./lib/runtime.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Default: dry-run plan only
  node skills/weex-admin-ops/scripts/verify-activity-api-full-config-staging.mjs --dry-run

  # Run min verify + cleanup for all Activity List types (writes)
  node skills/weex-admin-ops/scripts/verify-activity-api-full-config-staging.mjs --confirm-run --verify-level min

  # Run full verify + cleanup for all (writes; includes online/offline)
  node skills/weex-admin-ops/scripts/verify-activity-api-full-config-staging.mjs --confirm-run --verify-level full --confirm-full-verify

Options:
  --verify-level <min|full>     default min
  --only <newbie|lottery|nonlottery|all> default all
  --required-volume <n>         default 1 (only for non-lottery activities)
  --start-offset-seconds <n>    default 120
  --end-days <n>                default 7
  --resource-cards <n>          default 3 (only for TRACE_PRO/AGENT_TRACE_PRO)
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

function runChildJson(commandArgs, { timeoutMs = 1200000 } = {}) {
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

  const common = ["--confirm-run", "--verify-level", verifyLevel, "--start-offset-seconds", String(args.startOffsetSeconds), "--end-days", String(args.endDays)];
  const fullFlag = verifyLevel === "full" ? ["--confirm-full-verify"] : [];

  const steps = [
    {
      key: "newbie",
      label: "新手活动（BEGINNER_TASK）",
      commandArgs: ["skills/weex-admin-ops/scripts/verify-newbie-api-full-config-staging.mjs", ...common, ...fullFlag],
    },
    {
      key: "lottery",
      label: "转盘抽奖（LOTTERY）",
      commandArgs: ["skills/weex-admin-ops/scripts/verify-lottery-api-full-config-staging.mjs", ...common, ...fullFlag],
    },
    {
      key: "nonlottery",
      label: "非新手/非转盘（11个类型）",
      commandArgs: [
        "skills/weex-admin-ops/scripts/verify-nonlottery-api-full-config-staging.mjs",
        "--confirm-run",
        "--verify-level",
        verifyLevel,
        ...(verifyLevel === "full" ? ["--confirm-full-verify"] : []),
        "--only",
        "all",
        "--required-volume",
        String(args.requiredVolume),
        "--resource-cards",
        String(args.resourceCards),
        "--start-offset-seconds",
        String(args.startOffsetSeconds),
        "--end-days",
        String(args.endDays),
      ],
    },
  ];

  const only = String(args.only || "all");
  if (only === "all") return steps;
  const found = steps.find(item => item.key === only);
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
  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      mode: "headless_api",
      baseUrl: process.env.WEEX_ADMIN_BASE_URL || "https://stg-activity.weex.tech",
      steps: steps.map(s => ({ key: s.key, label: s.label, command: [process.execPath, ...s.commandArgs] })),
      nextStep: "如需执行全活动类型 min/full verify + cleanup，请加 --confirm-run。",
    });
    return 0;
  }
  if (!args.confirmRun) throw new Error("需要用户确认：请加 --confirm-run 后才允许执行写操作。");

  const startedAt = Date.now();
  const results = [];
  for (const step of steps) {
    const res = await runChildJson(step.commandArgs);
    results.push({ key: step.key, label: step.label, ok: res.ok, code: res.code, killedByTimeout: res.killedByTimeout, json: res.json || null });
    if (!res.ok) {
      printJson({ ok: false, mode: "headless_api", failedAt: { key: step.key, label: step.label }, results, durationMs: Date.now() - startedAt }, process.stderr);
      return 1;
    }
  }

  printJson({ ok: true, mode: "headless_api", results, durationMs: Date.now() - startedAt });
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Default: dry-run plan only
  node skills/weex-admin-ops/scripts/verify-lottery-api-full-config-staging.mjs --dry-run

  # Run min verify + cleanup (writes)
  node skills/weex-admin-ops/scripts/verify-lottery-api-full-config-staging.mjs --confirm-run --verify-level min

  # Run full verify + cleanup (writes; includes online/offline)
  node skills/weex-admin-ops/scripts/verify-lottery-api-full-config-staging.mjs --confirm-run --verify-level full --confirm-full-verify

Options:
  --verify-level <min|full>     default min
  --start-offset-seconds <n>    default 120
  --end-days <n>                default 7
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
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 120;
  args.endDays = args.endDays ? Number(args.endDays) : 7;
  return args;
}

function runChildJson(commandArgs, { timeoutMs = 900000 } = {}) {
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

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deletePrize(api, id) {
  const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function deleteApplyTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/apply/${encodeURIComponent(String(id))}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

function buildPlan(args) {
  const verifyLevel = String(args.verifyLevel || "min");
  if (!["min", "full"].includes(verifyLevel)) throw new Error(`--verify-level must be min|full, got: ${verifyLevel}`);
  if (verifyLevel === "full" && !args.confirmFullVerify && !args.dryRun) {
    throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify（包含上线/下线写操作）。");
  }

  return {
    verifyLevel,
    create: {
      script: "skills/weex-admin-ops/scripts/create-lottery-full-config-explicit-deps-fast-api.mjs",
      commandArgs: [
        "skills/weex-admin-ops/scripts/create-lottery-full-config-explicit-deps-fast-api.mjs",
        "--confirm-create",
        "--start-offset-seconds",
        String(args.startOffsetSeconds),
        "--end-days",
        String(args.endDays),
      ],
    },
    verifyMin: [
      {
        label: "snapshot",
        script: "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
        commandArgs: ["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "snapshot", "--activity-id", "<created.activityId>"],
      },
    ],
    verifyFull:
      verifyLevel === "full"
        ? [
            {
              label: "online",
              script: "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
              commandArgs: ["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "online", "--activity-id", "<created.activityId>"],
            },
            {
              label: "offline",
              script: "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
              commandArgs: ["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "offline", "--activity-id", "<created.activityId>"],
            },
          ]
        : [],
    cleanup: {
      deleteActivity: {
        script: "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
        commandArgs: ["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "delete", "--activity-id", "<created.activityId>"],
      },
      deleteDeps: "<created.dependencyIds createdPrizeIds/createdTaskIds/applyTemplateCreated>",
    },
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const plan = buildPlan(args);
  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      mode: "headless_api",
      baseUrl: process.env.WEEX_ADMIN_BASE_URL || "https://stg-activity.weex.tech",
      plan,
      nextStep: "如需执行转盘抽奖 create → min/full verify → cleanup，请加 --confirm-run。",
    });
    return 0;
  }
  if (!args.confirmRun) throw new Error("需要用户确认：请加 --confirm-run 后才允许执行写操作。");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  // 1) create
  const created = await runChildJson(plan.create.commandArgs);
  if (!created.ok) {
    printJson({ ok: false, mode: "headless_api", phase: "create", error: created.json?.error || "create_failed", created: created.json || null }, process.stderr);
    return 1;
  }
  const createdActivityId = String(created.json?.created?.activityId || "");
  const dependency = created.json?.dependencyIds || {};
  const createdTaskIds = Array.isArray(dependency.createdTaskIds) ? dependency.createdTaskIds.map(String) : [];
  const createdPrizeIds = Array.isArray(dependency.createdPrizeIds) ? dependency.createdPrizeIds.map(String) : [];
  const applyTemplateId = String(dependency.applyTemplateId || "");
  const applyTemplateCreated = Boolean(dependency.applyTemplateCreated);
  if (!createdActivityId) throw new Error("create step did not return created.activityId");

  // 2) min verify
  const snapshot = await runChildJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "snapshot", "--activity-id", createdActivityId]);
  if (!snapshot.ok) {
    printJson({ ok: false, mode: "headless_api", phase: "min_verify", error: snapshot.json?.error || "snapshot_failed", created: created.json || null }, process.stderr);
    return 1;
  }

  // 3) full verify
  let onlineRes = null;
  let offlineRes = null;
  if (String(plan.verifyLevel) === "full") {
    if (!args.confirmFullVerify) throw new Error("需要用户确认：--verify-level=full 需要同时传 --confirm-full-verify。");
    onlineRes = await runChildJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "online", "--activity-id", createdActivityId]);
    if (!onlineRes.ok) throw new Error(`online failed: ${onlineRes.json?.error || "unknown"}`);
    offlineRes = await runChildJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "offline", "--activity-id", createdActivityId]);
    if (!offlineRes.ok) throw new Error(`offline failed: ${offlineRes.json?.error || "unknown"}`);
  }

  // 4) cleanup
  const deleteActivity = await runChildJson(["skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs", "--action", "delete", "--activity-id", createdActivityId]);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const deleteTasks = await Promise.all(createdTaskIds.map(id => deleteTask(api, id)));
    const deletePrizes = await Promise.all(createdPrizeIds.map(id => deletePrize(api, id)));
    const deleteApply = applyTemplateCreated && applyTemplateId ? await deleteApplyTemplate(api, applyTemplateId) : { ok: true, status: null, body: { code: null, msg: "skipped (reused existing apply template)" } };
    const ok =
      Boolean(created.ok) &&
      Boolean(snapshot.ok) &&
      Boolean(deleteActivity.ok) &&
      deleteTasks.every(item => item.ok) &&
      deletePrizes.every(item => item.ok) &&
      deleteApply.ok &&
      (plan.verifyLevel !== "full" || (onlineRes?.ok && offlineRes?.ok));

    printJson(
      {
        ok,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activities/lottery`,
        verifyLevel: plan.verifyLevel,
        created: created.json?.created || null,
        dependencyIds: created.json?.dependencyIds || null,
        minVerify: { snapshot: snapshot.json || null },
        fullVerify: plan.verifyLevel === "full" ? { online: onlineRes?.json || null, offline: offlineRes?.json || null } : null,
        cleanup: {
          deleteActivity: deleteActivity.json || null,
          deleteApplyTemplate: deleteApply,
          deleteTasks,
          deletePrizes,
        },
        durationMs: Date.now() - startedAt,
      },
      ok ? process.stdout : process.stderr,
    );
    return ok ? 0 : 1;
  } finally {
    await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


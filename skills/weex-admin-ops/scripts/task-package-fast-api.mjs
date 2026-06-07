#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # list
  node skills/weex-admin-ops/scripts/task-package-fast-api.mjs --action list

  # detail
  node skills/weex-admin-ops/scripts/task-package-fast-api.mjs --action detail --id 123

  # create minimal BEGINNER_TASK package from provided task ids
  node skills/weex-admin-ops/scripts/task-package-fast-api.mjs --action create --task-ids 1,2,3 --confirm-create

  # update
  node skills/weex-admin-ops/scripts/task-package-fast-api.mjs --action update --id 123 --task-ids 1,2,3 --confirm-create

  # copy
  node skills/weex-admin-ops/scripts/task-package-fast-api.mjs --action copy --id 123 --confirm-create

  # delete (requires totp)
  node skills/weex-admin-ops/scripts/task-package-fast-api.mjs --action delete --id 123 --confirm-cleanup

Options:
  --action <list|detail|create|update|copy|delete|all>
  --id <id>
  --task-ids <csv>              used by create/update
  --name <text>                 used by create/update (default 自动化任务包_<ts>)
  --remark <text>               used by create/update
  --totp <code>                 NOT ALLOWED (use env WEEX_ADMIN_GOOGLE_CODE)
  --confirm-create
  --confirm-cleanup
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create", "--confirm-cleanup"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  args.action = args.action ? String(args.action) : "";
  args.id = args.id ? String(args.id) : "";
  args.taskIds = String(args.taskIds || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
  args.name = args.name ? String(args.name) : "";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function list(api, params = {}) {
  const qs = new URLSearchParams();
  qs.set("pageNum", String(params.pageNum || 1));
  qs.set("pageSize", String(params.pageSize || 10));
  if (params.id) qs.set("id", String(params.id));
  if (params.taskPackageName) qs.set("taskPackageName", String(params.taskPackageName));
  if (params.operator) qs.set("operator", String(params.operator));
  return api.get(`/prod-api/activity/taskPackage/list?${qs.toString()}`);
}

async function all(api) {
  return api.get("/prod-api/activity/taskPackage/all");
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/taskPackage/${encodeURIComponent(String(id))}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Task package detail failed: ${id}`);
  return res.body.data;
}

function buildPayload({ name, remark, taskIds }) {
  return {
    taskPackageName: name,
    taskConfigIds: taskIds.map(v => Number(v)),
    remark: remark || "",
    taskPackageNameI18: [],
  };
}

async function create(api, args) {
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建任务包。");
  if (!args.taskIds.length) throw new Error("--task-ids is required for create");
  const name = String(args.name || `自动化任务包_${timestamp()}`).slice(0, 60);
  const payload = buildPayload({ name, remark: args.remark, taskIds: args.taskIds });
  const res = await api.post("/prod-api/activity/taskPackage", payload);
  if (res.body?.code !== 200) throw new Error(`Create task package failed: ${JSON.stringify(res.body)}`);

  const verify = await list(api, { pageNum: 1, pageSize: 5, taskPackageName: name });
  const row = (Array.isArray(verify.body?.rows) ? verify.body.rows : []).find(item => String(item?.taskPackageName || "") === name) || firstRow(verify);
  const id = row?.id;
  if (!id) throw new Error(`Created task package not found by name: ${name}`);
  const det = await detail(api, id);
  return { id: String(id), taskPackageName: det.taskPackageName || name, taskCount: Array.isArray(det.taskConfig) ? det.taskConfig.length : null };
}

async function update(api, args) {
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许修改任务包。");
  if (!args.id) throw new Error("--id is required for update");
  if (!args.taskIds.length) throw new Error("--task-ids is required for update");
  const before = await detail(api, args.id);
  const name = String(args.name || before.taskPackageName || `自动化任务包_${timestamp()}`).slice(0, 60);
  const payload = { ...buildPayload({ name, remark: args.remark || before.remark || "", taskIds: args.taskIds }), id: Number(args.id) };
  const res = await api.put("/prod-api/activity/taskPackage", payload);
  if (res.body?.code !== 200) throw new Error(`Update task package failed: ${JSON.stringify(res.body)}`);
  const det = await detail(api, args.id);
  return { id: String(args.id), taskPackageName: det.taskPackageName || name, taskCount: Array.isArray(det.taskConfig) ? det.taskConfig.length : null };
}

async function copy(api, args) {
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许复制任务包。");
  if (!args.id) throw new Error("--id is required for copy");
  const res = await api.post("/prod-api/activity/taskPackage/copy", { id: Number(args.id) });
  if (res.body?.code !== 200) throw new Error(`Copy task package failed: ${JSON.stringify(res.body)}`);
  return { ok: true, copiedFrom: String(args.id), response: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function remove(api, args, config) {
  if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除任务包。");
  if (!args.id) throw new Error("--id is required for delete");
  const res = await api.post("/prod-api/activity/taskPackage/remove", { id: Number(args.id), totp: String(config.googleCode || "") });
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.action) throw new Error("--action is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }
  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();

  try {
    if (args.action === "list") {
      const res = await list(api, { pageNum: 1, pageSize: 10 });
      printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/commonModule/newUserActivityTaskPackage`, sample: (res.body?.rows || []).slice(0, 5), durationMs: Date.now() - startedAt });
      return 0;
    }
    if (args.action === "all") {
      const res = await all(api);
      const data = Array.isArray(res.body?.data) ? res.body.data : [];
      printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/commonModule/newUserActivityTaskPackage`, total: data.length, sample: data.slice(0, 5), durationMs: Date.now() - startedAt });
      return 0;
    }
    if (args.action === "detail") {
      if (!args.id) throw new Error("--id is required for detail");
      const det = await detail(api, args.id);
      printJson({ ok: true, mode: "headless_api", id: String(args.id), taskPackageName: det.taskPackageName || "", taskCount: Array.isArray(det.taskConfig) ? det.taskConfig.length : null, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (args.action === "create") {
      const created = await create(api, args);
      printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/commonModule/newUserActivityTaskPackage`, created, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (args.action === "update") {
      const updated = await update(api, args);
      printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/commonModule/newUserActivityTaskPackage`, updated, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (args.action === "copy") {
      const copied = await copy(api, args);
      printJson({ ...copied, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/commonModule/newUserActivityTaskPackage`, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (args.action === "delete") {
      const deleted = await remove(api, args, config);
      printJson({ ok: deleted.ok, mode: "headless_api", id: String(args.id), delete: deleted, durationMs: Date.now() - startedAt }, deleted.ok ? process.stdout : process.stderr);
      return deleted.ok ? 0 : 1;
    }
    throw new Error(`Unsupported --action: ${args.action}`);
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


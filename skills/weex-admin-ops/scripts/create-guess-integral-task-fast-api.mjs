#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-guess-integral-task-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-guess-integral-task-fast-api.mjs --confirm-create

Options:
  --template-id <id>      optional; if omitted, auto-pick a GUESS(22) non-GUESS taskType template
  --name-prefix <text>    default 竞猜大赛_积分任务
  --tag-prefix <text>     default guess_int
  --remark <text>         optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "竞猜大赛_积分任务";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "guess_int";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function taskList(api, { pageNum = 1, pageSize = 20, activityTypeCode = 22 } = {}) {
  const qs = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize), activityType: String(activityTypeCode) });
  return api.get(`/prod-api/activity/task/list?${qs.toString()}`);
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

function isGuessTaskType(detail) {
  const t = detail?.taskType ?? detail?.commonForm?.taskType;
  return String(t || "").toUpperCase() === "GUESS";
}

async function pickTemplate(api, args) {
  if (args.templateId) return await taskDetail(api, args.templateId);
  const list = await taskList(api, { pageNum: 1, pageSize: 30, activityTypeCode: 22 });
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  for (const row of rows) {
    if (!row?.id) continue;
    const detail = await taskDetail(api, row.id).catch(() => null);
    if (!detail) continue;
    if (!isGuessTaskType(detail)) return detail;
  }
  const first = firstRow(list);
  if (first?.id) {
    const fallback = await taskDetail(api, first.id);
    throw new Error(`未找到 GUESS(22) 的非竞猜(taskType!=GUESS) 任务模板；fallback 模板 taskType=${fallback?.taskType || fallback?.commonForm?.taskType || "<missing>"}，请手动指定 --template-id`);
  }
  throw new Error("未找到可用于 clone 的 GUESS(22) 活动任务模板；请先在后管创建至少一条 GUESS 任务，或直接指定 --template-id");
}

function patchI18(payload, key, value) {
  const i18Key = `${key}I18`;
  if (Array.isArray(payload[i18Key])) payload[i18Key] = payload[i18Key].map(item => ({ ...item, name: value }));
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.content = `积分任务_${ts}`.slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-GUESS积分任务(${ts})`).slice(0, 120);
  patchI18(payload, "name", name);
  patchI18(payload, "content", payload.content);
  patchI18(payload, "label", tag);
  return { name, tag };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = { mode: "headless_api", activityType: "GUESS(22)", writes: { create: true }, templateId: args.templateId || null };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await pickTemplate(api, args);
    const payload = stripCloneFields(template);
    const mutated = mutateTaskPayload(payload, args);

    const created = await api.post("/prod-api/activity/task", payload);
    if (created.body?.code !== 200) throw new Error(`Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);

    const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(mutated.name)}&pageNum=1&pageSize=1`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created task not found by name: ${mutated.name}`);
    const detail = await taskDetail(api, row.id);

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: String(row.id), name: mutated.name, tag: mutated.tag, taskType: detail?.taskType ?? null },
      createdTaskDetail: detail,
      durationMs: Date.now() - startedAt,
    });
    return 0;
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


#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-guessing-task-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-guessing-task-fast-api.mjs --confirm-create

Options:
  --template-id <id>      optional; if omitted, auto-pick a template from /activity/guessTask/all
  --name-prefix <text>    default 竞猜大赛_竞猜任务
  --tag-prefix <text>     default guess_task
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
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "竞猜大赛_竞猜任务";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "guess_task";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function listAll(api) {
  const res = await api.get("/prod-api/activity/guessTask/all");
  const rows = Array.isArray(res.body?.data) ? res.body.data : (Array.isArray(res.body) ? res.body : []);
  return rows;
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/guessTask/${encodeURIComponent(String(id))}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`GuessTask detail failed: ${id}`);
  return res.body.data;
}

async function pickTemplate(api, args) {
  if (args.templateId) return await detail(api, args.templateId);
  const rows = await listAll(api);
  const first = rows.find(r => r?.id);
  if (!first?.id) throw new Error("未找到可用于 clone 的竞猜任务模板（/prod-api/activity/guessTask/all 为空）；请先在后管创建至少一条竞猜任务，或直接指定 --template-id");
  return await detail(api, first.id);
}

function patchI18(payload, key, value) {
  const i18Key = `${key}I18`;
  if (Array.isArray(payload[i18Key])) payload[i18Key] = payload[i18Key].map(item => ({ ...item, name: value }));
}

function mutatePayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${ts}_${short}`.slice(0, 80);
  const tag = `${args.tagPrefix}${short}`.slice(0, 40);
  payload.name = name;
  payload.content = `竞猜任务描述_${ts}`.slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-GUESS竞猜任务(${ts})`).slice(0, 120);
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
  const plan = { mode: "headless_api", endpoint: "/prod-api/activity/guessTask", writes: { create: true }, templateId: args.templateId || null };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建竞猜任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await pickTemplate(api, args);
    const payload = stripCloneFields(template);
    const mutated = mutatePayload(payload, args);
    const created = await api.post("/prod-api/activity/guessTask", payload);
    if (created.body?.code !== 200) throw new Error(`Create guessTask failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);

    // Verify by list (best-effort)
    const list = await api.get(`/prod-api/activity/guessTask/list?pageNum=1&pageSize=1&name=${encodeURIComponent(mutated.name)}`).catch(() => null);
    const row = list?.body?.rows?.[0] || null;
    const id = row?.id || created.body?.data?.id || null;
    const finalId = id ? String(id) : null;

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: finalId, name: mutated.name, tag: mutated.tag },
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


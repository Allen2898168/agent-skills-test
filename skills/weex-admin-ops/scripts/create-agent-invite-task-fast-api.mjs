#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-agent-invite-task-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-agent-invite-task-fast-api.mjs --confirm-create

Options:
  --template-id <id>      optional; if omitted, auto-pick an AGENT(14) INVITE_FRIEND template
  --name-prefix <text>    default 人人代理_邀请
  --invited-name-prefix <text> default 人人代理_被邀请（当模板含 linkTaskId 时，会先创建被邀请任务）
  --tag-prefix <text>     default agiv
  --invited-tag-prefix <text> default agbe
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
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "人人代理_邀请";
  args.invitedNamePrefix = args.invitedNamePrefix ? String(args.invitedNamePrefix) : "人人代理_被邀请";
  args.tagPrefix = args.tagPrefix ? String(args.tagPrefix) : "agiv";
  args.invitedTagPrefix = args.invitedTagPrefix ? String(args.invitedTagPrefix) : "agbe";
  args.remark = args.remark ? String(args.remark) : "";
  return args;
}

async function taskList(api, { pageNum = 1, pageSize = 10, activityTypeCode = 14 } = {}) {
  const qs = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize), activityType: String(activityTypeCode) });
  return api.get(`/prod-api/activity/task/list?${qs.toString()}`);
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(String(id))}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

async function pickInviteTemplate(api, args) {
  if (args.templateId) return await taskDetail(api, args.templateId);
  const list = await taskList(api, { pageNum: 1, pageSize: 10, activityTypeCode: 14 });
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  for (const row of rows) {
    if (!row?.id) continue;
    const detail = await taskDetail(api, row.id).catch(() => null);
    const requirement0 = Array.isArray(detail?.requirement) ? detail.requirement[0] : null;
    if (requirement0?.type === "INVITE_FRIEND") return detail;
  }
  const first = firstRow(list);
  if (first?.id) return await taskDetail(api, first.id);
  throw new Error("未找到可用于 clone 的 AGENT(14) 任务模板；请先在后管创建至少一条人人代理活动任务，或直接指定 --template-id");
}

function mutateTaskPayload(payload, args) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${args.namePrefix}_${ts}_${short}`.slice(0, 48);
  const tag = `${args.tagPrefix}${short}`.slice(0, 30);
  payload.name = name;
  payload.content = String(payload.content || "邀请任务").slice(0, 120);
  payload.label = tag;
  payload.remark = (args.remark || `自动化-人人代理邀请任务_${short}`).slice(0, 120);

  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  if (Array.isArray(payload.contentI18)) payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: payload.content }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: tag }));
  return { name, tag };
}

async function createTaskFromTemplate(api, { templateDetail, args, kind, patchPayload }) {
  const payload = stripCloneFields(templateDetail);
  if (typeof patchPayload === "function") patchPayload(payload);
  const mutated = mutateTaskPayload(payload, {
    ...args,
    namePrefix: kind === "invited" ? args.invitedNamePrefix : args.namePrefix,
    tagPrefix: kind === "invited" ? args.invitedTagPrefix : args.tagPrefix,
  });

  const created = await api.post("/prod-api/activity/task", payload);
  if (created.body?.code !== 200) {
    throw new Error(
      `Create task failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`,
    );
  }

  const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(mutated.name)}&pageNum=1&pageSize=1`);
  const row = firstRow(verify);
  if (!row?.id) throw new Error(`Created task not found by name: ${mutated.name}`);
  const detail = await taskDetail(api, row.id);
  return { id: String(row.id), name: mutated.name, tag: mutated.tag, detail };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = {
    mode: "headless_api",
    templateId: args.templateId || null,
    writes: { create: true, mayCreateLinkedInvitedTask: true },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建活动任务。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const template = await pickInviteTemplate(api, args);
    const linkTaskId = template?.linkTaskId ? String(template.linkTaskId) : "";
    let createdLinked = null;
    let createdInvite = null;

    if (linkTaskId) {
      const linkedTemplate = await taskDetail(api, linkTaskId);
      createdLinked = await createTaskFromTemplate(api, { templateDetail: linkedTemplate, args, kind: "invited" });
    }

    createdInvite = await createTaskFromTemplate(api, {
      templateDetail: template,
      args,
      kind: "invite",
      patchPayload: payload => {
        if (createdLinked?.id) payload.linkTaskId = Number(createdLinked.id);
      },
    });

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/task`,
      created: { id: String(createdInvite.id), name: createdInvite.name, tag: createdInvite.tag },
      createdTaskDetail: createdInvite.detail,
      createdLinked: createdLinked ? { id: String(createdLinked.id), name: createdLinked.name, tag: createdLinked.tag } : null,
      createdLinkedTaskDetail: createdLinked ? createdLinked.detail : null,
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

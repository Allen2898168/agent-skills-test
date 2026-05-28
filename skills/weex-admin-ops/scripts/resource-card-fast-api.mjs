#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # list all cards for newbie activityType=1
  node skills/weex-admin-ops/scripts/resource-card-fast-api.mjs --action list-newbie

  # create 3 minimal newbie cards, verify, then (optional) delete
  node skills/weex-admin-ops/scripts/resource-card-fast-api.mjs --action create-min-newbie --confirm-create
  node skills/weex-admin-ops/scripts/resource-card-fast-api.mjs --action create-min-newbie --confirm-create --cleanup --confirm-cleanup

  # detail/delete by id
  node skills/weex-admin-ops/scripts/resource-card-fast-api.mjs --action detail --id 123
  node skills/weex-admin-ops/scripts/resource-card-fast-api.mjs --action delete --id 123 --confirm-cleanup

Options:
  --action <list-newbie|create-min-newbie|detail|delete>
  --id <id>
  --name-prefix <text>         default 资源卡_新手
  --count <n>                  default 3 (create-min-newbie only)
  --confirm-create
  --cleanup
  --confirm-cleanup
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create", "--cleanup", "--confirm-cleanup"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.cleanup = Boolean(args.cleanup);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  args.action = args.action ? String(args.action) : "";
  args.id = args.id ? String(args.id) : "";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "资源卡_新手";
  args.count = Math.max(1, Math.min(10, Number(args.count || 3)));
  return args;
}

async function listAll(api, activityType) {
  return api.get(`/prod-api/activity/resource/all?activityType=${encodeURIComponent(activityType)}`);
}

async function listPage(api, { pageNum = 1, pageSize = 20, activityType = "", name = "" } = {}) {
  const qs = new URLSearchParams();
  qs.set("pageNum", String(pageNum));
  qs.set("pageSize", String(pageSize));
  if (activityType !== "" && activityType !== null && activityType !== undefined) qs.set("activityType", String(activityType));
  if (name) qs.set("name", String(name));
  return api.get(`/prod-api/activity/resource/list?${qs.toString()}`);
}

async function findTemplateNewbieCard(api) {
  const res = await listAll(api, "BEGINNER_TASK");
  const rows = Array.isArray(res.body?.data) ? res.body.data : Array.isArray(res.body?.rows) ? res.body.rows : [];
  const row = rows.find(item => item?.id) || null;
  if (row?.id) return detail(api, row.id);

  // fallback：新手卡片可能尚未存在，用任意活动类型的资源卡片作为模板，以复用已满足后端必填校验的字段（imageUrl/webUrl 等）
  const any = await listPage(api, { pageNum: 1, pageSize: 1 });
  const anyRow = firstRow(any);
  if (!anyRow?.id) {
    throw new Error("未找到可用于 clone 的资源位卡片模板（全局也为空）；请先在后管创建至少一条资源位卡片。");
  }
  return detail(api, anyRow.id);
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/resource/${encodeURIComponent(id)}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Resource card detail failed: ${id}`);
  return res.body.data;
}

async function del(api, id) {
  const res = await api.delete(`/prod-api/activity/resource/${encodeURIComponent(id)}`);
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

function buildMinimalPayload({ name, activityType = "BEGINNER_TASK", template }) {
  // 对应 activity-web: activity-ui/src/views/activity/resource/index.vue 的 submitData
  // 该表单存在必填校验（webUrl/imageUrl 等）且后端也会校验；这里优先 clone 一条已存在的模板卡片来避免遗漏字段。
  const imageUrl = String(template?.imageUrl || "");
  const webUrl = String(template?.webUrl || "");
  if (!imageUrl) throw new Error("资源位卡片模板缺少 imageUrl，无法用于 clone");
  if (!webUrl) throw new Error("资源位卡片模板缺少 webUrl，无法用于 clone");
  return {
    activityType,
    name,
    title: name,
    subTitle: String(template?.subTitle || "自动化子标题"),
    subTitleI18n: Array.isArray(template?.subTitleI18n) ? template.subTitleI18n : [],
    buttonName: String(template?.buttonName || "立即查看"),
    buttonNameI18n: Array.isArray(template?.buttonNameI18n) ? template.buttonNameI18n : [],
    titleI18n: Array.isArray(template?.titleI18n) ? template.titleI18n : [],
    showIntroduction: Number(template?.showIntroduction || 0),
    ...(Number(template?.showIntroduction || 0) === 1
      ? {
          introduction: String(template?.introduction || ""),
          introductionI18n: Array.isArray(template?.introductionI18n) ? template.introductionI18n : [],
        }
      : {}),
    imageUrl,
    imageUrlI18n: Array.isArray(template?.imageUrlI18n) ? template.imageUrlI18n : [],
    webUrl,
    webUrlI18n: Array.isArray(template?.webUrlI18n) ? template.webUrlI18n : [],
    appUrl: template?.appUrl ?? null,
    status: Number(template?.status || 1),
  };
}

async function createMinNewbie(api, args) {
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建资源位信息卡片。");
  const template = await findTemplateNewbieCard(api);
  const created = [];
  for (let i = 0; i < args.count; i += 1) {
    const name = `${args.namePrefix}_${timestamp()}_${i + 1}`.slice(0, 60);
    const payload = buildMinimalPayload({ name, activityType: "BEGINNER_TASK", template });
    const res = await api.post("/prod-api/activity/resource", payload);
    if (res.body?.code !== 200) throw new Error(`Create resource card failed: ${JSON.stringify(res.body)}`);
    const createdId = res.body?.data?.id ?? res.body?.data ?? res.body?.id ?? "";
    let det = null;
    if (createdId) {
      det = await detail(api, createdId).catch(() => null);
    }
    if (!det) {
      // fallback：verify by list-page with name filter
      const list = await listPage(api, { pageNum: 1, pageSize: 5, activityType: "BEGINNER_TASK", name });
      const rows = Array.isArray(list.body?.rows) ? list.body.rows : Array.isArray(list.body?.data) ? list.body.data : [];
      const row = rows.find(item => String(item?.name || "") === name) || firstRow(list);
      if (!row?.id) throw new Error(`Created resource card not found in list: ${name}`);
      det = await detail(api, row.id);
    }
    created.push({ id: String(det.id), name: String(det.name || name), activityType: det.activityType ?? null, status: det.status ?? null });
  }
  return created;
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
    if (args.action === "list-newbie") {
      const res = await listAll(api, "BEGINNER_TASK");
      const rows = Array.isArray(res.body?.data) ? res.body.data : Array.isArray(res.body?.rows) ? res.body.rows : [];
      printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/resource`, total: rows.length, sample: rows.slice(0, 5), durationMs: Date.now() - startedAt });
      return 0;
    }

    if (args.action === "detail") {
      if (!args.id) throw new Error("--id is required for detail");
      const item = await detail(api, args.id);
      printJson({
        ok: true,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/resource`,
        id: String(args.id),
        summary: { id: item.id, name: item.name, activityType: item.activityType, status: item.status, title: item.title, subTitle: item.subTitle },
        durationMs: Date.now() - startedAt,
      });
      return 0;
    }

    if (args.action === "delete") {
      if (!args.id) throw new Error("--id is required for delete");
      if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除资源位信息卡片。");
      const result = await del(api, args.id);
      printJson({ ok: result.ok, mode: "headless_api", id: String(args.id), delete: result, durationMs: Date.now() - startedAt }, result.ok ? process.stdout : process.stderr);
      return result.ok ? 0 : 1;
    }

    if (args.action === "create-min-newbie") {
      const created = await createMinNewbie(api, args);
      const evidence = {
        ok: true,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/resource`,
        created,
      };
      if (!args.cleanup) {
        printJson({ ...evidence, cleanedUp: false, durationMs: Date.now() - startedAt });
        return 0;
      }
      if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除刚创建的资源位信息卡片。");
      const deletes = [];
      for (const item of created) deletes.push({ id: item.id, ...(await del(api, item.id)) });
      const ok = deletes.every(d => d.ok);
      printJson({ ...evidence, cleanedUp: ok, cleanup: { deleteCards: deletes }, durationMs: Date.now() - startedAt }, ok ? process.stdout : process.stderr);
      return ok ? 0 : 1;
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

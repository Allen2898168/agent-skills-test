#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # list
  node skills/weex-admin-ops/scripts/multilanguage-template-fast-api.mjs --action list

  # create a minimal "新手活动" template and verify, then (optional) delete
  node skills/weex-admin-ops/scripts/multilanguage-template-fast-api.mjs --action create-min-newbie --confirm-create
  node skills/weex-admin-ops/scripts/multilanguage-template-fast-api.mjs --action create-min-newbie --confirm-create --cleanup --confirm-cleanup

  # view detail
  node skills/weex-admin-ops/scripts/multilanguage-template-fast-api.mjs --action detail --id 123

Options:
  --action <list|detail|create-min-newbie|delete>
  --id <id>                       used by detail/delete
  --name-prefix <text>            default 多语言模板_新手
  --confirm-create                required for create
  --cleanup                       delete the created template (create-min-newbie only)
  --confirm-cleanup               required for delete in cleanup
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
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "多语言模板_新手";
  return args;
}

async function listTemplates(api, pageNum = 1, pageSize = 20) {
  return api.get(`/prod-api/activity/multiLanguageTemplate/list?pageNum=${encodeURIComponent(pageNum)}&pageSize=${encodeURIComponent(pageSize)}`);
}

async function detailTemplate(api, id) {
  const res = await api.get(`/prod-api/activity/multiLanguageTemplate/${encodeURIComponent(id)}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Template detail failed: ${id}`);
  return res.body.data;
}

async function deleteTemplate(api, id) {
  const del = await api.delete(`/prod-api/activity/multiLanguageTemplate/${encodeURIComponent(id)}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

function buildMinimalNewbieTemplatePayload(name) {
  // UI 侧 Create.vue: params = { items: [{key, contents}], templateName, templateType }
  // templateType: 1 = 新手活动
  return {
    templateName: name,
    templateType: 1,
    items: [
      { key: "shareContent", contents: { zh_CN: "自动化分享文案", en: "Automated share content" } },
      { key: "agentShareContent", contents: { zh_CN: "自动化代理分享文案", en: "Automated agent share content" } },
      // 图片字段允许为空；这里放最小可复用占位，避免部分后端校验空对象
      { key: "webShareUrl", contents: { zh_CN: "", en: "" } },
      { key: "appShareUrl", contents: { zh_CN: "", en: "" } },
      { key: "intro", contents: { zh_CN: "自动化规则", en: "Automated rules" } },
      // questions 的 contents 结构：{ langKey: [ {title, content} ] }
      { key: "questions", contents: { zh_CN: [{ title: "常见问题", content: "自动化FAQ内容" }] } },
    ],
  };
}

async function createMinimalNewbie(api, args) {
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建多语言模板。");
  const name = `${args.namePrefix}_${timestamp()}`.slice(0, 60);
  const payload = buildMinimalNewbieTemplatePayload(name);
  const created = await api.post("/prod-api/activity/multiLanguageTemplate", payload);
  if (created.body?.code !== 200) throw new Error(`Create template failed: ${JSON.stringify(created.body)}`);

  const list = await listTemplates(api, 1, 50);
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  const row = rows.find(item => String(item?.templateName || "") === name) || firstRow(list);
  const id = row?.id;
  if (!id) throw new Error(`Created template not found in list: ${name}`);

  const detail = await detailTemplate(api, id);
  return { id: String(id), templateName: String(detail.templateName || name), templateType: detail.templateType ?? null, itemsCount: Array.isArray(detail.items) ? detail.items.length : null };
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
      const res = await listTemplates(api, 1, 20);
      const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
      printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/commonModule/multiLangConfig`, total: res.body?.total ?? null, sample: rows.slice(0, 5), durationMs: Date.now() - startedAt });
      return 0;
    }

    if (args.action === "detail") {
      if (!args.id) throw new Error("--id is required for detail");
      const detail = await detailTemplate(api, args.id);
      printJson({
        ok: true,
        mode: "headless_api",
        id: String(args.id),
        templateName: detail.templateName || "",
        templateType: detail.templateType ?? null,
        items: Array.isArray(detail.items)
          ? detail.items.map(item => ({ key: item?.key || "", contentsKeys: item?.contents && typeof item.contents === "object" ? Object.keys(item.contents).sort() : [] }))
          : [],
        durationMs: Date.now() - startedAt,
      });
      return 0;
    }

    if (args.action === "delete") {
      if (!args.id) throw new Error("--id is required for delete");
      if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除多语言模板。");
      const del = await deleteTemplate(api, args.id);
      printJson({ ok: del.ok, mode: "headless_api", id: String(args.id), delete: del, durationMs: Date.now() - startedAt }, del.ok ? process.stdout : process.stderr);
      return del.ok ? 0 : 1;
    }

    if (args.action === "create-min-newbie") {
      const created = await createMinimalNewbie(api, args);
      const evidence = {
        ok: true,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/commonModule/multiLangConfig`,
        created,
      };
      if (!args.cleanup) {
        printJson({ ...evidence, cleanedUp: false, durationMs: Date.now() - startedAt });
        return 0;
      }
      if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除刚创建的多语言模板。");
      const del = await deleteTemplate(api, created.id);
      printJson({ ...evidence, cleanedUp: true, cleanup: { deleteTemplate: del }, durationMs: Date.now() - startedAt }, del.ok ? process.stdout : process.stderr);
      return del.ok ? 0 : 1;
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


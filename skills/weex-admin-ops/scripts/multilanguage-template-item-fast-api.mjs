#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # list items by templateId
  node skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs --action list --template-id 123

  # upsert a single item (create or edit) and verify in list
  node skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs --action upsert --confirm --spec-json '{"confirm":true,"confirmations":{"itemWrites":true},"item":{"templateId":123,"key":"title_channel_test","contents":{"zh_CN":"渠道标题","en":"Channel title"}}}'

  # bulk upload grouped items to the template (editTemplate)
  node skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs --action edit-template --confirm --spec-file ./tmp/title-channel-items.json

  # copy/delete by item id
  node skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs --action copy --id 999 --confirm
  node skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs --action delete --id 999 --confirm

  # print one-shot spec templates
  node skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs --wizard

Options:
  --action <list|upsert|edit-template|copy|delete>
  --template-id <id>              required for list
  --key <text>                    optional filter for list
  --page <n>                      list page, default 1
  --page-size <n>                 list page size, default 20
  --id <id>                       required for copy/delete
  --spec-file <path>              JSON spec file for upsert/edit-template
  --spec-json <json>              JSON spec string for upsert/edit-template
  --confirm                        required for write actions
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--wizard", "--confirm"] });
  return {
    help: Boolean(args.help),
    dryRun: Boolean(args.dryRun),
    wizard: Boolean(args.wizard),
    confirm: Boolean(args.confirm),
    action: args.action ? String(args.action) : "",
    templateId: args.templateId ? String(args.templateId) : "",
    key: args.key ? String(args.key) : "",
    id: args.id ? String(args.id) : "",
    page: args.page ? Number(args.page) : 1,
    pageSize: args.pageSize ? Number(args.pageSize) : 20,
    specFile: args.specFile ? String(args.specFile) : "",
    specJson: args.specJson ? String(args.specJson) : "",
  };
}

function readSpec(args) {
  if (args.specJson) return JSON.parse(args.specJson);
  if (!args.specFile) return null;
  const abs = path.isAbsolute(args.specFile) ? args.specFile : path.join(repoRoot, args.specFile);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function requireConfirmations(spec, args) {
  const confirm = Boolean(spec?.confirm ?? args.confirm);
  if (!confirm) throw new Error("需要用户确认：请在 spec 里设置 confirm=true 并传 --confirm。");
  const confirmations = spec?.confirmations || {};
  if (confirmations.itemWrites !== true) throw new Error("高风险确认未完成：confirmations.itemWrites 需要为 true。");
}

function wizardSpec() {
  const nowKey = `title_channel_${timestamp()}`;
  return {
    upsert: {
      confirm: true,
      confirmations: { itemWrites: true },
      item: {
        templateId: 123,
        key: nowKey,
        contents: { zh_CN: "渠道标题(简体中文)", en: "Channel title (EN)" },
      },
    },
    editTemplate: {
      confirm: true,
      confirmations: { itemWrites: true },
      templateId: 123,
      items: [
        { key: nowKey, contents: { zh_CN: "渠道标题(简体中文)", en: "Channel title (EN)" } },
        { key: `title_invite_${timestamp()}`, contents: { zh_CN: "邀请码标题", en: "Invite title" } },
      ],
    },
  };
}

async function listItems(api, args) {
  if (!args.templateId) throw new Error("--template-id is required for list");
  const params = new URLSearchParams();
  params.set("pageNum", String(args.page || 1));
  params.set("pageSize", String(args.pageSize || 20));
  params.set("templateId", String(args.templateId));
  if (args.key) params.set("key", String(args.key));
  const res = await api.get(`/prod-api/activity/multiLanguageTemplateItem/list?${params.toString()}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return { total: res.body?.total ?? null, rows };
}

async function upsertItem(api, item) {
  const payload = {
    templateId: item.templateId,
    key: item.key,
    contents: item.contents || {},
  };
  if (item.id) payload.id = item.id;
  const res = await api.post("/prod-api/activity/multiLanguageTemplateItem", payload);
  if (res.body?.code !== 200) throw new Error(`Upsert title-channel item failed: ${JSON.stringify(res.body)}`);
  return { ok: true, code: res.body?.code ?? null, msg: res.body?.msg || "" };
}

async function editTemplate(api, templateId, items) {
  const payload = {
    id: templateId,
    items: Array.isArray(items) ? items : [],
  };
  const res = await api.put("/prod-api/activity/multiLanguageTemplateItem/editTemplate", payload);
  if (res.body?.code !== 200) throw new Error(`Edit template items failed: ${JSON.stringify(res.body)}`);
  return { ok: true, code: res.body?.code ?? null, msg: res.body?.msg || "" };
}

async function copyItem(api, id) {
  const res = await api.post("/prod-api/activity/multiLanguageTemplateItem/copy", { id: Number(id) });
  if (res.body?.code !== 200) throw new Error(`Copy title-channel item failed: ${JSON.stringify(res.body)}`);
  return { ok: true, code: res.body?.code ?? null, msg: res.body?.msg || "" };
}

async function deleteItem(api, id) {
  const res = await api.delete(`/prod-api/activity/multiLanguageTemplateItem/${encodeURIComponent(id)}`);
  return { ok: res.body?.code === 200, status: res.status, body: { code: res.body?.code ?? null, msg: res.body?.msg || "" } };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.wizard) {
    printJson({ ok: true, mode: "headless_api", wizard: true, specTemplates: wizardSpec() });
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
      const list = await listItems(api, args);
      printJson({
        ok: true,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/commonModule/multiLangConfig/editForTitleChannelCode`,
        templateId: Number(args.templateId),
        total: list.total,
        sample: list.rows.slice(0, 5),
        durationMs: Date.now() - startedAt,
      });
      return 0;
    }

    if (args.action === "upsert") {
      const spec = readSpec(args);
      requireConfirmations(spec, args);
      const item = spec?.item;
      if (!item?.templateId) throw new Error("spec.item.templateId is required");
      if (!item?.key) throw new Error("spec.item.key is required");
      if (!item?.contents || typeof item.contents !== "object") throw new Error("spec.item.contents must be an object");
      await upsertItem(api, item);
      const list = await listItems(api, { ...args, templateId: String(item.templateId), key: String(item.key), page: 1, pageSize: 50 });
      const found = list.rows.find(row => String(row?.key || "") === String(item.key));
      printJson({
        ok: Boolean(found),
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/commonModule/multiLangConfig/editForTitleChannelCode`,
        upsertedKey: String(item.key),
        evidence: found ? { id: found.id ?? null, templateId: found.templateId ?? null, key: found.key ?? "", contentsKeys: found.contents ? Object.keys(found.contents) : [] } : null,
        durationMs: Date.now() - startedAt,
      }, found ? process.stdout : process.stderr);
      return found ? 0 : 1;
    }

    if (args.action === "edit-template") {
      const spec = readSpec(args);
      requireConfirmations(spec, args);
      const templateId = spec?.templateId;
      const items = spec?.items;
      if (!templateId) throw new Error("spec.templateId is required");
      if (!Array.isArray(items) || !items.length) throw new Error("spec.items must be a non-empty array");
      await editTemplate(api, Number(templateId), items);
      const list = await listItems(api, { ...args, templateId: String(templateId), page: 1, pageSize: 50 });
      const keys = new Set(items.map(v => String(v?.key || "")).filter(Boolean));
      const matched = list.rows.filter(row => keys.has(String(row?.key || "")));
      printJson({
        ok: matched.length === keys.size,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/commonModule/multiLangConfig/editForTitleChannelCode`,
        templateId: Number(templateId),
        keys: Array.from(keys).sort(),
        matched: matched.map(row => ({ id: row?.id ?? null, key: row?.key ?? "" })),
        durationMs: Date.now() - startedAt,
      }, matched.length === keys.size ? process.stdout : process.stderr);
      return matched.length === keys.size ? 0 : 1;
    }

    if (args.action === "copy") {
      if (!args.id) throw new Error("--id is required for copy");
      if (!args.confirm) throw new Error("需要用户确认：copy 请传 --confirm。");
      const copy = await copyItem(api, args.id);
      printJson({ ok: true, mode: "headless_api", id: Number(args.id), copy, durationMs: Date.now() - startedAt });
      return 0;
    }

    if (args.action === "delete") {
      if (!args.id) throw new Error("--id is required for delete");
      if (!args.confirm) throw new Error("需要用户确认：delete 请传 --confirm。");
      const del = await deleteItem(api, args.id);
      printJson({ ok: del.ok, mode: "headless_api", id: Number(args.id), delete: del, durationMs: Date.now() - startedAt }, del.ok ? process.stdout : process.stderr);
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


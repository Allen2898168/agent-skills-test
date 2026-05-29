#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # snapshot current config (read-only)
  node skills/weex-admin-ops/scripts/contract-mining-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/contract-mining-activity-module-config-fast-api.mjs --action snapshot --activity-id <id>

  # update modules by spec (writes)
  node skills/weex-admin-ops/scripts/contract-mining-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/contract-mining-modules.json --confirm

Spec (example):
  {
    "confirm": true,
    "confirmations": { "moduleWrites": true },
    "modules": {
      "base": { "title": "...", "subTitle": "...", "showUrl": "...", "startTime": "YYYY-MM-DD HH:mm:ss", "endTime": "...", "applyConfigId": 2442 },
      "applyTemplate": { "applyConfigId": 2442 },
      "channelConfigs": { "miningList": [ { "channelType": "OFFICIAL_WEBSITE", "taskConfig": [ { "id": 123 } ], "showPoolFlag": "NO", "showWeLaunchFlag": "NO", "showBuybackNoticeFlag": "NO", "showAgentTaskFlag": "NO" } ] },
      "rules": { "intro": "..." },
      "calendar": { "syncCalendarFlag": 0, "syncCalendarDto": { } }
    },
    "rawTopLevel": { "anyOtherKey": "value" }
  }

Options:
  --action <snapshot|update>
  --activity-alias <showUrl>
  --activity-id <id>
  --wizard
  --spec-file <path>
  --spec-json <json>
  --confirm
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm", "--wizard"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirm = Boolean(args.confirm);
  args.wizard = Boolean(args.wizard);
  args.action = args.action ? String(args.action) : "";
  args.activityAlias = args.activityAlias ? String(args.activityAlias) : "";
  args.activityId = args.activityId ? String(args.activityId) : "";
  args.specFile = args.specFile ? String(args.specFile) : "";
  args.specJson = args.specJson ? String(args.specJson) : "";
  return args;
}

function loadSpec(args) {
  const fromJson = () => (args.specJson ? JSON.parse(args.specJson) : null);
  const fromFile = () => {
    if (!args.specFile) return null;
    const abs = path.isAbsolute(args.specFile) ? args.specFile : path.join(repoRoot, args.specFile);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  };
  return fromJson() || fromFile();
}

function requireConfirmations(spec, args) {
  const confirm = Boolean(spec?.confirm ?? args.confirm);
  if (!confirm) throw new Error("需要用户确认：请在 spec 里设置 confirm=true 并传 --confirm。");
  const confirmations = spec?.confirmations || {};
  if (confirmations.moduleWrites !== true) throw new Error("高风险确认未完成：confirmations.moduleWrites 需要为 true。");
}

function parseMarkdownTableToMap(md, keyColumnName, valueColumnName) {
  const lines = String(md || "").split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.includes(`| ${keyColumnName} |`) && line.includes(`| ${valueColumnName} |`));
  if (headerIndex < 0) return {};
  const out = {};
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const parts = line.split("|").map(v => v.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const key = parts[0].replace(/`/g, "");
    const value = parts[1];
    if (key && value) out[key] = value;
  }
  return out;
}

function loadMarkdownMap(refRelPath, keyColumnName, valueColumnName) {
  const refPath = path.join(repoRoot, refRelPath);
  if (!fs.existsSync(refPath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(refPath, "utf8");
  return { source: refRelPath, map: parseMarkdownTableToMap(md, keyColumnName, valueColumnName) };
}

function loadModuleNameMap() {
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/contract-mining-activity-modules.md", "模块 key", "前端中文名");
}

function loadFieldNameMap() {
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/contract-mining-activity-fields.md", "字段 key", "前端中文名");
}

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=CONTRACT_MINING&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/config/${encodeURIComponent(String(id))}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return res.body.data;
}

async function resolveTarget(api, args) {
  if (args.activityId) {
    const item = await detail(api, args.activityId);
    return { id: String(args.activityId), alias: String(item.showUrl || "") };
  }
  if (!args.activityAlias) throw new Error("--activity-alias or --activity-id is required");
  const row = await findByAlias(api, args.activityAlias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Activity not found by alias: ${args.activityAlias}`);
  return { id: String(id), alias: String(args.activityAlias) };
}

function summarize(item) {
  const d = item || {};
  return {
    id: d.activityId || d.id || null,
    activityId: d.activityId || d.id || null,
    type: d.type || null,
    title: d.title || null,
    showUrl: d.showUrl || null,
    status: d.status ?? null,
    stage: d.stage ?? null,
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    applyConfigId: d.applyConfigId ?? null,
    miningListCount: Array.isArray(d.miningList) ? d.miningList.length : null,
    showActivityCalendar: d.showActivityCalendar ?? null,
    syncCalendarFlag: d.syncCalendarFlag ?? null,
  };
}

function shallowClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function assignIfPresent(target, source, key) {
  if (!source || typeof source !== "object") return;
  if (!(key in source)) return;
  target[key] = source[key];
}

function patchIntroI18n(patched, rulesModule) {
  const intro = rulesModule?.intro;
  const introI18 = rulesModule?.introI18;
  if (!intro && (!introI18 || typeof introI18 !== "object")) return;
  const ensureArray = () => {
    if (Array.isArray(patched.activityConfigI18n) && patched.activityConfigI18n.length) return;
    patched.activityConfigI18n = [{ lang: "zh_CN", title: patched.title || "", subTitle: patched.subTitle || "", intro: patched.intro || "" }];
  };
  ensureArray();

  if (typeof intro === "string") {
    patched.intro = intro;
    patched.activityConfigI18n = patched.activityConfigI18n.map(item => (item.lang === "zh_CN" ? { ...item, intro } : item));
  }
  if (introI18 && typeof introI18 === "object") {
    const map = introI18;
    patched.activityConfigI18n = patched.activityConfigI18n.map(item => {
      const lang = item.lang;
      if (!lang) return item;
      if (!(lang in map)) return item;
      return { ...item, intro: String(map[lang] ?? "") };
    });
  }
}

function applyModulesToDetail(current, spec) {
  const patched = shallowClone(current);
  const modules = spec?.modules && typeof spec.modules === "object" ? spec.modules : {};

  if (modules.base && typeof modules.base === "object") {
    for (const key of [
      "configType",
      "activityOwner",
      "channelCategory",
      "guideTemplateId",
      "title",
      "subTitle",
      "showUrl",
      "startTime",
      "endTime",
      "shareContent",
      "agentShareContent",
      "applyConfigId",
      "showActivityCalendar",
      "activityConfigI18n",
    ]) {
      assignIfPresent(patched, modules.base, key);
    }
  }

  if (modules.applyTemplate && typeof modules.applyTemplate === "object") {
    assignIfPresent(patched, modules.applyTemplate, "applyConfigId");
  }

  if (modules.channelConfigs && typeof modules.channelConfigs === "object") {
    if (Array.isArray(modules.channelConfigs.miningList)) patched.miningList = modules.channelConfigs.miningList;
  }

  if (modules.rules && typeof modules.rules === "object") {
    assignIfPresent(patched, modules.rules, "intro");
    patchIntroI18n(patched, modules.rules);
  }

  if (modules.calendar && typeof modules.calendar === "object") {
    for (const key of ["syncCalendarFlag", "syncCalendarDto", "imageUrlI18n", "iconUrlI18n"]) {
      assignIfPresent(patched, modules.calendar, key);
    }
  }

  if (spec && typeof spec === "object" && spec.rawTopLevel && typeof spec.rawTopLevel === "object") {
    for (const [key, value] of Object.entries(spec.rawTopLevel)) {
      patched[key] = value;
    }
  }

  return patched;
}

function buildWizardTemplate() {
  return {
    specVersion: 1,
    confirm: false,
    confirmations: { moduleWrites: false },
    modules: {
      base: { title: "", subTitle: "", showUrl: "", startTime: "", endTime: "", channelCategory: "", applyConfigId: 0 },
      applyTemplate: { applyConfigId: 0 },
      channelConfigs: { miningList: [] },
      rules: { intro: "" },
      calendar: { syncCalendarFlag: 0, syncCalendarDto: {} },
    },
    rawTopLevel: {},
  };
}

async function snapshot(api, args, config) {
  const moduleNameMap = loadModuleNameMap();
  const fieldNameMap = loadFieldNameMap();
  const target = await resolveTarget(api, args);
  const item = await detail(api, target.id);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/contractMining/index`,
    target: { activityId: target.id, activityAlias: target.alias || item.showUrl || "" },
    moduleNameMap: moduleNameMap.map,
    moduleNameMapSource: moduleNameMap.source,
    fieldNameMap: fieldNameMap.map,
    fieldNameMapSource: fieldNameMap.source,
    summary: summarize(item),
    oneShotSpecTemplate: buildWizardTemplate(),
    current: {
      base: {
        configType: item.configType ?? null,
        activityOwner: item.activityOwner ?? "",
        channelCategory: item.channelCategory ?? null,
        guideTemplateId: item.guideTemplateId ?? null,
        title: item.title ?? "",
        subTitle: item.subTitle ?? "",
        showUrl: item.showUrl ?? "",
        startTime: item.startTime ?? "",
        endTime: item.endTime ?? "",
        shareContent: item.shareContent ?? "",
        agentShareContent: item.agentShareContent ?? "",
        applyConfigId: item.applyConfigId ?? null,
        showActivityCalendar: item.showActivityCalendar ?? null,
      },
      applyTemplate: { applyConfigId: item.applyConfigId ?? null },
      channelConfigs: { miningList: Array.isArray(item.miningList) ? item.miningList : [] },
      rules: { intro: item.intro ?? "" },
      calendar: { syncCalendarFlag: item.syncCalendarFlag ?? null, syncCalendarDto: item.syncCalendarDto ?? null },
    },
  };
}

async function update(api, args, config) {
  const spec = loadSpec(args);
  if (!spec) throw new Error("spec is required: provide --spec-file or --spec-json");
  requireConfirmations(spec, args);

  const target = await resolveTarget(api, args);
  const before = await detail(api, target.id);
  const patched = applyModulesToDetail(before, spec);

  const plan = {
    action: "update",
    type: "CONTRACT_MINING",
    target: { activityId: target.id, activityAlias: target.alias || before.showUrl || "" },
    writes: { putActivityConfig: true },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan, before: summarize(before), after: summarize(patched) });
    return;
  }

  assertAdminLoginConfig(config);
  const put = await api.put("/prod-api/activity/config", patched);
  if (put.body?.code !== 200) throw new Error(`Update activity failed: ${JSON.stringify({ code: put.body?.code, msg: put.body?.msg || put.body?.message })}`);

  const after = await detail(api, target.id);
  printJson({
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/contractMining/edit?activityId=${encodeURIComponent(target.id)}&type=edit`,
    plan,
    before: summarize(before),
    after: summarize(after),
    updateBody: { code: put.body?.code ?? null, msg: put.body?.msg || "" },
  });
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (!args.action) throw new Error("--action is required");
  if (!["snapshot", "update"].includes(args.action)) throw new Error(`Unknown --action: ${args.action}`);

  if (args.wizard) {
    printJson({
      ok: true,
      mode: "headless_api",
      domain: "活动列表 / 合约挖矿活动(CONTRACT_MINING) 模块级配置（API）",
      moduleNameMap: loadModuleNameMap().map,
      fieldNameMap: loadFieldNameMap().map,
      oneShotSpecTemplate: buildWizardTemplate(),
      notes: [
        "snapshot：输出当前配置（按模块拆分）+ 一次性 spec 模板。",
        "update：需在 spec.confirm=true 且 confirmations.moduleWrites=true 后才允许写入。",
        "复杂字段建议直接写 modules.channelConfigs.miningList（整段覆盖），避免局部 patch 误配。",
      ],
    });
    return 0;
  }

  if (args.dryRun && args.action === "update") {
    const spec = loadSpec(args);
    const plan = { action: "update", hasSpec: Boolean(spec), writes: false };
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    if (args.action === "snapshot") {
      printJson(await snapshot(api, args, config));
      return 0;
    }
    if (args.action === "update") {
      await update(api, args, config);
      return 0;
    }
    throw new Error(`Unknown --action: ${args.action}`);
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


#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

const LIST_TYPE = "TRACE_PRO";
const CHANNEL_CATEGORY_AGENT = "AGENT";

function usage() {
  return `Usage:
  # snapshot current config (read-only)
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-module-config-fast-api.mjs --action snapshot --activity-id <id>

  # update modules by spec (writes)
  node skills/weex-admin-ops/scripts/agent-tracepro-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/agent-tracepro-modules.json --confirm

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

function loadMarkdownMap(fileRelPath, keyColumnName, valueColumnName, sourceRelPath = fileRelPath) {
  const refPath = path.join(repoRoot, fileRelPath);
  if (!fs.existsSync(refPath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(refPath, "utf8");
  return { source: sourceRelPath, map: parseMarkdownTableToMap(md, keyColumnName, valueColumnName) };
}

function loadModuleNameMap() {
  return loadMarkdownMap(
    "skills/weex-admin-ops/references/mappings/agent-tracepro-activity-modules.md",
    "模块 key",
    "前端中文名",
    "references/mappings/agent-tracepro-activity-modules.md",
  );
}

function loadFieldNameMap() {
  return loadMarkdownMap(
    "skills/weex-admin-ops/references/mappings/agent-tracepro-activity-fields.md",
    "字段 key",
    "前端中文名",
    "references/mappings/agent-tracepro-activity-fields.md",
  );
}

async function findByAlias(api, alias) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", type: LIST_TYPE, showUrl: String(alias), channelCategory: CHANNEL_CATEGORY_AGENT });
  const list = await api.get(`/prod-api/activity/config/list?${qs.toString()}`);
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
  const miniActivityCount = Array.isArray(d.miniActivity) ? d.miniActivity.length : null;
  const resourceConfigCount = Array.isArray(d.resourceConfig) ? d.resourceConfig.length : null;
  return {
    id: d.activityId || d.id || null,
    activityId: d.activityId || d.id || null,
    type: d.type || null,
    title: d.title || null,
    showUrl: d.showUrl || null,
    status: d.status ?? null,
    stage: d.stage ?? null,
    channelCategory: d.channelCategory ?? null,
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    applyConfigId: d.applyConfigId ?? null,
    miniActivityCount,
    resourceConfigCount,
    questionsCount: Array.isArray(d.questions) ? d.questions.length : null,
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

function applyModulesToDetail(current, spec) {
  const patched = shallowClone(current);
  const modules = spec?.modules && typeof spec.modules === "object" ? spec.modules : {};

  if (modules.base && typeof modules.base === "object") {
    for (const key of [
      "title",
      "subTitle",
      "showUrl",
      "startTime",
      "endTime",
      "configType",
      "activityOwner",
      "channelCategory",
      "applicationMode",
      "guideTemplateId",
      "visible",
    ]) {
      assignIfPresent(patched, modules.base, key);
    }
  }

  if (modules.material && typeof modules.material === "object") {
    for (const key of [
      "webBannerUrl",
      "appBannerUrl",
      "webShareUrl",
      "appShareUrl",
      "shareContent",
      "agentShareContent",
      "webMp4Files",
      "appMp4Files",
      "ogImageUrl",
      "materialInfoList",
    ]) {
      assignIfPresent(patched, modules.material, key);
    }
  }

  if (modules.registration && typeof modules.registration === "object") {
    for (const key of ["applyConfigId", "isPreApply", "preApplyConfigId", "preApplyStartTime", "preApplyEndTime"]) {
      assignIfPresent(patched, modules.registration, key);
    }
  }

  if (modules.subActivities && typeof modules.subActivities === "object") {
    if (Array.isArray(modules.subActivities.miniActivity)) patched.miniActivity = modules.subActivities.miniActivity;
  }

  if (modules.tradingPairInfo && typeof modules.tradingPairInfo === "object") {
    for (const key of ["coinSort", "tradeSymbolInfo", "tradeSpotInfo"]) {
      assignIfPresent(patched, modules.tradingPairInfo, key);
    }
  }

  if (modules.resourceCard && typeof modules.resourceCard === "object") {
    for (const key of ["resourceConfig", "showResource", "showResourceModel", "resourceModel"]) {
      assignIfPresent(patched, modules.resourceCard, key);
    }
  }

  if (modules.rules && typeof modules.rules === "object") {
    for (const key of ["introTitle", "introContent", "projectName", "projectRule", "rules", "activityIntro", "activityTags"]) {
      assignIfPresent(patched, modules.rules, key);
    }
  }

  if (modules.faq && typeof modules.faq === "object") {
    if (Array.isArray(modules.faq.questions)) patched.questions = modules.faq.questions;
    if ("questionsI18n" in modules.faq) patched.questionsI18n = modules.faq.questionsI18n;
  }

  if (modules.calendar && typeof modules.calendar === "object") {
    for (const key of ["syncCalendarFlag", "syncCalendarDto", "imageUrlI18n", "iconUrlI18n"]) {
      assignIfPresent(patched, modules.calendar, key);
    }
  }

  if (modules.entry && typeof modules.entry === "object") assignIfPresent(patched, modules.entry, "portalInfo");
  if (modules.activityData && typeof modules.activityData === "object") assignIfPresent(patched, modules.activityData, "activityData");
  if (modules.userData && typeof modules.userData === "object") assignIfPresent(patched, modules.userData, "userData");

  if (spec?.rawTopLevel && typeof spec.rawTopLevel === "object") {
    for (const [k, v] of Object.entries(spec.rawTopLevel)) patched[k] = v;
  }

  return patched;
}

function buildWizardTemplate({ moduleNameMap, moduleNameMapSource, fieldNameMap, fieldNameMapSource }) {
  return {
    ok: true,
    mode: "headless_api",
    wizard: true,
    moduleNameMap,
    moduleNameMapSource,
    fieldNameMap,
    fieldNameMapSource,
    oneShotSpecTemplate: {
      confirm: false,
      confirmations: { moduleWrites: false },
      modules: { base: { channelCategory: CHANNEL_CATEGORY_AGENT } },
      rawTopLevel: {},
    },
    notes: [
      "代理小活动与 TRACE_PRO 共用 /activities/copyTrading；本模块脚本默认按 channelCategory=AGENT 查找活动。",
      "未覆盖字段可临时放到 rawTopLevel；跑通后再补齐映射与模块写入逻辑。",
    ],
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.action && !args.wizard) throw new Error("--action is required unless --wizard is used");

  const moduleNameMap = loadModuleNameMap();
  const fieldNameMap = loadFieldNameMap();
  if (args.wizard) {
    printJson(
      buildWizardTemplate({
        moduleNameMap: moduleNameMap.map,
        moduleNameMapSource: moduleNameMap.source,
        fieldNameMap: fieldNameMap.map,
        fieldNameMapSource: fieldNameMap.source,
      }),
    );
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan: { action: args.action, activityAlias: args.activityAlias || null, activityId: args.activityId || null, hasSpec: Boolean(args.specFile || args.specJson) } });
    return 0;
  }

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const target = await resolveTarget(api, args);
    if (args.action === "snapshot") {
      const current = await detail(api, target.id);
      printJson({
        ok: true,
        mode: "headless_api",
        finalUrl: "/activities/copyTrading",
        target: { activityId: target.id, activityAlias: target.alias, channelCategory: CHANNEL_CATEGORY_AGENT },
        moduleNameMap: moduleNameMap.map,
        moduleNameMapSource: moduleNameMap.source,
        fieldNameMap: fieldNameMap.map,
        fieldNameMapSource: fieldNameMap.source,
        summary: summarize(current),
        oneShotSpecTemplate: buildWizardTemplate({
          moduleNameMap: moduleNameMap.map,
          moduleNameMapSource: moduleNameMap.source,
          fieldNameMap: fieldNameMap.map,
          fieldNameMapSource: fieldNameMap.source,
        }).oneShotSpecTemplate,
      });
      return 0;
    }

    if (args.action === "update") {
      const spec = loadSpec(args);
      requireConfirmations(spec, args);
      assertAdminLoginConfig(config);
      const current = await detail(api, target.id);
      const patched = applyModulesToDetail(current, spec);
      const res = await api.put("/prod-api/activity/config", patched);
      if (res.body?.code !== 200) throw new Error(`Update activity failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
      const verify = await detail(api, target.id);
      printJson({
        ok: true,
        mode: "headless_api",
        finalUrl: "/activities/copyTrading",
        target: { activityId: target.id, activityAlias: target.alias, channelCategory: CHANNEL_CATEGORY_AGENT },
        updateBody: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
        verify: summarize(verify),
      });
      return 0;
    }

    throw new Error(`Unknown --action: ${String(args.action)}`);
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

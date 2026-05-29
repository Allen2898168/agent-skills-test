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
  node skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs --action snapshot --activity-id <id>

  # update modules by spec (writes)
  node skills/weex-admin-ops/scripts/guess-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/guess-modules.json --confirm

Spec (example):
  {
    "confirm": true,
    "confirmations": { "moduleWrites": true },
    "modules": {
      "base": { "title": "...", "subTitle": "...", "showUrl": "...", "startTime": "YYYY-MM-DD HH:mm:ss", "endTime": "...", "applyConfigId": 2442 },
      "guessConfigs": { "guessList": [ { "channelType": "OFFICIAL_WEBSITE", "taskConfig": [], "guessPeriod": [], "guessTicket": [], "prizeConfig": { "showFlag": "NO", "prize": [] } } ] },
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
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/guess-activity-modules.md", "模块 key", "前端中文名");
}

function loadFieldNameMap() {
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/guess-activity-fields.md", "字段 key", "前端中文名");
}

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=GUESS&showUrl=${encodeURIComponent(alias)}`);
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
  const guessList = Array.isArray(d.guessList) ? d.guessList : (Array.isArray(d.guessConfigList) ? d.guessConfigList : []);
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
    guessListCount: guessList.length,
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
      "isPreApply",
      "preApplyStartTime",
      "preApplyEndTime",
      "periods",
      "guessActivityType",
      "applyConfigId",
      "showActivityCalendar",
    ]) {
      assignIfPresent(patched, modules.base, key);
    }
  }

  if (modules.guessConfigs && typeof modules.guessConfigs === "object") {
    if (Array.isArray(modules.guessConfigs.guessList)) patched.guessList = modules.guessConfigs.guessList;
  }

  if (modules.pageSetting && typeof modules.pageSetting === "object") {
    for (const key of ["ogImageUrl"]) {
      assignIfPresent(patched, modules.pageSetting, key);
    }
  }

  if (modules.i18n && typeof modules.i18n === "object") {
    if (Array.isArray(modules.i18n.activityConfigI18n)) patched.activityConfigI18n = modules.i18n.activityConfigI18n;
  }

  if (modules.faq && typeof modules.faq === "object") {
    if (Array.isArray(modules.faq.questions)) patched.questions = modules.faq.questions;
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
      base: { title: "", subTitle: "", showUrl: "", startTime: "", endTime: "", applyConfigId: 0 },
      guessConfigs: { guessList: [] },
      pageSetting: { ogImageUrl: "" },
      i18n: { activityConfigI18n: [] },
      faq: { questions: [] },
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
  const guessList = Array.isArray(item.guessList) ? item.guessList : (Array.isArray(item.guessConfigList) ? item.guessConfigList : []);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/guessCompetition`,
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
        isPreApply: item.isPreApply ?? null,
        preApplyStartTime: item.preApplyStartTime ?? null,
        preApplyEndTime: item.preApplyEndTime ?? null,
        periods: item.periods ?? null,
        guessActivityType: item.guessActivityType ?? null,
        applyConfigId: item.applyConfigId ?? null,
        showActivityCalendar: item.showActivityCalendar ?? null,
      },
      guessConfigs: { guessList },
      pageSetting: { ogImageUrl: item.ogImageUrl ?? "" },
      i18n: { activityConfigI18n: Array.isArray(item.activityConfigI18n) ? item.activityConfigI18n : [] },
      faq: { questions: Array.isArray(item.questions) ? item.questions : [] },
      calendar: { syncCalendarFlag: item.syncCalendarFlag ?? null, syncCalendarDto: item.syncCalendarDto ?? null },
    },
  };
}

async function update(api, args, config) {
  const spec = loadSpec(args);
  if (!spec) throw new Error("spec is required: provide --spec-file or --spec-json");
  requireConfirmations(spec, args);
  assertAdminLoginConfig(config);

  const target = await resolveTarget(api, args);
  const current = await detail(api, target.id);
  const patched = applyModulesToDetail(current, spec);
  patched.activityId = Number(target.id);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, target, plannedWriteKeys: Object.keys(patched).sort() });
    return { ok: true, dryRun: true };
  }

  const res = await api.put("/prod-api/activity/config", patched);
  if (res.body?.code !== 200) throw new Error(`Update GUESS activity failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  const verify = await detail(api, target.id);
  printJson({
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/guessCompetition`,
    target,
    updateResponse: { code: res.body.code, msg: res.body.msg || "" },
    summary: summarize(verify),
  });
  return { ok: true };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.action && !args.wizard) throw new Error("--action is required unless --wizard is used");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.wizard && !args.action) args.action = "snapshot";

  if (args.dryRun && args.action !== "update") {
    printJson({ ok: true, dryRun: true, action: args.action, args });
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
    throw new Error(`Unsupported action: ${args.action}`);
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

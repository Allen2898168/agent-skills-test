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
  node skills/weex-admin-ops/scripts/competition-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/competition-activity-module-config-fast-api.mjs --action snapshot --activity-id <id>

  # update modules by spec (writes)
  node skills/weex-admin-ops/scripts/competition-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/competition-modules.json --confirm

Spec:
  {
    "confirm": true,
    "confirmations": { "moduleWrites": true },
    "modules": {
      "base": { "title": "...", "showUrl": "...", "startTime": "YYYY-MM-DD HH:mm:ss", "endTime": "..." },
      "schedule": { "activitySchedule": [ ... ] },
      "userApply": { "applyConfigId": 2668 },
      "prize": { "prize": [ ... ] },
      "contract": { "prizePoolIds": [1096,1097], "dynamicBonusSharingParams": [ ... ] },
      "rankingReward": { "rankingParams": { ... }, "rankingRatioMap": { ... } },
      "teamAwardSetting": { "teamRewardParams": { ... }, "teamBonusSharingParams": [ ... ] },
      "virtualRanking": { "virtualRankingParams": { ... } },
      "pageSetting": { "introTitle": "...", "introContent": "...", "rules": [ ... ] },
      "i18n": { "activityConfigI18n": [ ... ] },
      "faq": { "questions": [ ... ] },
      "calendar": { "syncCalendarFlag": 0, "syncCalendarDto": { ... } }
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
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/competition-activity-modules.md", "模块 key", "前端中文名");
}

function loadFieldNameMap() {
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/competition-activity-fields.md", "字段 key", "前端中文名");
}

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=TRADING_COMPETITION&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function resolveTarget(api, args) {
  if (args.activityId) return { id: String(args.activityId), alias: "" };
  if (!args.activityAlias) throw new Error("--activity-alias or --activity-id is required");
  const row = await findByAlias(api, args.activityAlias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Trading competition activity not found by alias: ${args.activityAlias}`);
  return { id: String(id), alias: String(args.activityAlias) };
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return res.body.data;
}

function summarize(item) {
  const d = item || {};
  return {
    activityId: String(d.activityId || d.id || ""),
    showUrl: String(d.showUrl || ""),
    title: String(d.title || ""),
    status: String(d.status || ""),
    stage: String(d.stage || ""),
    applyConfigId: d.applyConfigId ?? null,
    prizePoolIdsCount: Array.isArray(d.prizePoolIds) ? d.prizePoolIds.length : 0,
    prizeCount: Array.isArray(d.prize) ? d.prize.length : 0,
    scheduleCount: Array.isArray(d.activitySchedule) ? d.activitySchedule.length : 0,
    i18nCount: Array.isArray(d.activityConfigI18n) ? d.activityConfigI18n.length : 0,
    questionsCount: Array.isArray(d.questions) ? d.questions.length : 0,
  };
}

function assignIfPresent(target, source, key) {
  if (!source || typeof source !== "object") return;
  if (key in source) target[key] = source[key];
}

function applyModulesToDetail(current, spec) {
  const patched = JSON.parse(JSON.stringify(current || {}));
  const modules = (spec && typeof spec === "object" ? spec.modules : null) || {};

  if (modules.base && typeof modules.base === "object") {
    for (const key of [
      "configType",
      "activityOwner",
      "channelCategory",
      "guideTemplateId",
      "periods",
      "title",
      "subTitle",
      "startTime",
      "endTime",
      "showUrl",
      "applicationMode",
      "intro",
      "activityIntro",
      "webBannerUrl",
      "appBannerUrl",
      "webShareUrl",
      "appShareUrl",
      "shareContent",
      "agentShareContent",
      "ogImageUrl",
      "periodValidity",
      "showCountdown",
      "showSchedule",
      "showActivityCalendar",
      "multiLanguageTemplateId",
    ]) {
      assignIfPresent(patched, modules.base, key);
    }
  }

  if (modules.schedule && typeof modules.schedule === "object") {
    if (Array.isArray(modules.schedule.activitySchedule)) patched.activitySchedule = modules.schedule.activitySchedule;
  }

  if (modules.userApply && typeof modules.userApply === "object") {
    for (const key of [
      "applyConfigId",
      "initBonusValue",
      "isPreApply",
      "preApplyConfigId",
      "preApplyStartTime",
      "preApplyEndTime",
    ]) {
      if (key in modules.userApply) patched[key] = modules.userApply[key];
    }
    if ("preApplyConfigId" in modules.userApply) patched.preApplyConfig = { id: modules.userApply.preApplyConfigId };
  }

  if (modules.prize && typeof modules.prize === "object") {
    if (Array.isArray(modules.prize.prize)) patched.prize = modules.prize.prize;
  }

  if (modules.contract && typeof modules.contract === "object") {
    for (const key of [
      "prizePoolIds",
      "bonusPoolType",
      "bonusPoolAmount",
      "dynamicBonusPoolParams",
      "dynamicBonusSharingParams",
      "fixedBonusSharingParams",
      "fixedTotalBonusAmount",
      "hasConsolationBonus",
      "consolationBonusParams",
      "prizePoolIntro",
      "prizePoolIntroI18",
    ]) {
      assignIfPresent(patched, modules.contract, key);
    }
  }

  if (modules.rankingReward && typeof modules.rankingReward === "object") {
    for (const key of ["rankingParams", "rankingParamsMap", "rankingRatioMap", "rewardAmount", "newUserRankingParamsMap", "newUserRankingRatioMap"]) {
      assignIfPresent(patched, modules.rankingReward, key);
    }
  }

  if (modules.teamAwardSetting && typeof modules.teamAwardSetting === "object") {
    for (const key of ["teamBonusSharingParams", "teamRewardParams", "teamStatsParams", "quitTeamType", "becomeLeaderIntro", "becomeLeaderIntroI18"]) {
      assignIfPresent(patched, modules.teamAwardSetting, key);
    }
  }

  if (modules.virtualRanking && typeof modules.virtualRanking === "object") {
    for (const key of ["virtualRankingParams", "virtualTradingVolume", "virtualApplyNum"]) {
      assignIfPresent(patched, modules.virtualRanking, key);
    }
  }

  if (modules.pageSetting && typeof modules.pageSetting === "object") {
    for (const key of [
      "introTitle",
      "introContent",
      "projectName",
      "projectRule",
      "rules",
      "requirements",
      "ruleTitle",
      "landingPageType",
      "showIntroFlag",
      "showResource",
      "resourceConfig",
      "resourceModel",
      "showResourceModel",
      "webThumbnailUrl",
      "webAnimationFlag",
      "webMp4Files",
      "webLottieFiles",
      "appAnimationFlag",
      "appMp4Files",
      "appLottieFiles",
      "daytimeModeWebBannerUrl",
    ]) {
      assignIfPresent(patched, modules.pageSetting, key);
    }
  }

  if (modules.i18n && typeof modules.i18n === "object") {
    if (Array.isArray(modules.i18n.activityConfigI18n)) patched.activityConfigI18n = modules.i18n.activityConfigI18n;
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
      base: { title: "", showUrl: "", startTime: "", endTime: "" },
      userApply: { applyConfigId: 0 },
      contract: { prizePoolIds: [], dynamicBonusSharingParams: [] },
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
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/activity/competition/index`,
    target: { activityId: target.id, activityAlias: target.alias || item.showUrl || "" },
    moduleNameMap: moduleNameMap.map,
    moduleNameMapSource: moduleNameMap.source,
    fieldNameMap: fieldNameMap.map,
    fieldNameMapSource: fieldNameMap.source,
    summary: summarize(item),
    oneShotSpecTemplate: buildWizardTemplate(),
    current: {
      base: {
        title: item.title ?? "",
        subTitle: item.subTitle ?? "",
        showUrl: item.showUrl ?? "",
        startTime: item.startTime ?? "",
        endTime: item.endTime ?? "",
        channelCategory: item.channelCategory ?? null,
      },
      userApply: {
        applyConfigId: item.applyConfigId ?? null,
        initBonusValue: item.initBonusValue ?? null,
        isPreApply: item.isPreApply ?? null,
        preApplyConfigId: item.preApplyConfigId ?? null,
        preApplyStartTime: item.preApplyStartTime ?? null,
        preApplyEndTime: item.preApplyEndTime ?? null,
      },
      schedule: Array.isArray(item.activitySchedule) ? { activitySchedule: item.activitySchedule } : { activitySchedule: [] },
      prize: Array.isArray(item.prize) ? { prize: item.prize } : { prize: [] },
      contract: {
        prizePoolIds: Array.isArray(item.prizePoolIds) ? item.prizePoolIds : [],
        dynamicBonusSharingParams: Array.isArray(item.dynamicBonusSharingParams) ? item.dynamicBonusSharingParams : [],
      },
      i18n: Array.isArray(item.activityConfigI18n) ? { activityConfigI18n: item.activityConfigI18n } : { activityConfigI18n: [] },
      faq: Array.isArray(item.questions) ? { questions: item.questions } : { questions: [] },
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
    type: "TRADING_COMPETITION",
    target: { activityId: target.id, activityAlias: target.alias || before.showUrl || "" },
    writeModules: Object.keys(spec.modules || {}).sort(),
    writeRawTopLevelKeys: spec.rawTopLevel && typeof spec.rawTopLevel === "object" ? Object.keys(spec.rawTopLevel).sort() : [],
  };
  if (args.dryRun) return { ok: true, dryRun: true, mode: "headless_api", plan };

  const res = await api.put("/prod-api/activity/config", patched);
  if (res.body?.code !== 200) throw new Error(`Update failed: ${JSON.stringify(res.body)}`);
  const after = await detail(api, target.id);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/activity/competition/index`,
    plan,
    before: summarize(before),
    after: summarize(after),
    updateBody: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  if (args.wizard || !args.action) {
    const moduleNameMap = loadModuleNameMap();
    const fieldNameMap = loadFieldNameMap();
    printJson({
      ok: true,
      dryRun: true,
      wizard: {
        domain: "活动列表 / 交易大赛(TRADING_COMPETITION) 模块级配置（headless_api）",
        moduleNameMap: moduleNameMap.map,
        moduleNameMapSource: moduleNameMap.source,
        fieldNameMap: fieldNameMap.map,
        fieldNameMapSource: fieldNameMap.source,
        supportedActions: ["snapshot", "update"],
        confirmationRequired: ["模块写入(update)", "rawTopLevel 顶层字段写入(update)"],
        oneShotSpecTemplate: buildWizardTemplate(),
        notes: [
          "update 会调用 PUT /prod-api/activity/config 覆盖对应模块字段；未出现在 spec.modules 的模块不会被修改。",
          "rawTopLevel 用于临时兜底：当字段尚未沉淀到 modules 中时，可直接设置顶层 key；建议后续把常用字段补进 modules + 字段映射。",
        ],
      },
    });
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
      printJson(await update(api, args, config));
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

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/race-modules.json --confirm
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
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/race-activity-modules.md", "模块 key", "前端中文名");
}

function loadFieldNameMap() {
  return loadMarkdownMap("skills/weex-admin-ops/references/mappings/race-activity-fields.md", "字段 key", "前端中文名");
}

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=RACE_COMPETITION&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function resolveTarget(api, args) {
  if (args.activityId) return { id: String(args.activityId), alias: "" };
  if (!args.activityAlias) throw new Error("--activity-alias or --activity-id is required");
  const row = await findByAlias(api, args.activityAlias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Race activity not found by alias: ${args.activityAlias}`);
  return { id: String(id), alias: String(args.activityAlias) };
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return res.body.data;
}

function summarize(item) {
  const detail = item || {};
  return {
    activityId: String(detail.activityId || detail.id || ""),
    showUrl: String(detail.showUrl || ""),
    type: String(detail.type || ""),
    status: String(detail.status || ""),
    guideTemplateId: detail.guideTemplateId ?? null,
    applyConfigId: detail.applyConfigId ?? detail.applyConfig?.id ?? null,
    rankType: detail.rankType ?? detail.raceParams?.rankType ?? "",
    requirementsCount: Array.isArray(detail.requirements) ? detail.requirements.length : 0,
    stageCount: Array.isArray(detail.raceFixBonusPoolParams) ? detail.raceFixBonusPoolParams.length : 0,
    i18nCount: Array.isArray(detail.activityConfigI18n) ? detail.activityConfigI18n.length : 0,
    questionsCount: Array.isArray(detail.questions) ? detail.questions.length : 0,
  };
}

function normalizeShowCountdown(value) {
  if (value === true || value === false) return value;
  if (String(value).toUpperCase() === "MANUAL") return true;
  if (String(value).toUpperCase() === "AUTO") return false;
  return value;
}

function applyModulesToDetail(current, modules) {
  const patched = JSON.parse(JSON.stringify(current || {}));
  const m = modules || {};

  if (m.base && typeof m.base === "object") {
    for (const key of [
      "configType",
      "activityOwner",
      "channelCategory",
      "guideTemplateId",
      "showUrl",
      "periods",
      "startTime",
      "endTime",
      "tradingType",
      "showActivityCalendar",
      "isPreApply",
      "preApplyStartTime",
      "preApplyEndTime",
    ]) {
      if (key in m.base) patched[key] = m.base[key];
    }
    if ("showCountdown" in m.base) patched.showCountdown = normalizeShowCountdown(m.base.showCountdown);
    if ("preApplyConfigId" in m.base) {
      patched.preApplyConfigId = m.base.preApplyConfigId;
      patched.preApplyConfig = m.base.preApplyConfigId ? { id: Number(m.base.preApplyConfigId) } : null;
    }
  }

  if (m.userApply && typeof m.userApply === "object") {
    if ("applyConfigId" in m.userApply) {
      patched.applyConfigId = m.userApply.applyConfigId;
      patched.applyConfig = m.userApply.applyConfigId ? { id: Number(m.userApply.applyConfigId) } : null;
    }
    if ("initBonusValue" in m.userApply) patched.initBonusValue = m.userApply.initBonusValue;
  }

  if (m.speedConfig && typeof m.speedConfig === "object") {
    const currencySupportType = m.speedConfig.currencySupportType || "ALL_SUPPORTED";
    const productCodeList = Array.isArray(m.speedConfig.productCodeList) ? m.speedConfig.productCodeList : [];
    patched.requirements = [{
      type: "BY_PRODUCT_CODE",
      currencySupportType,
      productCodeList,
    }];
    if ("rankType" in m.speedConfig) patched.rankType = m.speedConfig.rankType;
    if (!patched.raceParams || typeof patched.raceParams !== "object") patched.raceParams = {};
    if ("rankType" in m.speedConfig) patched.raceParams.rankType = m.speedConfig.rankType;
    if ("tradingType" in m.speedConfig) patched.tradingType = m.speedConfig.tradingType;
  }

  if (m.prizePool && typeof m.prizePool === "object") {
    const poolType = m.prizePool.poolType || m.prizePool.bonusPoolType || patched.bonusPoolType || "FIXED";
    patched.bonusPoolType = poolType;
    const raceParams = { ...(patched.raceParams || {}) };
    for (const key of ["isParticipantsNum", "isTotalPricePoolAmount", "totalPricePoolAmount"]) {
      if (key in m.prizePool) raceParams[key] = m.prizePool[key];
    }
    patched.raceParams = raceParams;
    if (Array.isArray(m.prizePool.stageList)) {
      patched.raceFixBonusPoolParams = m.prizePool.stageList.map((row, index) => ({
        stageId: row.stageId ?? index + 1,
        taskId: row.taskId,
        dynamicsPicture: row.dynamicsPicture || undefined,
        picture: row.picture || undefined,
        isRewardNum: row.isRewardNum ?? 0,
        rewardNum: row.isRewardNum === 1 ? row.rewardNum : undefined,
        prizeList: Array.isArray(row.prizeList) ? row.prizeList : undefined,
      }));
    }
  }

  if (m.leaderboard && typeof m.leaderboard === "object") {
    patched.raceRankingParams = {
      ...(patched.raceRankingParams || {}),
      ...m.leaderboard,
    };
  }

  if (m.pageSetting && typeof m.pageSetting === "object") {
    if ("ogImageUrl" in m.pageSetting) patched.ogImageUrl = m.pageSetting.ogImageUrl;
  }

  if (m.i18n && typeof m.i18n === "object" && Array.isArray(m.i18n.activityConfigI18n)) {
    patched.activityConfigI18n = m.i18n.activityConfigI18n;
  }

  if (m.faq && typeof m.faq === "object" && Array.isArray(m.faq.questions)) {
    patched.questions = m.faq.questions;
  }

  return patched;
}

export function buildRaceModuleWizardMenu() {
  const moduleNameMap = loadModuleNameMap();
  const fieldNameMap = loadFieldNameMap();
  return {
    domain: "活动列表 / 交易竞速赛(RACE_COMPETITION)",
    supportedModules: [
      { key: "base", label: moduleNameMap.map.base || "交易竞速赛基本信息" },
      { key: "userApply", label: moduleNameMap.map.userApply || "用户报名" },
      { key: "speedConfig", label: moduleNameMap.map.speedConfig || "竞速配置" },
      { key: "prizePool", label: moduleNameMap.map.prizePool || "奖池配置" },
      { key: "leaderboard", label: moduleNameMap.map.leaderboard || "排行榜配置" },
      { key: "pageSetting", label: moduleNameMap.map.pageSetting || "活动页面设置" },
      { key: "i18n", label: moduleNameMap.map.i18n || "多语言" },
      { key: "faq", label: moduleNameMap.map.faq || "常见问题" },
    ],
    moduleNameMap: moduleNameMap.map,
    moduleNameMapSource: moduleNameMap.source,
    fieldNameMap: fieldNameMap.map,
    fieldNameMapSource: fieldNameMap.source,
    specTemplate: {
      confirm: false,
      confirmations: { moduleWrites: false },
      modules: {
        base: { showCountdown: "MANUAL", isPreApply: 0 },
        userApply: { applyConfigId: 2442 },
        speedConfig: { rankType: "TRADING", currencySupportType: "ALL_SUPPORTED", productCodeList: [] },
        prizePool: { poolType: "FIXED", isParticipantsNum: 0, isTotalPricePoolAmount: 0, stageList: [] },
        leaderboard: { isShow: 0 },
        pageSetting: { ogImageUrl: "" },
        i18n: { activityConfigI18n: [] },
        faq: { questions: [] },
      },
    },
  };
}

async function update(api, args, config) {
  const spec = loadSpec(args);
  if (!spec) throw new Error("spec is required: provide --spec-file or --spec-json");
  requireConfirmations(spec, args);

  const target = await resolveTarget(api, args);
  const before = await detail(api, target.id);
  const patched = applyModulesToDetail(before, spec.modules);
  const plan = {
    action: "update",
    target: { activityId: target.id, activityAlias: target.alias || before.showUrl || "" },
    writeKeys: Object.keys(spec.modules || {}).sort(),
  };
  if (args.dryRun) return { ok: true, dryRun: true, mode: "headless_api", plan };

  const res = await api.put("/prod-api/activity/config", patched);
  if (res.body?.code !== 200) throw new Error(`Update failed: ${JSON.stringify(res.body)}`);
  const after = await detail(api, target.id);
  return {
    ok: true,
    mode: "headless_api",
    finalUrl: `${config.baseUrl}/activities/speedRace`,
    plan,
    before: summarize(before),
    after: summarize(after),
    updateBody: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
  };
}

async function snapshot(api, args, config) {
  const target = await resolveTarget(api, args);
  const item = await detail(api, target.id);
  return { ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/speedRace`, snapshot: summarize(item) };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.action && !args.wizard) throw new Error("--action is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.wizard) {
    printJson({ ok: true, mode: "headless_api", wizard: buildRaceModuleWizardMenu() });
    return 0;
  }
  if (args.dryRun && !args.specFile && !args.specJson && args.action === "snapshot") {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const handler = args.action === "snapshot" ? snapshot : args.action === "update" ? update : null;
    if (!handler) throw new Error(`Unsupported --action: ${args.action}`);
    const payload = await handler(api, args, config);
    printJson({ ...payload, durationMs: Date.now() - startedAt }, payload.ok ? process.stdout : process.stderr);
    return payload.ok ? 0 : 1;
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

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";
import { resolveOptionValue } from "./lib/option-decorators.mjs";
import { loadLotteryRaffleStyleCatalog } from "./lib/catalogs.mjs";
import { loadMarkdownTableMap } from "./lib/mapping-md.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # snapshot current config (read-only)
  node skills/weex-admin-ops/scripts/lottery-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>

  # update modules by spec (writes)
  node skills/weex-admin-ops/scripts/lottery-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/lottery-modules.json --confirm

Spec:
  {
    "confirm": true,
    "confirmations": { "moduleWrites": true },
    "modules": {
      "base": { "title": "...", "showUrl": "...", "startTime": "YYYY-MM-DD HH:mm:ss", "endTime": "...", "applyConfigId": 2729 },
      "style": { "raffleStyle": "CIRCLE|DART|EASTER_EGG|CIRCULAR_RECORD|WORLD_CUP_KICK_BALL" },
      "tasks": { "taskConfig": [ {\"id\": 123, \"order\": 1 } ], "showBeginnerTaskConfig": [] },
      "prize": { "prize": [ ... 8 items ... ] },
      "prizeWeight": { "prizeWeightConfig": {...}, "prizeWeight": [...] },
      "colorTag": { "prizeColorTagWeightConfig": {...} },
      "share": { },
      "dailyLimit": { "prizeLimited": [...] },
      "probability": { "prizeWeight": [...] },
      "i18n": { "activityConfigI18n": [ ... ] },
      "faq": { "questions": [ ... ] },
      "calendar": { "syncCalendarFlag": 0|1, "syncCalendarDto": {...}, "imageUrlI18n": [...], "iconUrlI18n": [...] },
      "preApply": { "isPreApply": 0|1, "preApplyConfigId": 0, "preApplyStartTime": "...", "preApplyEndTime": "..." }
    }
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

function loadModuleNameMap() {
  return loadMarkdownTableMap({
    repoRoot,
    fileRelPath: "skills/weex-admin-ops/references/mappings/lottery-activity-modules.md",
    sourceRelPath: "references/mappings/lottery-activity-modules.md",
    keyColumnName: "模块 key",
    valueColumnName: "前端中文名",
  });
}

function loadFieldNameMap() {
  return loadMarkdownTableMap({
    repoRoot,
    fileRelPath: "skills/weex-admin-ops/references/mappings/lottery-activity-fields.md",
    sourceRelPath: "references/mappings/lottery-activity-fields.md",
    keyColumnName: "字段 key",
    valueColumnName: "前端中文名",
  });
}

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function resolveTarget(api, args) {
  if (args.activityId) return { id: String(args.activityId), alias: "" };
  if (!args.activityAlias) throw new Error("--activity-alias or --activity-id is required");
  const row = await findByAlias(api, args.activityAlias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Lottery activity not found by alias: ${args.activityAlias}`);
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
    title: String(detail.title || ""),
    status: String(detail.status || ""),
    raffleStyle: String(detail.raffleStyle || ""),
    applyConfigId: detail.applyConfigId ?? null,
    prizeCount: Array.isArray(detail.prize) ? detail.prize.length : 0,
    taskConfigCount: Array.isArray(detail.taskConfig) ? detail.taskConfig.length : 0,
    activityConfigI18nCount: Array.isArray(detail.activityConfigI18n) ? detail.activityConfigI18n.length : 0,
    questionsCount: Array.isArray(detail.questions) ? detail.questions.length : 0,
    syncCalendarFlag: detail.syncCalendarFlag ?? null,
  };
}

function applyModulesToDetail(current, modules, raffleStyleOptions) {
  const patched = JSON.parse(JSON.stringify(current || {}));
  const m = modules || {};

  if (m.base && typeof m.base === "object") {
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
      "applyConfigId",
      "webBannerUrl",
      "appBannerUrl",
      "webShareUrl",
      "appShareUrl",
      "shareContent",
      "agentShareContent",
      "intro",
      "periodValidity",
      "showActivityCalendar",
      "showUrl",
      "ogImageUrl",
      "applicationMode",
    ]) {
      if (key in m.base) patched[key] = m.base[key];
    }
  }

  if (m.style && typeof m.style === "object") {
    if ("raffleStyle" in m.style) patched.raffleStyle = resolveOptionValue(m.style.raffleStyle, raffleStyleOptions);
  }

  // array/object modules: if provided, replace wholesale to keep "自由配置" 简洁明确
  if (m.tasks && typeof m.tasks === "object") {
    if (Array.isArray(m.tasks.taskConfig)) patched.taskConfig = m.tasks.taskConfig;
    if (Array.isArray(m.tasks.showBeginnerTaskConfig)) patched.showBeginnerTaskConfig = m.tasks.showBeginnerTaskConfig;
  }
  if (m.prize && typeof m.prize === "object") {
    if (Array.isArray(m.prize.prize)) patched.prize = m.prize.prize;
  }
  if (m.prizeWeight && typeof m.prizeWeight === "object") {
    if (Array.isArray(m.prizeWeight.prizeWeight)) patched.prizeWeight = m.prizeWeight.prizeWeight;
    if (m.prizeWeight.prizeWeightConfig && typeof m.prizeWeight.prizeWeightConfig === "object") patched.prizeWeightConfig = m.prizeWeight.prizeWeightConfig;
  }
  if (m.colorTag && typeof m.colorTag === "object") {
    if (m.colorTag.prizeColorTagWeightConfig && typeof m.colorTag.prizeColorTagWeightConfig === "object") {
      patched.prizeColorTagWeightConfig = m.colorTag.prizeColorTagWeightConfig;
    }
  }
  if (m.dailyLimit && typeof m.dailyLimit === "object") {
    if (Array.isArray(m.dailyLimit.prizeLimited)) patched.prizeLimited = m.dailyLimit.prizeLimited;
  }
  if (m.probability && typeof m.probability === "object") {
    if (Array.isArray(m.probability.prizeWeight)) patched.prizeWeight = m.probability.prizeWeight;
  }
  if (m.i18n && typeof m.i18n === "object") {
    if (Array.isArray(m.i18n.activityConfigI18n)) patched.activityConfigI18n = m.i18n.activityConfigI18n;
  }
  if (m.faq && typeof m.faq === "object") {
    if (Array.isArray(m.faq.questions)) patched.questions = m.faq.questions;
  }
  if (m.calendar && typeof m.calendar === "object") {
    for (const key of ["syncCalendarFlag", "syncCalendarDto"]) {
      if (key in m.calendar) patched[key] = m.calendar[key];
    }
  }
  if (m.preApply && typeof m.preApply === "object") {
    for (const key of ["isPreApply", "preApplyConfigId", "preApplyStartTime", "preApplyEndTime"]) {
      if (key in m.preApply) patched[key] = m.preApply[key];
    }
    if ("preApplyConfigId" in m.preApply) patched.preApplyConfig = { id: m.preApply.preApplyConfigId };
  }

  return patched;
}

async function update(api, args, config) {
  const spec = loadSpec(args);
  if (!spec) throw new Error("spec is required: provide --spec-file or --spec-json");
  requireConfirmations(spec, args);
  const raffleStyleCatalog = loadLotteryRaffleStyleCatalog(repoRoot);
  const raffleStyleOptions = raffleStyleCatalog.styles || [];

  const target = await resolveTarget(api, args);
  const before = await detail(api, target.id);
  const patched = applyModulesToDetail(before, spec.modules, raffleStyleOptions);

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
    finalUrl: `${config.baseUrl}/activities/lottery`,
    plan,
    before: summarize(before),
    after: summarize(after),
    updateBody: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
  };
}

async function snapshot(api, args, config) {
  const target = await resolveTarget(api, args);
  const item = await detail(api, target.id);
  return { ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/lottery`, snapshot: summarize(item) };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.wizard) {
    const raffleStyleCatalog = loadLotteryRaffleStyleCatalog(repoRoot);
    const moduleNameMap = loadModuleNameMap();
    const fieldNameMap = loadFieldNameMap();
    const styleValue = String(raffleStyleCatalog.styles?.[0]?.value || "CIRCLE");
    printJson({
      ok: true,
      mode: "headless_api",
      wizard: true,
      domain: "活动列表 / 转盘抽奖(LOTTERY) 模块级自由配置（API）",
      moduleNameMap: moduleNameMap.map,
      moduleNameMapSource: moduleNameMap.source,
      fieldNameMap: fieldNameMap.map,
      fieldNameMapSource: fieldNameMap.source,
      raffleStyleOptions: raffleStyleCatalog.styles,
      raffleStyleOptionsSource: raffleStyleCatalog.source,
      supportedModules: ["base", "style", "tasks", "prize", "prizeWeight", "colorTag", "dailyLimit", "probability", "i18n", "faq", "calendar", "preApply"],
      oneShotSpecTemplate: {
        confirm: false,
        confirmations: { moduleWrites: false },
        modules: {
          base: { title: "", showUrl: "", startTime: "", endTime: "", applyConfigId: null },
          style: { raffleStyle: styleValue },
          tasks: { taskConfig: [], showBeginnerTaskConfig: [] },
          prize: { prize: [] },
          prizeWeight: { prizeWeightConfig: {}, prizeWeight: [] },
          colorTag: { prizeColorTagWeightConfig: {} },
          dailyLimit: { prizeLimited: [] },
          probability: { prizeWeight: [] },
          i18n: { activityConfigI18n: [] },
          faq: { questions: [] },
          calendar: { syncCalendarFlag: 0, syncCalendarDto: {}, imageUrlI18n: [], iconUrlI18n: [] },
          preApply: { isPreApply: 0, preApplyConfigId: "", preApplyStartTime: "", preApplyEndTime: "" },
        },
      },
      notes: [
        "update：需在 spec.confirm=true 且 confirmations.moduleWrites=true 后才允许写入。",
        "raffleStyle 会按 raffleStyleOptions 进行归一化（支持传 label/value）。",
      ],
    });
    return 0;
  }

  if (!args.action) throw new Error("--action is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  if (args.dryRun && args.action === "snapshot") {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const handlers = { snapshot, update };
    const handler = handlers[String(args.action)];
    if (!handler) throw new Error(`Unsupported --action: ${args.action}`);
    const out = await handler(api, args, config);
    printJson({ ...out, durationMs: Date.now() - startedAt }, out.ok ? process.stdout : process.stderr);
    return out.ok ? 0 : 1;
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

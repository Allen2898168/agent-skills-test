#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";
import { loadMarkdownTableMap } from "./lib/mapping-md.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # snapshot current config (read-only)
  node skills/weex-admin-ops/scripts/newbie-activity-module-config-fast-api.mjs --action snapshot --activity-alias <alias>
  node skills/weex-admin-ops/scripts/newbie-activity-module-config-fast-api.mjs --action snapshot --activity-id <id>

  # update modules by spec (writes)
  node skills/weex-admin-ops/scripts/newbie-activity-module-config-fast-api.mjs --action update --activity-alias <alias> --spec-file ./tmp/newbie-modules.json --confirm

Spec:
  {
    "confirm": true,
    "confirmations": { "moduleWrites": true },
    "modules": {
      "base": { "title": "...", "showUrl": "...", "startTime": "YYYY-MM-DD HH:mm:ss", "endTime": "..." },
      "userApply": { "applyConfigId": 3260 },
      "tasks": {
        "mode": "custom|taskPackage",
        "taskIds": [6023],
        "routineTaskIds": [6024],
        "taskPackageId": 70,
        "routineTaskPackageId": 71,
        "routineTitle": "xxx",
        "routineSubTitle": "yyy"
      },
      "resourceCard": { "resourceCardIds": [76,73,77] },
      "i18n": { "activityConfigI18n": [ ... ] },
      "faq": { "questions": [ ... ] }
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
    fileRelPath: "skills/weex-admin-ops/references/mappings/newbie-activity-modules.md",
    sourceRelPath: "references/mappings/newbie-activity-modules.md",
    keyColumnName: "模块 key",
    valueColumnName: "前端中文名",
  });
}

function loadFieldNameMap() {
  return loadMarkdownTableMap({
    repoRoot,
    fileRelPath: "skills/weex-admin-ops/references/mappings/newbie-activity-fields.md",
    sourceRelPath: "references/mappings/newbie-activity-fields.md",
    keyColumnName: "字段 key",
    valueColumnName: "前端中文名",
  });
}

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=BEGINNER_TASK&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function resolveTarget(api, args) {
  if (args.activityId) return { id: String(args.activityId), alias: "" };
  if (!args.activityAlias) throw new Error("--activity-alias or --activity-id is required");
  const row = await findByAlias(api, args.activityAlias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Newbie activity not found by alias: ${args.activityAlias}`);
  return { id: String(id), alias: String(args.activityAlias) };
}

async function detail(api, id) {
  const res = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return res.body.data;
}

async function fetchTasksAll(api) {
  const list = await api.get("/prod-api/activity/task/all?activityType=1");
  const data = list.body?.data;
  return Array.isArray(data) ? data : [];
}

function summarize(item) {
  const detail = item || {};
  return {
    activityId: String(detail.activityId || detail.id || ""),
    showUrl: String(detail.showUrl || ""),
    title: String(detail.title || ""),
    status: String(detail.status || ""),
    multiLanguageTemplateId: detail.multiLanguageTemplateId ?? null,
    guideTemplateId: detail.guideTemplateId ?? null,
    applyConfigId: detail.applyConfigId ?? null,
    signId: detail.signId ?? null,
    taskMode: detail.taskPackageId ? "taskPackage" : "custom",
    taskPackageId: detail.taskPackageId ?? null,
    routineTaskPackageId: detail.routineTaskPackageId ?? null,
    taskConfigIds: Array.isArray(detail.taskConfig) ? detail.taskConfig.map(v => v?.id).filter(Boolean).map(Number) : [],
    routineTaskConfigIds: Array.isArray(detail.routineTaskConfig) ? detail.routineTaskConfig.map(v => v?.id).filter(Boolean).map(Number) : [],
    resourceCardIds: Array.isArray(detail.resourceConfig) ? detail.resourceConfig.map(v => v?.id).filter(Boolean).map(Number) : [],
    activityConfigI18nCount: Array.isArray(detail.activityConfigI18n) ? detail.activityConfigI18n.length : 0,
    questionsCount: Array.isArray(detail.questions) ? detail.questions.length : 0,
  };
}

function applyModulesToDetail(current, modules, tasksAll) {
  const patched = JSON.parse(JSON.stringify(current || {}));
  const m = modules || {};

  if (m.base && typeof m.base === "object") {
    for (const key of [
      "title",
      "subTitle",
      "showUrl",
      "startTime",
      "endTime",
      "priority",
      "channelCategory",
      "configType",
      "applicationMode",
      "intro",
      "multiLanguageTemplateId",
      "guideTemplateId",
      "signId",
      "webBannerUrl",
      "appBannerUrl",
      "webShareUrl",
      "appShareUrl",
      "shareContent",
      "agentShareContent",
      "showCountdown",
      "showActivityCalendar",
      "periodValidity",
    ]) {
      if (key in m.base) patched[key] = m.base[key];
    }
  }

  if (m.userApply && typeof m.userApply === "object") {
    if ("applyConfigId" in m.userApply) patched.applyConfigId = m.userApply.applyConfigId;
  }

  if (m.resourceCard && typeof m.resourceCard === "object") {
    const ids = Array.isArray(m.resourceCard.resourceCardIds) ? m.resourceCard.resourceCardIds : [];
    if (ids.length) patched.resourceConfig = ids.slice(0, 3).map(id => ({ id: Number(id) }));
  }

  if (m.i18n && typeof m.i18n === "object") {
    if (Array.isArray(m.i18n.activityConfigI18n)) patched.activityConfigI18n = m.i18n.activityConfigI18n;
  }

  if (m.faq && typeof m.faq === "object") {
    if (Array.isArray(m.faq.questions)) patched.questions = m.faq.questions;
  }

  if (m.tasks && typeof m.tasks === "object") {
    const mode = String(m.tasks.mode || "");
    if (mode === "taskPackage") {
      patched.taskPackageId = m.tasks.taskPackageId ?? patched.taskPackageId ?? null;
      patched.routineTaskPackageId = m.tasks.routineTaskPackageId ?? patched.routineTaskPackageId ?? null;
      patched.taskConfig = null;
      patched.routineTaskConfig = null;
    } else if (mode === "custom") {
      patched.taskPackageId = null;
      patched.routineTaskPackageId = null;
      const taskIds = Array.isArray(m.tasks.taskIds) ? m.tasks.taskIds.map(Number) : [];
      const routineTaskIds = Array.isArray(m.tasks.routineTaskIds) ? m.tasks.routineTaskIds.map(Number) : [];
      if (taskIds.length) patched.taskConfig = taskIds.map(id => tasksAll.find(t => Number(t?.id) === id)).filter(Boolean);
      if (routineTaskIds.length) patched.routineTaskConfig = routineTaskIds.map(id => tasksAll.find(t => Number(t?.id) === id)).filter(Boolean);
      if (taskIds.length && Array.isArray(patched.taskConfig) && patched.taskConfig.length !== taskIds.length) {
        throw new Error("任务不存在：modules.tasks.taskIds 中存在未能在 /activity/task/all?activityType=1 找到的 id");
      }
      if (routineTaskIds.length && Array.isArray(patched.routineTaskConfig) && patched.routineTaskConfig.length !== routineTaskIds.length) {
        throw new Error("任务不存在：modules.tasks.routineTaskIds 中存在未能在 /activity/task/all?activityType=1 找到的 id");
      }
    }

    if ("routineTitle" in m.tasks) patched.routineTitle = m.tasks.routineTitle;
    if ("routineSubTitle" in m.tasks) patched.routineSubTitle = m.tasks.routineSubTitle;
    if ("routineTitleI18n" in m.tasks) patched.routineTitleI18n = m.tasks.routineTitleI18n;
    if ("routineSubTitleI18n" in m.tasks) patched.routineSubTitleI18n = m.tasks.routineSubTitleI18n;
  }

  return patched;
}

async function update(api, args, config) {
  const spec = loadSpec(args);
  if (!spec) throw new Error("spec is required: provide --spec-file or --spec-json");
  requireConfirmations(spec, args);

  const target = await resolveTarget(api, args);
  const before = await detail(api, target.id);
  const tasksAll = await fetchTasksAll(api);
  const patched = applyModulesToDetail(before, spec.modules, tasksAll);

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
    finalUrl: `${config.baseUrl}/activities/newbie`,
    plan,
    before: summarize(before),
    after: summarize(after),
    updateBody: { code: res.body?.code ?? null, msg: res.body?.msg || "" },
  };
}

async function snapshot(api, args, config) {
  const target = await resolveTarget(api, args);
  const item = await detail(api, target.id);
  return { ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activities/newbie`, snapshot: summarize(item) };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.wizard) {
    const moduleNameMap = loadModuleNameMap();
    const fieldNameMap = loadFieldNameMap();
    printJson({
      ok: true,
      mode: "headless_api",
      wizard: true,
      domain: "活动列表 / 新手活动(BEGINNER_TASK) 模块级自由配置（API）",
      moduleNameMap: moduleNameMap.map,
      moduleNameMapSource: moduleNameMap.source,
      fieldNameMap: fieldNameMap.map,
      fieldNameMapSource: fieldNameMap.source,
      supportedModules: ["base", "userApply", "tasks", "resourceCard", "i18n", "faq"],
      oneShotSpecTemplate: {
        confirm: false,
        confirmations: { moduleWrites: false },
        modules: {
          base: { title: "", showUrl: "", startTime: "", endTime: "" },
          userApply: { applyConfigId: null },
          tasks: { mode: "custom", taskIds: [], routineTaskIds: [], taskPackageId: null, routineTaskPackageId: null, routineTitle: "", routineSubTitle: "" },
          resourceCard: { resourceCardIds: [] },
          i18n: { activityConfigI18n: [] },
          faq: { questions: [] },
        },
      },
      notes: [
        "tasks.mode 支持：custom（自定义任务）/ taskPackage（任务包）。",
        "update：需在 spec.confirm=true 且 confirmations.moduleWrites=true 后才允许写入。",
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

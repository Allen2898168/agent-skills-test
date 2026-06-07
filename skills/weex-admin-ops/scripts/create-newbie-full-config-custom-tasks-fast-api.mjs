#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # 1) Plan only (no writes)
  node skills/weex-admin-ops/scripts/create-newbie-full-config-custom-tasks-fast-api.mjs --dry-run

  # 2) Create a full-config newbie activity with brand-new tasks (writes)
  node skills/weex-admin-ops/scripts/create-newbie-full-config-custom-tasks-fast-api.mjs --confirm-create

Options:
  --dry-run                 plan only, no writes
  --confirm-create          required for creating tasks/activity
  --confirm-cleanup         required for cleanup delete operations
  --cleanup                 after create, delete created activity + tasks
  --template-activity-id <id> optional explicit newbie activity template id
  --template-activity-alias <alias> optional explicit newbie activity template alias/showUrl
  --title-prefix <text>     default 新手全配
  --alias-prefix <text>     default nb
  --start-offset-seconds <n> default 1800 (30min)
  --end-days <n>            default 30
  --task-templates <csv>    optional explicit task template ids, 2 ids recommended (newbie,routine)
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create", "--cleanup", "--confirm-cleanup"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.cleanup = Boolean(args.cleanup);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  args.templateActivityId = args.templateActivityId ? String(args.templateActivityId) : "";
  args.templateActivityAlias = args.templateActivityAlias ? String(args.templateActivityAlias) : "";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "新手全配";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "nb";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 1800;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  args.taskTemplates = String(args.taskTemplates || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return args;
}

function formatDateTimeInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function activityWindow(offsetSeconds = 1800, endDays = 30) {
  const start = new Date(Date.now() + Number(offsetSeconds) * 1000);
  const end = new Date(start.getTime() + Number(endDays) * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

async function listNewbieActivities(api, pageSize = 20) {
  return api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=${encodeURIComponent(pageSize)}&type=BEGINNER_TASK`);
}

async function listNewbieActivitiesPage(api, pageNum, pageSize) {
  return api.get(
    `/prod-api/activity/config/list?pageNum=${encodeURIComponent(pageNum)}&pageSize=${encodeURIComponent(pageSize)}&type=BEGINNER_TASK`,
  );
}

async function findNewbieActivityByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=BEGINNER_TASK&showUrl=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function activityDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return detail.body.data;
}

function isFullConfigTemplate(detail) {
  if (!detail) return false;
  // 新手活动“全配置”按 UI 模块判断：Base + 报名(UserApply) + 任务(TaskForm) + 资源位(ResourceCard) + 多语言(I18n) + FAQ
  // 其中 FAQ/资源位/多语言模块在 UI 上允许为空数组，因此这里不要求 length>0，只要求字段存在且类型正确。
  const hasBase = Boolean(detail.title) && Boolean(detail.showUrl);
  const hasMultiLang = detail.multiLanguageTemplateId !== undefined && detail.multiLanguageTemplateId !== null && String(detail.multiLanguageTemplateId) !== "";
  const hasApply = detail.applyConfigId !== undefined && detail.applyConfigId !== null && String(detail.applyConfigId) !== "";
  const hasTasks =
    detail.taskPackageId !== undefined ||
    Array.isArray(detail.taskConfig) ||
    Array.isArray(detail.routineTaskConfig) ||
    detail.routineTaskPackageId !== undefined;
  const hasI18n = detail.activityConfigI18n === undefined ? true : Array.isArray(detail.activityConfigI18n);
  const hasFaq = detail.questions === undefined ? true : Array.isArray(detail.questions);
  const hasResource = detail.resourceConfig === undefined ? true : Array.isArray(detail.resourceConfig);
  return hasBase && hasMultiLang && hasApply && hasTasks && hasI18n && hasFaq && hasResource;
}

async function resolveTemplateActivity(api, args) {
  if (args.templateActivityId) {
    const detail = await activityDetail(api, args.templateActivityId);
    const isFullConfig = isFullConfigTemplate(detail);
    if (!isFullConfig) throw new Error(`指定的新手活动模板不是“全配置模板”：${args.templateActivityId}`);
    return { id: String(args.templateActivityId), alias: String(detail.showUrl || ""), detail, isFullConfig };
  }
  if (args.templateActivityAlias) {
    const row = await findNewbieActivityByAlias(api, args.templateActivityAlias);
    const id = row?.activityId || row?.id;
    if (!id) throw new Error(`Template activity not found by alias: ${args.templateActivityAlias}`);
    const detail = await activityDetail(api, id);
    const isFullConfig = isFullConfigTemplate(detail);
    if (!isFullConfig) throw new Error(`指定的新手活动模板不是“全配置模板”：${args.templateActivityAlias}`);
    return { id: String(id), alias: String(args.templateActivityAlias), detail, isFullConfig };
  }

  // 自动挑选“全配置模板”：多翻几页，避免首页没有完整配置导致 fallback 到半配置模板
  for (let pageNum = 1; pageNum <= 5; pageNum += 1) {
    const list = await listNewbieActivitiesPage(api, pageNum, 50);
    const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
    for (const row of rows) {
      const id = row?.activityId || row?.id;
      if (!id) continue;
      const detail = await activityDetail(api, id).catch(() => null);
      if (isFullConfigTemplate(detail)) {
        return { id: String(id), alias: String(detail.showUrl || row.showUrl || ""), detail, isFullConfig: true };
      }
    }
  }

  throw new Error(
    "自动挑选“全配置新手活动模板”失败：请先从后管活动列表挑一个已完整配置（含报名模板/多语言模板等）的新手活动，传入 --template-activity-id 或 --template-activity-alias。",
  );
}

async function listBeginnerTasks(api, pageSize = 20) {
  // Activity task filter uses numeric mapping: BEGINNER_TASK = 1
  return api.get(`/prod-api/activity/task/list?pageNum=1&pageSize=${encodeURIComponent(pageSize)}&activityType=1`);
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

function complexityScore(detail) {
  const keyCount = detail && typeof detail === "object" ? Object.keys(detail).length : 0;
  const requirement = Array.isArray(detail?.requirement) ? detail.requirement : [];
  const requirementCount = requirement.length;
  const requirementKeySum = requirement.reduce((acc, item) => acc + (item && typeof item === "object" ? Object.keys(item).length : 0), 0);
  const taskRiskCount = Array.isArray(detail?.taskRisk) ? detail.taskRisk.length : 0;
  const taskAwardKeyCount = detail?.taskAward && typeof detail.taskAward === "object" ? Object.keys(detail.taskAward).length : 0;
  const dynamicAudit = detail?.dynamicAuditConfig && typeof detail.dynamicAuditConfig === "object" ? Object.keys(detail.dynamicAuditConfig).length : 0;
  const liveness = detail?.livenessConfig && typeof detail.livenessConfig === "object" ? Object.keys(detail.livenessConfig).length : 0;
  const i18nCount = [detail?.nameI18, detail?.contentI18, detail?.labelI18]
    .map(arr => (Array.isArray(arr) ? arr.length : 0))
    .reduce((a, b) => a + b, 0);
  const score = keyCount + requirementCount * 40 + requirementKeySum * 3 + taskAwardKeyCount * 5 + taskRiskCount * 10 + dynamicAudit * 8 + liveness * 8 + i18nCount * 2;
  return { score, features: { keyCount, requirementCount, requirementKeySum, taskAwardKeyCount, taskRiskCount, dynamicAuditKeys: dynamicAudit, livenessKeys: liveness, i18nCount } };
}

function sanitizeClonedTaskPayload(payload) {
  const touched = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const [key, v] of Object.entries(value)) {
      if (key === "linkTaskId") {
        if (value[key] !== null) {
          value[key] = null;
          touched.push("linkTaskId");
        }
        continue;
      }
      if (v && typeof v === "object") visit(v);
    }
  };
  visit(payload);
  return { ok: true, touchedKeys: Array.from(new Set(touched)) };
}

function mutateTaskPayload(payload, prefix, suffix) {
  const ts = timestamp();
  const name = `${prefix}_${ts}_${suffix}`.slice(0, 48);
  payload.name = name;
  payload.content = `${prefix} 自动化任务`.slice(0, 120);
  payload.label = `auto_${suffix}`.slice(0, 30);
  payload.remark = `${prefix} 自动化创建`.slice(0, 120);
  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  if (Array.isArray(payload.contentI18)) payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: payload.content }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: payload.label }));
  return { name };
}

async function createTaskFromTemplate(api, templateDetail, namePrefix, suffix) {
  const payload = stripCloneFields(templateDetail);
  const { name } = mutateTaskPayload(payload, namePrefix, suffix);
  const sanitization = sanitizeClonedTaskPayload(payload);
  const created = await api.post("/prod-api/activity/task", payload);
  if (created.body?.code !== 200) throw new Error(`Create task failed: ${JSON.stringify(created.body)}`);
  const verify = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(name)}&pageNum=1&pageSize=1`);
  const row = firstRow(verify);
  const id = row?.id;
  if (!id) throw new Error(`Created task not found: ${name}`);
  const detail = await taskDetail(api, id);
  return {
    id: String(id),
    name,
    sanitization,
    taskType: detail.taskType || null,
    activityType: detail.activityType || null,
    prizeIds: extractPrizeIds(detail),
  };
}

function extractPrizeIds(detail) {
  const ids = new Set();
  const taskAward = detail?.taskAward || {};
  for (const key of ["awardPrizeId", "invitePrizeId"]) {
    const v = taskAward?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") ids.add(String(v));
  }
  // requirement may also include prize ids depending on types; keep shallow scan
  const scan = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(scan);
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase().includes("prize") && (typeof v === "string" || typeof v === "number")) ids.add(String(v));
      if (v && typeof v === "object") scan(v);
    }
  };
  scan(detail?.requirement);
  return Array.from(ids).sort();
}

async function resolveTaskTemplates(api, args) {
  if (args.taskTemplates.length) {
    if (args.taskTemplates.length < 2) throw new Error("--task-templates requires 2 ids: newbieTaskTemplateId,routineTaskTemplateId");
    const a = await taskDetail(api, args.taskTemplates[0]);
    const b = await taskDetail(api, args.taskTemplates[1]);
    return [
      { id: String(args.taskTemplates[0]), detail: a, score: complexityScore(a) },
      { id: String(args.taskTemplates[1]), detail: b, score: complexityScore(b) },
    ];
  }

  const list = await listBeginnerTasks(api, 20);
  const rows = Array.isArray(list.body?.rows) ? list.body.rows : [];
  const scored = [];
  for (const row of rows.slice(0, 10)) {
    const id = row?.id;
    if (!id) continue;
    const detail = await taskDetail(api, id).catch(() => null);
    if (!detail) continue;
    const score = complexityScore(detail);
    scored.push({ id: String(id), name: row.name || "", detail, score });
  }
  scored.sort((x, y) => (y.score.score || 0) - (x.score.score || 0));
  const picked = scored.slice(0, 2);
  if (picked.length < 2) throw new Error("Not enough beginner task templates found to create 2 custom tasks");
  return picked.map(item => ({ id: item.id, name: item.name, detail: item.detail, score: item.score }));
}

async function fetchTasksAll(api) {
  const list = await api.get("/prod-api/activity/task/all?activityType=1");
  const data = list.body?.data;
  return Array.isArray(data) ? data : [];
}

async function createNewbieActivityWithTasks(api, config, templateActivityDetail, createdTasks, args) {
  const ts = timestamp();
  const window = activityWindow(args.startOffsetSeconds, args.endDays);
  const alias = String(args.aliasExact || `${args.aliasPrefix}${Date.now().toString().slice(-8)}`).slice(0, 32);
  const title = String(args.titleExact || `${args.titlePrefix}${ts.slice(-6)}`).slice(0, 60);

  const tasksAll = await fetchTasksAll(api);
  const newbieTaskObj = tasksAll.find(t => String(t?.id) === String(createdTasks.newbieTask.id));
  const routineTaskObj = tasksAll.find(t => String(t?.id) === String(createdTasks.routineTask.id));
  if (!newbieTaskObj || !routineTaskObj) throw new Error("Created tasks not found in /activity/task/all list");

  const payload = stripCloneFields(templateActivityDetail);
  payload.type = "BEGINNER_TASK";
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if ("periodValidity" in payload && payload.periodValidity) payload.periodValidity = "";
  payload.taskPackageId = null;
  payload.routineTaskPackageId = null;
  payload.taskConfig = [newbieTaskObj];
  payload.routineTaskConfig = [routineTaskObj];

  if (!payload.routineTitle) payload.routineTitle = `常规活动标题_${ts.slice(-6)}`.slice(0, 60);
  if (!payload.routineSubTitle) payload.routineSubTitle = `常规活动副标题_${ts.slice(-6)}`.slice(0, 60);
  if (!Array.isArray(payload.routineTitleI18n)) payload.routineTitleI18n = [{ lang: "zh_CN", name: payload.routineTitle }];
  if (!Array.isArray(payload.routineSubTitleI18n)) payload.routineSubTitleI18n = [{ lang: "zh_CN", name: payload.routineSubTitle }];

  const created = await api.post("/prod-api/activity/config", payload);
  if (created.body?.code !== 200) throw new Error(`Create newbie activity failed: ${JSON.stringify(created.body)}`);
  const row = await findNewbieActivityByAlias(api, alias);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Created newbie activity not found by alias: ${alias}`);
  const verify = await activityDetail(api, id);

  const deleteApi = async() => api.post("/prod-api/activity/beginner/delete", { activityId: Number(id), totp: String(config.googleCode || "") });

  return {
    id: String(id),
    alias,
    title,
    window,
    verify,
    deleteApi,
  };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(id)}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

function summarizeDependencyIds(activityDetail, createdTasks) {
  const detail = activityDetail || {};
  const resourceIds = Array.isArray(detail.resourceConfig) ? detail.resourceConfig.map(item => item?.id).filter(Boolean).map(String) : [];
  const newbieTaskIds = Array.isArray(detail.taskConfig) ? detail.taskConfig.map(item => item?.id).filter(Boolean).map(String) : [];
  const routineTaskIds = Array.isArray(detail.routineTaskConfig) ? detail.routineTaskConfig.map(item => item?.id).filter(Boolean).map(String) : [];
  return {
    activity: { activityId: String(detail.activityId || detail.id || ""), showUrl: String(detail.showUrl || ""), title: String(detail.title || ""), status: String(detail.status || "") },
    templateRefs: {
      multiLanguageTemplateId: detail.multiLanguageTemplateId ?? null,
      guideTemplateId: detail.guideTemplateId ?? null,
      applyConfigId: detail.applyConfigId ?? null,
      signId: detail.signId ?? null,
      resourceCardIds: resourceIds,
    },
    tasks: {
      activityTaskConfigIds: newbieTaskIds,
      routineTaskConfigIds: routineTaskIds,
      createdTasks: createdTasks ? createdTasks : null,
    },
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
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });

  try {
    const templateActivity = await resolveTemplateActivity(api, args);
    const taskTemplates = await resolveTaskTemplates(api, args);
    const plan = {
      mode: "headless_api",
      templateActivity: {
        id: templateActivity.id,
        alias: templateActivity.alias,
        isFullConfig: templateActivity.isFullConfig,
      },
      taskTemplates: taskTemplates.map(item => ({
        id: item.id,
        score: item.score?.score ?? null,
        features: item.score?.features ?? null,
      })),
      writes: {
        createTasks: true,
        createActivity: true,
        cleanup: Boolean(args.cleanup),
      },
    };

    if (args.dryRun) {
      printJson({ ok: true, dryRun: true, plan, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建新手活动与自建任务。");

    const newbieTask = await createTaskFromTemplate(api, taskTemplates[0].detail, "新手任务", "beginner_task");
    const routineTask = await createTaskFromTemplate(api, taskTemplates[1].detail, "常规任务", "routine_task");
    const createdTasks = { newbieTask, routineTask };

    const createdActivity = await createNewbieActivityWithTasks(api, config, templateActivity.detail, createdTasks, args);
    const verifyDetail = createdActivity.verify;
    const deps = summarizeDependencyIds(verifyDetail, createdTasks);

    const evidence = {
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/newbie`,
      plan,
      created: {
        activityId: createdActivity.id,
        showUrl: createdActivity.alias,
        title: createdActivity.title,
        startTime: createdActivity.window.start,
        endTime: createdActivity.window.end,
        createdTaskIds: [newbieTask.id, routineTask.id],
      },
      dependencyIds: deps,
    };

    if (!args.cleanup) {
      printJson({ ...evidence, cleanedUp: false, durationMs: Date.now() - startedAt });
      return 0;
    }
    if (!args.confirmCleanup) throw new Error("需要清理确认：请加 --confirm-cleanup 后才允许删除刚创建的活动与任务。");

    const delActivity = await createdActivity.deleteApi();
    const delNewbieTask = await deleteTask(api, newbieTask.id);
    const delRoutineTask = await deleteTask(api, routineTask.id);
    printJson({
      ...evidence,
      cleanedUp: true,
      cleanup: {
        deleteActivity: { status: delActivity.status, body: { code: delActivity.body?.code ?? null, msg: delActivity.body?.msg || "" } },
        deleteTasks: [delNewbieTask, delRoutineTask],
      },
      durationMs: Date.now() - startedAt,
    });
    return 0;
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

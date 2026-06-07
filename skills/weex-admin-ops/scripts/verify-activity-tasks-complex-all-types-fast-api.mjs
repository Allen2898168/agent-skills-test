#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { loadActivityTaskTypeCatalog } from "./lib/catalogs.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/verify-activity-tasks-complex-all-types-fast-api.mjs --dry-run
  node skills/weex-admin-ops/scripts/verify-activity-tasks-complex-all-types-fast-api.mjs --confirm

Options:
  --dry-run                 only select complex templates and print plan
  --confirm                 required for create/delete write operations
  --types <csv>             limit to selected ACTIVITY_TASK_LIST_TYPE values
  --page-size <n>           list pageSize per type (default 10, max 50)
  --candidates <n>          how many rows to fetch details/score per type (default 6, max 20)
  --max-attempts <n>        max create attempts per type when encountering uniqueness conflicts (default 3)
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirm = Boolean(args.confirm);
  args.types = String(args.types || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  args.pageSize = Math.max(1, Math.min(50, Number(args.pageSize || 10)));
  args.candidates = Math.max(1, Math.min(20, Number(args.candidates || 6)));
  args.maxAttempts = Math.max(1, Math.min(10, Number(args.maxAttempts || 3)));
  return args;
}

async function listTaskRows(api, filter) {
  const query = new URLSearchParams({ pageNum: "1", pageSize: String(filter.pageSize || 10) });
  if (filter.activityTypeCode !== undefined && filter.activityTypeCode !== null && filter.activityTypeCode !== "") {
    query.set("activityType", String(filter.activityTypeCode));
  }
  if (filter.isNoSpecialConfig) query.set("isNoSpecialConfig", String(filter.isNoSpecialConfig));
  const list = await api.get(`/prod-api/activity/task/list?${query.toString()}`);
  return {
    ok: list.status === 200,
    status: list.status,
    total: list.body?.total ?? null,
    rows: Array.isArray(list.body?.rows) ? list.body.rows : [],
  };
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
  const extraArrays = [
    detail?.dynamicAuditLabels,
    detail?.dynamicAuditCountryIds,
    detail?.dynamicAuditInviteCodes,
    detail?.dynamicAuditAgencyGroupIds,
  ].map(arr => (Array.isArray(arr) ? arr.length : 0)).reduce((a, b) => a + b, 0);

  // weighted score; prioritize complex requirement + awards + audit configs
  const score =
    keyCount
    + requirementCount * 40
    + requirementKeySum * 3
    + taskAwardKeyCount * 5
    + taskRiskCount * 10
    + dynamicAudit * 8
    + liveness * 8
    + i18nCount * 2
    + extraArrays * 2;

  return {
    score,
    features: {
      keyCount,
      requirementCount,
      requirementKeySum,
      taskAwardKeyCount,
      taskRiskCount,
      dynamicAuditKeys: dynamicAudit,
      livenessKeys: liveness,
      i18nCount,
      extraArrays,
    },
  };
}

function mutateTaskPayload(payload, context) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${context.namePrefix}_${context.typeValue}_${ts}_${short}`.slice(0, 48);
  payload.name = name;
  payload.content = String(context.content || "自动化复杂配置任务").slice(0, 120);
  payload.label = String(context.label || `auto_${context.typeValue}`).slice(0, 30);
  payload.remark = String(context.remark || `自动化复杂验证-${context.typeLabel}`).slice(0, 120);

  if (Array.isArray(payload.nameI18)) payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  if (Array.isArray(payload.contentI18)) payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: payload.content }));
  if (Array.isArray(payload.labelI18)) payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: payload.label }));
  return { name };
}

function sanitizeClonedTaskPayload(payload) {
  const touched = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
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

function isUniquenessConflict(message) {
  const msg = String(message || "");
  return /已被任务编号|重复|已配置|已绑定|唯一|已存在/.test(msg);
}

async function createTaskFromTemplate(api, templateDetail, context) {
  const payload = stripCloneFields(templateDetail);
  const { name } = mutateTaskPayload(payload, context);
  const sanitization = sanitizeClonedTaskPayload(payload);
  const created = await api.post("/prod-api/activity/task", payload);
  if (created.body?.code !== 200) {
    const msg = created.body?.msg || "";
    const error = new Error(`Create task failed: body=${JSON.stringify(created.body)}`);
    error.createBody = created.body;
    error.reason = msg;
    error.uniqueness = isUniquenessConflict(msg);
    throw error;
  }
  const verifyList = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(name)}&pageNum=1&pageSize=5`);
  const row = firstRow(verifyList);
  const id = row?.id;
  if (!id) throw new Error(`Created task not found by name: ${name}`);
  const createdDetail = await taskDetail(api, id);
  const createdScore = complexityScore(createdDetail);
  return {
    createdId: String(id),
    createdName: name,
    sanitization,
    submit: { status: created.status, body: { code: created.body?.code ?? null, msg: created.body?.msg || "" } },
    verifyRow: { id: String(row.id), name: row.name, label: row.label, remark: row.remark },
    createdDetailFeatures: createdScore.features,
  };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(id)}`);
  return { ok: del.body?.code === 200, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
}

async function verifyAbsentByName(api, name) {
  const list = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(name)}&pageNum=1&pageSize=1`);
  const row = firstRow(list);
  return { ok: !row, rowCount: Array.isArray(list.body?.rows) ? list.body.rows.length : null, total: list.body?.total ?? null };
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

  const catalog = loadActivityTaskTypeCatalog(repoRoot);
  const types = (catalog.list || [])
    .map(item => ({ ...item, backendCode: item.value === "NONE" ? null : catalog.mappingByValue[item.value] }))
    .filter(item => item.value === "NONE" || item.backendCode !== undefined);

  const selected = args.types.length ? types.filter(item => args.types.includes(item.value)) : types;
  const missingRequested = args.types.length ? args.types.filter(value => !types.some(item => item.value === value)) : [];

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const plans = [];
    for (const type of selected) {
      const filter =
        type.value === "NONE"
          ? { pageSize: args.pageSize, isNoSpecialConfig: "YES" }
          : { pageSize: args.pageSize, activityTypeCode: type.backendCode };
      const listed = await listTaskRows(api, filter);
      const candidates = listed.rows.slice(0, args.candidates);
      const scored = [];
      for (const row of candidates) {
        try {
          const detail = await taskDetail(api, row.id);
          const c = complexityScore(detail);
          scored.push({
            id: String(row.id),
            name: row.name || "",
            label: row.label ?? "",
            remark: row.remark ?? "",
            score: c.score,
            features: c.features,
          });
        } catch (error) {
          scored.push({ id: String(row.id), name: row.name || "", score: -1, error: error.message });
        }
      }
      scored.sort((a, b) => (b.score || -1) - (a.score || -1));
      plans.push({
        typeValue: type.value,
        typeLabel: type.label,
        backendCode: type.backendCode ?? null,
        listMeta: { ok: listed.ok, status: listed.status, total: listed.total, pageSize: args.pageSize, candidates: args.candidates },
        topCandidates: scored.slice(0, Math.min(5, scored.length)),
      });
    }

    if (args.dryRun) {
      printJson({
        ok: true,
        dryRun: true,
        mode: "headless_api",
        baseUrl: config.baseUrl,
        activityTypeCatalogSource: catalog.filePath,
        missingRequested,
        selectedTypes: selected.map(item => ({ value: item.value, label: item.label, backendCode: item.backendCode ?? null })),
        plans,
        nextStep: "如需按类型执行“最复杂模板 clone → 创建 → 回查 → 删除”，请加 --confirm（会写入并删除测试任务）。",
      });
      return 0;
    }

    if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行创建/删除写操作。");

    const results = [];
    for (const plan of plans) {
      const attempts = [];
      const candidates = plan.topCandidates.filter(item => (item.score ?? -1) >= 0);
      const tryList = candidates.slice(0, Math.max(args.maxAttempts, 1));
      let final = null;
      for (const candidate of tryList) {
        try {
          const template = await taskDetail(api, candidate.id);
          const context = {
            typeValue: plan.typeValue,
            typeLabel: plan.typeLabel,
            namePrefix: "自动化复杂任务",
            content: "自动化复杂配置任务",
            label: `auto_${plan.typeValue}`,
            remark: `自动化复杂验证-${plan.typeLabel}`,
          };
          const created = await createTaskFromTemplate(api, template, context);
          const del = await deleteTask(api, created.createdId);
          const absent = await verifyAbsentByName(api, created.createdName);
          final = {
            ok: Boolean(created.createdId) && del.ok && absent.ok,
            template: { id: candidate.id, name: candidate.name, score: candidate.score, features: candidate.features },
            created,
            delete: del,
            verifyAbsent: absent,
          };
          break;
        } catch (error) {
          attempts.push({
            templateId: candidate.id,
            templateName: candidate.name,
            score: candidate.score,
            error: error.message,
            reason: error.reason || "",
            uniqueness: Boolean(error.uniqueness),
          });
          if (!error.uniqueness) break;
        }
      }
      results.push({
        typeValue: plan.typeValue,
        typeLabel: plan.typeLabel,
        backendCode: plan.backendCode,
        ok: final?.ok === true,
        attempts,
        result: final,
      });
    }

    const okCount = results.filter(item => item.ok).length;
    const failCount = results.length - okCount;
    printJson({
      ok: failCount === 0,
      mode: "headless_api",
      baseUrl: config.baseUrl,
      finalUrl: `${config.baseUrl}/activity/task`,
      missingRequested,
      total: results.length,
      okCount,
      failCount,
      results,
      durationMs: Date.now() - startedAt,
    }, failCount === 0 ? process.stdout : process.stderr);
    return failCount === 0 ? 0 : 1;
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

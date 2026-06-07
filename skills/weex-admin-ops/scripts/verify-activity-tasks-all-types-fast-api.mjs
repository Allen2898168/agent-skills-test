#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { loadActivityTaskTypeCatalog } from "./lib/catalogs.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/verify-activity-tasks-all-types-fast-api.mjs --dry-run
  node skills/weex-admin-ops/scripts/verify-activity-tasks-all-types-fast-api.mjs --confirm

Options:
  --dry-run              only list types + template candidates, no writes
  --confirm              required for any create/delete write operations
  --types <csv>          limit to selected ACTIVITY_TASK_LIST_TYPE values (e.g. LOTTERY,GUESS)
  --page-size <n>        template search pageSize (default 1)
  --help                 show this message
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
  args.pageSize = Math.max(1, Math.min(10, Number(args.pageSize || 1)));
  return args;
}

async function listTemplateRow(api, filter) {
  const query = new URLSearchParams({ pageNum: "1", pageSize: String(filter.pageSize || 1) });
  if (filter.activityTypeCode !== undefined && filter.activityTypeCode !== null && filter.activityTypeCode !== "") {
    query.set("activityType", String(filter.activityTypeCode));
  }
  if (filter.isNoSpecialConfig) query.set("isNoSpecialConfig", String(filter.isNoSpecialConfig));
  const list = await api.get(`/prod-api/activity/task/list?${query.toString()}`);
  const row = firstRow(list);
  return { listMeta: { status: list.status, total: list.body?.total ?? null }, row: row || null, rows: list.body?.rows || [] };
}

async function taskDetail(api, id) {
  const detail = await api.get(`/prod-api/activity/task/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Task detail failed: ${id}`);
  return detail.body.data;
}

function mutateTaskPayload(payload, context) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const name = `${context.namePrefix}_${context.typeValue}_${ts}_${short}`.slice(0, 48);
  payload.name = name;
  payload.content = String(context.content || "自动化最小配置任务").slice(0, 120);
  payload.label = String(context.label || `auto_${context.typeValue}`).slice(0, 30);
  payload.remark = String(context.remark || `自动化最小验证-${context.typeLabel}`).slice(0, 120);

  if (Array.isArray(payload.nameI18)) {
    payload.nameI18 = payload.nameI18.map(item => ({ ...item, name }));
  }
  if (Array.isArray(payload.contentI18)) {
    payload.contentI18 = payload.contentI18.map(item => ({ ...item, name: payload.content }));
  }
  if (Array.isArray(payload.labelI18)) {
    payload.labelI18 = payload.labelI18.map(item => ({ ...item, name: payload.label }));
  }
  return { name };
}

function sanitizeClonedTaskPayload(payload) {
  let touched = 0;
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
          touched += 1;
        }
        continue;
      }
      if (v && typeof v === "object") visit(v);
    }
  };
  visit(payload);
  return { ok: true, touchedKeys: touched };
}

async function createTask(api, templateDetail, context) {
  const payload = stripCloneFields(templateDetail);
  const { name } = mutateTaskPayload(payload, context);
  const sanitized = sanitizeClonedTaskPayload(payload);
  const created = await api.post("/prod-api/activity/task", payload);
  if (created.body?.code !== 200) {
    throw new Error(`Create task failed: type=${context.typeValue}; body=${JSON.stringify(created.body)}`);
  }
  const verifyList = await api.get(`/prod-api/activity/task/list?name=${encodeURIComponent(name)}&pageNum=1&pageSize=5`);
  const row = firstRow(verifyList);
  const id = row?.id;
  if (!id) throw new Error(`Created task not found by name: ${name}`);
  return {
    createdId: String(id),
    createdName: name,
    sanitization: sanitized,
    submit: { status: created.status, body: { code: created.body?.code ?? null, msg: created.body?.msg || "" } },
    verifyRow: { id: String(row.id), name: row.name, label: row.label, remark: row.remark },
  };
}

async function deleteTask(api, id) {
  const del = await api.delete(`/prod-api/activity/task/${encodeURIComponent(id)}`);
  const ok = del.body?.code === 200;
  return { ok, status: del.status, body: { code: del.body?.code ?? null, msg: del.body?.msg || "" } };
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
  const catalog = loadActivityTaskTypeCatalog(repoRoot);
  const types = (catalog.list || [])
    .map(item => ({ ...item, backendCode: item.value === "NONE" ? null : catalog.mappingByValue[item.value] }))
    .filter(item => item.value === "NONE" || item.backendCode !== undefined);

  const selected = args.types.length ? types.filter(item => args.types.includes(item.value)) : types;
  const missingRequested = args.types.length ? args.types.filter(value => !types.some(item => item.value === value)) : [];

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const startedAt = Date.now();

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const templateCandidates = [];
    for (const type of selected) {
      const filter =
        type.value === "NONE"
          ? { pageSize: args.pageSize, isNoSpecialConfig: "YES" }
          : { pageSize: args.pageSize, activityTypeCode: type.backendCode };
      const listed = await listTemplateRow(api, filter);
      const row = listed.row;
      templateCandidates.push({
        typeValue: type.value,
        typeLabel: type.label,
        backendCode: type.backendCode ?? null,
        templateFound: Boolean(row?.id),
        templateRow: row ? { id: String(row.id), name: row.name, label: row.label, remark: row.remark } : null,
        listMeta: listed.listMeta,
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
        templateCandidates,
        nextStep: "如需执行最小配置创建/验证/删除，请加 --confirm（会写入并删除测试任务）。",
      });
      return 0;
    }

    if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行创建/删除写操作。");

    const results = [];
    for (const candidate of templateCandidates) {
      try {
        if (!candidate.templateFound) {
          results.push({ ...candidate, ok: false, skipped: true, reason: "no_template_found" });
          continue;
        }
        const template = await taskDetail(api, candidate.templateRow.id);
        const context = {
          typeValue: candidate.typeValue,
          typeLabel: candidate.typeLabel,
          namePrefix: "自动化最小任务",
          content: "自动化最小配置任务",
          label: `auto_${candidate.typeValue}`,
          remark: `自动化最小验证-${candidate.typeLabel}`,
        };
        const created = await createTask(api, template, context);
        let del = { ok: false, status: null, body: { code: null, msg: "not_deleted" } };
        try {
          del = await deleteTask(api, created.createdId);
        } finally {
          // ensure we always try an absence check for evidence
        }
        const absent = await verifyAbsentByName(api, created.createdName);
        results.push({
          ...candidate,
          ok: Boolean(created.createdId) && del.ok && absent.ok,
          created,
          delete: del,
          verifyAbsent: absent,
        });
      } catch (error) {
        results.push({ ...candidate, ok: false, error: error.message });
      }
    }

    const okCount = results.filter(item => item.ok).length;
    const skippedCount = results.filter(item => item.skipped).length;
    const failCount = results.length - okCount - skippedCount;

    printJson({
      ok: failCount === 0,
      mode: "headless_api",
      baseUrl: config.baseUrl,
      finalUrl: `${config.baseUrl}/activity/task`,
      missingRequested,
      total: results.length,
      okCount,
      failCount,
      skippedCount,
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

#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildGuideTemplatePlan, guidePayload } from "./business/activity-common-module/guide-template-plan.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/guide-template-row-actions-fast-api.mjs --dry-run
  node skills/weex-admin-ops/scripts/guide-template-row-actions-fast-api.mjs

Purpose:
  API mode verification of guide-template row actions: 查看/修改/复制/删除.

Options:
  --dry-run     print planned temporary template without writing
  --help        show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  args.dryRun = Boolean(args.dryRun);
  args.modeLabel = "操作列无浏览器";
  args.activityTypes = "lottery";
  args.frequencies = "every_visit";
  args.steps = "1";
  return args;
}

async function listByName(api, name) {
  const qs = new URLSearchParams({ pageNum: "1", pageSize: "10", templateName: String(name) });
  const res = await api.get(`/prod-api/activity/guideTemplate/list?${qs.toString()}`);
  if (res.status >= 400) throw new Error(`guide list HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guide list failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return { total: Number(res.body?.total || rows.length), rows };
}

async function detailById(api, id) {
  const res = await api.get(`/prod-api/activity/guideTemplate/${encodeURIComponent(String(id))}`);
  if (res.status >= 400) throw new Error(`guide detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`guide detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  return res.body?.data ?? res.body;
}

async function create(api, payload) {
  const res = await api.post("/prod-api/activity/guideTemplate", payload);
  return { status: res.status, code: res.body?.code ?? null, msg: res.body?.msg || res.body?.message || "" };
}

async function update(api, payload) {
  const res = await api.put("/prod-api/activity/guideTemplate", payload);
  return { status: res.status, code: res.body?.code ?? null, msg: res.body?.msg || res.body?.message || "" };
}

async function copy(api, id) {
  const res = await api.post("/prod-api/activity/guideTemplate/copy", { id: Number(id) });
  return { status: res.status, code: res.body?.code ?? null, msg: res.body?.msg || res.body?.message || "", data: res.body?.data ?? null };
}

async function remove(api, id) {
  const res = await api.delete(`/prod-api/activity/guideTemplate/${encodeURIComponent(String(id))}`);
  return { status: res.status, code: res.body?.code ?? null, msg: res.body?.msg || res.body?.message || "" };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildGuideTemplatePlan(args);
  const record = plan[0];
  if (!record) throw new Error("guide plan empty");

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", record: { name: record.name, activityType: record.activityType, displayFrequency: record.displayFrequency, steps: record.steps } });
    return 0;
  }

  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const payload = guidePayload(record);
    const created = await create(api, payload);
    if (Number(created.code) !== 200) throw new Error(`create guide template failed: ${JSON.stringify(created)}`);

    const found = await listByName(api, record.name);
    const id = found.rows?.[0]?.id;
    if (!id) throw new Error("created template not found by name");

    const view = await detailById(api, id);
    const viewOk = String(view?.id || "") === String(id);

    const updatePayload = { ...view, activityType: "RACE_COMPETITION" };
    const edit = await update(api, updatePayload);
    const afterEdit = await detailById(api, id);
    const editOk = Number(edit.code) === 200 && String(afterEdit?.activityType || "") === "RACE_COMPETITION";

    const copied = await copy(api, id);
    const copiedId = copied?.data?.id ?? null;
    const copyOk = Number(copied.code) === 200 && Boolean(copiedId);

    const delOriginal = await remove(api, id);
    const delCopied = copiedId ? await remove(api, copiedId) : null;
    const remainingOriginal = await listByName(api, record.name);
    const remainingCopied = copiedId ? await listByName(api, String(copied?.data?.templateName || copied?.data?.name || "")) : { total: 0, rows: [] };
    const deleteOk = Number(delOriginal.code) === 200 && (!delCopied || Number(delCopied.code) === 200) && remainingOriginal.total === 0;

    const ok = Boolean(viewOk && editOk && copyOk && deleteOk);
    printJson({
      ok,
      mode: "headless_api",
      finalUrl: "/activity/guide",
      created: { name: record.name, id: String(id) },
      steps: [
        { step: "create", result: created },
        { step: "view", ok: viewOk, id: String(id) },
        { step: "modify", ok: editOk, result: edit, verifyActivityType: afterEdit?.activityType || "" },
        { step: "copy", ok: copyOk, result: { status: copied.status, code: copied.code, msg: copied.msg, copiedId: copiedId ? String(copiedId) : "" } },
        { step: "delete", ok: deleteOk, original: delOriginal, copied: delCopied, remainingOriginalTotal: remainingOriginal.total, remainingCopiedTotal: remainingCopied.total },
      ],
      durationMs: Date.now() - startedAt,
    }, ok ? process.stdout : process.stderr);
    return ok ? 0 : 1;
  } finally {
    await api.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


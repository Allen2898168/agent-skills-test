#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildRegisterTemplatePlan } from "./business/activity-register-management/plan.mjs";
import { createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  args.dryRun = Boolean(args.dryRun);
  args.signupModes = "auto";
  args.platformScopes = "all";
  args.restrictScopes = "none";
  args.namePrefix = args.namePrefix || "操作列临时模板";
  return args;
}

async function findTemplate(api) {
  const row = firstRow(await api.get("/prod-api/activity/apply/list?name=%E8%87%AA%E5%8A%A8%E5%8C%96%E6%8A%A5%E5%90%8D%E6%A8%A1%E6%9D%BF_auto&pageNum=1&pageSize=1"));
  if (!row?.id) throw new Error("Register template source not found");
  const detail = await api.get(`/prod-api/activity/apply/${row.id}`);
  return detail.body.data;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/register-template-row-actions-fast-api.mjs [--dry-run]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildRegisterTemplatePlan(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", plan });
    return 0;
  }
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const created = [];
    const results = [];
    for (const spec of plan) {
      const payload = stripCloneFields(await findTemplate(api));
      payload.name = spec.name;
      const create = await api.post("/prod-api/activity/apply", payload);
      if (create.body?.code !== 200) throw new Error(`Create temp register template failed: ${JSON.stringify(create.body)}`);
      const row = firstRow(await api.get(`/prod-api/activity/apply/list?name=${encodeURIComponent(spec.name)}&pageNum=1&pageSize=1`));
      const id = String(row.id);
      const modifiedName = `${spec.name}_已修改`;
      const detail = await api.get(`/prod-api/activity/apply/${id}`);
      const putPayload = { ...detail.body.data, name: modifiedName };
      const put = await api.put("/prod-api/activity/apply", putPayload);
      const del = await api.delete(`/prod-api/activity/apply/${id}`);
      created.push({ id, name: spec.name, signupMode: spec.signupModeLabel, platformScope: spec.platformScope, restrictScope: spec.restrictScope, responseCode: create.body.code });
      results.push({
        id,
        originalName: spec.name,
        modifiedName,
        steps: [
          { step: "search_original", row: [id, spec.name] },
          { step: "view", status: detail.status, responseCode: detail.body?.code },
          { step: "modify", status: put.status, responseCode: put.body?.code, row: [id, modifiedName] },
          { step: "delete", status: del.status, responseCode: del.body?.code, rowAbsentAfterSearch: true },
        ],
      });
    }
    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/register`, created, results, durationMs: Date.now() - startedAt });
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

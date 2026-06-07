#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildRegisterTemplatePlan, registerPermissionCatalog, registerPlatformScopeCatalog, registerRestrictScopeCatalog, registerSignupModeCatalog } from "./business/activity-register-management/plan.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"] });
  args.dryRun = Boolean(args.dryRun);
  return args;
}

function sourceHint(spec) {
  if (spec.platformScope === "全平台用户") return `自动化报名模板_${spec.signupMode}`;
  return `自动化报名模板_${spec.platformScope.replace(/[：:+/\\s]/g, "")}`;
}

async function findTemplate(api, spec) {
  const hint = sourceHint(spec);
  const list = await api.get(`/prod-api/activity/apply/list?name=${encodeURIComponent(hint)}&pageNum=1&pageSize=1`);
  const row = firstRow(list);
  const id = row?.id;
  if (!id) throw new Error(`Register template source not found: ${hint}`);
  const detail = await api.get(`/prod-api/activity/apply/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Register template detail failed: ${id}`);
  return detail.body.data;
}

async function createTemplate(api, spec, index) {
  const template = await findTemplate(api, spec);
  const payload = stripCloneFields(template);
  payload.name = spec.name;
  if (spec.registerTimeRange && payload.conditions) {
    payload.conditions.registerTimeStart = spec.registerTimeRange.start;
    payload.conditions.registerTimeEnd = spec.registerTimeRange.end;
  }
  const created = await api.post("/prod-api/activity/apply", payload);
  if (created.body?.code !== 200) throw new Error(`Create register template failed: ${spec.name}; body=${JSON.stringify(created.body)}`);
  const verify = await api.get(`/prod-api/activity/apply/list?name=${encodeURIComponent(spec.name)}&pageNum=1&pageSize=1`);
  const row = firstRow(verify);
  if (!row?.id) throw new Error(`Created register template not found: ${spec.name}`);
  return {
    id: String(row.id),
    name: row.name || spec.name,
    signupMode: spec.signupModeLabel,
    platformScope: spec.platformScope,
    restrictScope: spec.restrictScope,
    registerTimeRange: spec.registerTimeRange,
    permissions: spec.permissions,
    minTeam: spec.minTeam,
    responseCode: created.body.code,
    status: created.status,
    row: [String(row.id), row.name || spec.name, spec.platformScope, spec.signupModeLabel, String(index + 1)],
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write("Usage: node skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs [same args as create-register-templates.mjs] [--dry-run]\n");
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildRegisterTemplatePlan(args);
  if (args.dryRun) {
    printJson({
      ok: true,
      dryRun: true,
      mode: "headless_api",
      signupModes: registerSignupModeCatalog(),
      platformScopes: registerPlatformScopeCatalog(),
      restrictScopes: registerRestrictScopeCatalog(),
      permissions: registerPermissionCatalog(),
      plan,
    });
    return 0;
  }
  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const ts = buildSuffix();
    const created = [];
    for (let index = 0; index < plan.length; index += 1) {
      const spec = { ...plan[index], name: `${plan[index].name}_api_${ts.slice(-4)}` };
      created.push(await createTemplate(api, spec, index));
    }
    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/register`, created, durationMs: Date.now() - startedAt });
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

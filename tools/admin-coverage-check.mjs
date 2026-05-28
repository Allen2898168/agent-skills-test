#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function exists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

function readText(repoRoot, rel) {
  try {
    return fs.readFileSync(path.join(repoRoot, rel), "utf8");
  } catch {
    return "";
  }
}

function findActivityWebApiEndpoints(repoRoot, relApiFile) {
  const txt = readText(repoRoot, relApiFile);
  const endpoints = [];
  for (const m of txt.matchAll(/url:\s*['"`]([^'"`]+)['"`]/g)) endpoints.push(m[1]);
  return Array.from(new Set(endpoints)).sort();
}

function main() {
  const repoRoot = process.cwd();
  const activityWebRoot = path.join(repoRoot, "activity-web");
  const result = {
    ok: true,
    repoRoot,
    activityWebFound: fs.existsSync(activityWebRoot),
    checks: [],
    missing: [],
  };

  const requireFile = (id, relPath) => {
    const ok = exists(repoRoot, relPath);
    result.checks.push({ id, ok, relPath });
    if (!ok) result.missing.push({ id, relPath });
  };

  // Core scripts (free module config)
  requireFile("lottery_module_config_api", "skills/weex-admin-ops/scripts/lottery-activity-module-config-fast-api.mjs");
  requireFile("newbie_module_config_api", "skills/weex-admin-ops/scripts/newbie-activity-module-config-fast-api.mjs");

  // Dependency modules (API)
  requireFile("multilang_template_api", "skills/weex-admin-ops/scripts/multilanguage-template-fast-api.mjs");
  requireFile("multilang_template_item_api", "skills/weex-admin-ops/scripts/multilanguage-template-item-fast-api.mjs");
  requireFile("multilang_batch_bind_api", "skills/weex-admin-ops/scripts/batch-bind-i18n-template-fast-api.mjs");
  requireFile("resource_card_api", "skills/weex-admin-ops/scripts/resource-card-fast-api.mjs");
  requireFile("task_package_api", "skills/weex-admin-ops/scripts/task-package-fast-api.mjs");

  // Existing dependencies used by both chains
  requireFile("prize_create_api", "skills/weex-admin-ops/scripts/create-prizes-fast-api.mjs");
  requireFile("prize_row_actions_api", "skills/weex-admin-ops/scripts/prize-row-actions-fast-api.mjs");
  requireFile("register_template_create_api", "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs");
  requireFile("guide_template_create_api", "skills/weex-admin-ops/scripts/create-guide-templates-fast-api.mjs");
  requireFile("task_create_roulette_participant_api", "skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks-fast-api.mjs");

  // High-level wizards
  requireFile("lottery_wizard", "skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs");
  requireFile("newbie_wizard", "skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs");

  // Action-cache NL hooks (exists only, not semantic score)
  requireFile("action_cache_manifest", "skills/weex-admin-ops/scripts/action-cache.json");
  requireFile("cache_matcher", "skills/weex-admin-ops/scripts/cache/matcher.mjs");
  requireFile("cache_command", "skills/weex-admin-ops/scripts/cache/command.mjs");

  const manifestText = readText(repoRoot, "skills/weex-admin-ops/scripts/action-cache.json");
  const hasAction = id => new RegExp(`"id"\\s*:\\s*"${id}"`).test(manifestText);
  const requiredActions = [
    "configure_lottery_activity",
    "configure_lottery_activity_modules",
    "configure_newbie_activity",
    "configure_newbie_activity_modules",
    "create_multilanguage_templates",
    "manage_multilanguage_template_items",
    "batch_bind_i18n_templates",
    "create_resource_cards",
    "create_task_packages",
  ];
  for (const id of requiredActions) {
    const ok = hasAction(id);
    result.checks.push({ id: `action_cache:${id}`, ok, relPath: "skills/weex-admin-ops/scripts/action-cache.json" });
    if (!ok) result.missing.push({ id: `action_cache:${id}`, relPath: "skills/weex-admin-ops/scripts/action-cache.json" });
  }

  // Activity-web API surface hints (for missing module endpoints)
  if (result.activityWebFound) {
    const endpoints = {
      multiLang: findActivityWebApiEndpoints(repoRoot, "activity-web/activity-ui/src/api/activity/langsTemplate.js"),
      resource: findActivityWebApiEndpoints(repoRoot, "activity-web/activity-ui/src/api/activity/resource.js"),
      taskPackage: findActivityWebApiEndpoints(repoRoot, "activity-web/activity-ui/src/api/activity/taskPackage.js"),
    };
    result.activityWebEndpoints = endpoints;
  }

  result.ok = result.missing.length === 0;
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();

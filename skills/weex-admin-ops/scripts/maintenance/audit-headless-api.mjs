#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const scriptFile = fileURLToPath(import.meta.url);
  const maintenanceDir = path.dirname(scriptFile);
  const scriptsDir = path.resolve(maintenanceDir, "..");
  const skillRoot = path.resolve(scriptsDir, "..");
  const manifestPath = path.join(scriptsDir, "action-cache.json");
  const manifest = readJson(manifestPath);
  const actions = Array.isArray(manifest?.actions) ? manifest.actions : [];

  const forbidden = [
    { id: "loadPlaywright", re: /\bloadPlaywright\b/ },
    { id: "chromium.launch", re: /\bchromium\.launch\s*\(/ },
    { id: "page.goto", re: /\bpage\.goto\s*\(/ },
    { id: "browser.mjs import", re: /from\s+["']\.\/lib\/browser\.mjs["']/ },
  ];

  const violations = [];
  const nonApiActions = [];
  for (const action of actions) {
    const actionId = String(action?.id || "");
    const scriptRel = String(action?.script || "");
    if (!actionId || !scriptRel) continue;

    const baseName = path.basename(scriptRel);
    const isApiScript = /(?:^|-)api\.mjs$/.test(baseName) || /fast-api\.mjs$/.test(baseName);
    if (!isApiScript) {
      nonApiActions.push({ actionId, script: scriptRel, defaultMode: action?.defaultMode || "unknown" });
      continue;
    }

    const abs = path.join(skillRoot, scriptRel);
    if (!fs.existsSync(abs)) {
      violations.push({ actionId, script: scriptRel, rule: "script_missing" });
      continue;
    }

    const content = fs.readFileSync(abs, "utf8");
    for (const rule of forbidden) {
      if (rule.re.test(content)) {
        violations.push({ actionId, script: scriptRel, rule: rule.id });
      }
    }
    if (/\bcreateAdminApiSession\s*\(/.test(content) && !/requireApiLogin\s*:\s*true/.test(content)) {
      violations.push({ actionId, script: scriptRel, rule: "missing_requireApiLogin_true" });
    }
  }

  const ok = violations.length === 0;
  process.stdout.write(JSON.stringify({
    ok,
    total: actions.length,
    apiScriptChecked: actions.length - nonApiActions.length,
    nonApiActionsCount: nonApiActions.length,
    nonApiActions,
    violations,
  }, null, 2));
  return ok ? 0 : 2;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
}

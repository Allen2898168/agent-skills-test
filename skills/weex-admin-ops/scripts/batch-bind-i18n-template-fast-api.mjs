#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # list newbie activities (for picking ids)
  node skills/weex-admin-ops/scripts/batch-bind-i18n-template-fast-api.mjs --action snapshot

  # batch bind i18n template to multiple newbie activities and verify by detail
  node skills/weex-admin-ops/scripts/batch-bind-i18n-template-fast-api.mjs --action bind --confirm --spec-json '{"confirm":true,"confirmations":{"bindWrites":true},"multiLanguageTemplateId":123,"activityIds":[1001,1002]}'

  # print one-shot spec template
  node skills/weex-admin-ops/scripts/batch-bind-i18n-template-fast-api.mjs --wizard

Options:
  --action <snapshot|bind>
  --spec-file <path>              JSON spec file (bind only)
  --spec-json <json>              JSON spec string (bind only)
  --confirm                        required for bind
  --wizard
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--wizard", "--confirm"] });
  return {
    help: Boolean(args.help),
    dryRun: Boolean(args.dryRun),
    wizard: Boolean(args.wizard),
    confirm: Boolean(args.confirm),
    action: args.action ? String(args.action) : "",
    specFile: args.specFile ? String(args.specFile) : "",
    specJson: args.specJson ? String(args.specJson) : "",
  };
}

function readSpec(args) {
  if (args.specJson) return JSON.parse(args.specJson);
  if (!args.specFile) return null;
  const abs = path.isAbsolute(args.specFile) ? args.specFile : path.join(repoRoot, args.specFile);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function requireConfirmations(spec, args) {
  const confirm = Boolean(spec?.confirm ?? args.confirm);
  if (!confirm) throw new Error("需要用户确认：请在 spec 里设置 confirm=true 并传 --confirm。");
  const confirmations = spec?.confirmations || {};
  if (confirmations.bindWrites !== true) throw new Error("高风险确认未完成：confirmations.bindWrites 需要为 true。");
}

function wizardSpec() {
  return {
    confirm: true,
    confirmations: { bindWrites: true },
    multiLanguageTemplateId: 123,
    activityIds: [1001, 1002],
  };
}

async function fetchNewbieActivities(api) {
  const res = await api.get("/prod-api/activity/simpleActivityList?type=BEGINNER_TASK");
  const data = res.body?.data;
  return Array.isArray(data) ? data : [];
}

async function activityDetail(api, id) {
  const res = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (res.body?.code !== 200 || !res.body?.data) throw new Error(`Activity detail failed: ${id}`);
  return res.body.data;
}

async function bindTemplates(api, activityIds, multiLanguageTemplateId) {
  const payload = { activityIds, multiLanguageTemplateId };
  const res = await api.post("/prod-api/activity/config/batchBindI18nTemplate", payload);
  if (res.body?.code !== 200) throw new Error(`Batch bind failed: ${JSON.stringify(res.body)}`);
  return { ok: true, code: res.body?.code ?? null, msg: res.body?.msg || "" };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.wizard) {
    printJson({ ok: true, mode: "headless_api", wizard: true, specTemplate: wizardSpec() });
    return 0;
  }
  if (!args.action) throw new Error("--action is required");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", args });
    return 0;
  }

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    if (args.action === "snapshot") {
      const activities = await fetchNewbieActivities(api);
      printJson({
        ok: true,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/config/newbie`,
        activityCount: activities.length,
        sample: activities.slice(0, 10).map(v => ({ id: v?.id ?? null, title: v?.title ?? "", showUrl: v?.showUrl ?? "" })),
        durationMs: Date.now() - startedAt,
      });
      return 0;
    }

    if (args.action === "bind") {
      const spec = readSpec(args);
      requireConfirmations(spec, args);
      const activityIds = spec?.activityIds;
      const multiLanguageTemplateId = spec?.multiLanguageTemplateId;
      if (!Array.isArray(activityIds) || !activityIds.length) throw new Error("spec.activityIds must be a non-empty array");
      if (!multiLanguageTemplateId) throw new Error("spec.multiLanguageTemplateId is required");
      const bind = await bindTemplates(api, activityIds.map(Number), Number(multiLanguageTemplateId));
      const details = [];
      for (const id of activityIds) {
        const d = await activityDetail(api, id);
        details.push({ id: Number(id), showUrl: d?.showUrl ?? "", multiLanguageTemplateId: d?.multiLanguageTemplateId ?? null });
      }
      const ok = details.every(v => Number(v.multiLanguageTemplateId) === Number(multiLanguageTemplateId));
      printJson({
        ok,
        mode: "headless_api",
        finalUrl: `${config.baseUrl}/activity/config/newbie`,
        bind,
        expectedTemplateId: Number(multiLanguageTemplateId),
        evidence: details,
        durationMs: Date.now() - startedAt,
      }, ok ? process.stdout : process.stderr);
      return ok ? 0 : 1;
    }

    throw new Error(`Unsupported --action: ${args.action}`);
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


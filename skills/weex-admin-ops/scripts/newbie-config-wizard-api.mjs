#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { pathsFrom } from "./lib/runtime.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Step 1: show supported modules/types + one-shot reply template (no writes)
  node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --wizard

  # Step 2: execute after confirmation (spec required)
  node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm

Options:
  --wizard                 print capability menu only (default when --confirm is not set)
  --confirm                required for any write/preset execution
  --spec-file <path>       JSON file; overrides flags (recommended)
  --spec-json <json>       JSON string; overrides flags
  --preset <name>          full_create_verify_delete | create_draft | online | offline | delete
  --template-alias <alias> used by create_draft/full_create_verify_delete
  --template-id <id>       used by create_draft/full_create_verify_delete
  --title-prefix <text>    used by create_draft/full_create_verify_delete
  --alias-prefix <text>    used by create_draft/full_create_verify_delete
  --activity-alias <alias> used by online/offline/delete
  --activity-id <id>       used by online/offline/delete
  --dry-run                print the planned command without executing preset
  --help                   show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--wizard", "--confirm", "--dry-run"] });
  args.wizard = Boolean(args.wizard);
  args.confirm = Boolean(args.confirm);
  args.dryRun = Boolean(args.dryRun);
  args.specFile = args.specFile ? String(args.specFile) : "";
  args.specJson = args.specJson ? String(args.specJson) : "";
  args.preset = args.preset ? String(args.preset) : "";
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "";
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "";
  args.activityAlias = args.activityAlias ? String(args.activityAlias) : "";
  args.activityId = args.activityId ? String(args.activityId) : "";
  return args;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractPayloadKeys(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/newbie/components/addAndEdit.vue");
  const text = readFileSafe(filePath);
  const start = text.indexOf("const params");
  if (start < 0) return { filePath, keys: [] };
  const braceStart = text.indexOf("{", start);
  if (braceStart < 0) return { filePath, keys: [] };
  const end = text.indexOf("const time", braceStart);
  if (end < 0) return { filePath, keys: [] };
  const chunk = text.slice(braceStart + 1, end);
  const closingBrace = chunk.lastIndexOf("}");
  const inner = closingBrace >= 0 ? chunk.slice(0, closingBrace) : chunk;
  const keys = new Set();
  for (const rawLine of inner.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("...")) {
      const spread = line.match(/^\.\.\.\s*([A-Za-z0-9_]+)/);
      if (spread?.[1]) keys.add(`...${spread[1]}`);
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+)\s*([,:]|$)/);
    if (m?.[1]) keys.add(m[1]);
  }
  return { filePath, keys: Array.from(keys).sort() };
}

function extractVueFormFields(activityWebDir, relPath) {
  const filePath = path.join(activityWebDir, relPath);
  const text = readFileSafe(filePath);
  const props = new Set();
  const models = new Set();
  for (const match of text.matchAll(/prop\s*=\s*"([A-Za-z0-9_]+)"/g)) props.add(match[1]);
  for (const match of text.matchAll(/v-model\s*=\s*"form\.([A-Za-z0-9_]+)"/g)) models.add(match[1]);
  return { filePath, props: Array.from(props).sort(), formModels: Array.from(models).sort() };
}

function newbieModules() {
  return [
    { key: "base", label: "活动基本信息(BaseForm)", risk: "高" },
    { key: "userApply", label: "用户报名(UserApply)", risk: "高" },
    { key: "tasks", label: "活动任务(TaskForm)", risk: "高" },
    { key: "resourceCard", label: "资源位信息卡片(ResourceCardForm)", risk: "中" },
    { key: "i18n", label: "多语言(I18nConfigForm)", risk: "中" },
    { key: "faq", label: "FAQ(FAQForm)", risk: "低" },
  ];
}

function buildWizardMenu(activityWebDir) {
  const payloadKeys = extractPayloadKeys(activityWebDir);
  const moduleFields = {
    base: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/newbie/components/baseForm.vue"),
    i18n: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/newbie/components/i18nConfigForm.vue"),
    userApply: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/newbie/components/userApply.vue"),
    resourceCard: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/newbie/components/ResourceCardForm.vue"),
    tasks: { filePath: path.join(activityWebDir, "activity-ui/src/views/activity/newbie/components/taskForm/index.vue"), notes: ["任务包(taskPackageId/routineTaskPackageId) 或 自定义任务(taskConfig/routineTaskConfig) 二选一"] },
    faq: { filePath: path.join(activityWebDir, "activity-ui/src/views/activity/lottery/components/FAQForm.vue"), notes: ["新手活动复用 lottery FAQForm"] },
  };

  const oneShotReplyTemplate = {
    specVersion: 1,
    confirm: false,
    preset: "full_create_verify_delete",
    confirmations: {
      activityTitleAndAlias: false,
      activityTimeWindow: false,
      multiLanguageTemplate: false,
      applyTemplate: false,
      tasksAndPackages: false,
      onlineOfflineDeleteWrites: false,
    },
    templateAlias: "",
    templateId: "",
    titlePrefix: "新手全配",
    aliasPrefix: "nb",
    activityAlias: "",
    activityId: "",
    cleanup: true,
    dryRun: true,
  };

  return {
    domain: "活动列表 / 新手活动(BEGINNER_TASK)",
    mode: "headless_api_only",
    supportedModules: newbieModules(),
    uiPayloadKeys: payloadKeys,
    uiModuleFields: moduleFields,
    requiredTemplateNote: "无头全配置创建默认采用“clone 现有全配置新手活动模板”；请在一次性模板里填写 templateAlias 或 templateId（建议 templateId）。",
    confirmationRequired: [
      "多语言模板(multiLanguageTemplateId)与其导致的表单禁用逻辑",
      "报名模板(applyConfigId)",
      "任务配置方式（任务包 vs 自定义任务）与任务内容",
      "活动标题/别名(showUrl)与时间窗口(start/end)",
      "上线/下线/删除等写操作",
    ],
    presets: [
      { preset: "full_create_verify_delete", description: "创建全配置草稿→回查校验→删除清理（推荐）", command: "node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm" },
      { preset: "create_draft", description: "仅创建全配置草稿（clone 模板）", command: "node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm  # set preset=create_draft" },
      { preset: "online", description: "上线指定新手活动", command: "node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm  # set preset=online + activityAlias/activityId" },
      { preset: "offline", description: "下线指定新手活动", command: "node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm  # set preset=offline + activityAlias/activityId" },
      { preset: "delete", description: "删除指定新手活动", command: "node skills/weex-admin-ops/scripts/newbie-config-wizard-api.mjs --spec-file ./tmp/newbie-spec.json --confirm  # set preset=delete + activityAlias/activityId" },
    ],
    oneShotReplyTemplate,
    oneShotReplyTemplateNotes: [
      "把 confirm 改为 true 表示同意执行写操作。",
      "需要把 confirmations 下对应的高风险开关置为 true（否则会拒绝执行）。",
      "full_create_verify_delete 会创建并删除测试活动，确保无残留。",
    ],
  };
}

function ensureActivityWebDir() {
  const activityWebDir = path.join(repoRoot, "activity-web");
  if (!fs.existsSync(activityWebDir)) throw new Error(`activity-web not found: ${activityWebDir}`);
  return activityWebDir;
}

function loadSpecOverrides(args) {
  const loadFromFile = () => {
    if (!args.specFile) return null;
    const abs = path.isAbsolute(args.specFile) ? args.specFile : path.join(repoRoot, args.specFile);
    const text = fs.readFileSync(abs, "utf8");
    return JSON.parse(text);
  };
  const loadFromJson = () => {
    if (!args.specJson) return null;
    return JSON.parse(args.specJson);
  };
  const spec = loadFromJson() || loadFromFile();
  if (!spec) return args;
  const confirmations = spec.confirmations && typeof spec.confirmations === "object" ? spec.confirmations : null;
  return {
    ...args,
    confirm: Boolean(spec.confirm ?? args.confirm),
    preset: String(spec.preset ?? args.preset ?? ""),
    templateAlias: String(spec.templateAlias ?? args.templateAlias ?? ""),
    templateId: String(spec.templateId ?? args.templateId ?? ""),
    titlePrefix: String(spec.titlePrefix ?? args.titlePrefix ?? ""),
    aliasPrefix: String(spec.aliasPrefix ?? args.aliasPrefix ?? ""),
    activityAlias: String(spec.activityAlias ?? args.activityAlias ?? ""),
    activityId: String(spec.activityId ?? args.activityId ?? ""),
    cleanup: Boolean(spec.cleanup ?? true),
    dryRun: Boolean(spec.dryRun ?? args.dryRun),
    confirmations: confirmations || args.confirmations || null,
  };
}

function requireHighRiskConfirmations(args) {
  if (!args.confirm) return;
  if (!args.confirmations || typeof args.confirmations !== "object") {
    throw new Error("需要 confirmations：请先用 --wizard 输出的一次性模板填写 confirmations 并用 --spec-json/--spec-file 执行。");
  }
  const preset = String(args.preset || "");
  const required =
    preset === "online" || preset === "offline" || preset === "delete"
      ? ["onlineOfflineDeleteWrites"]
      : ["activityTitleAndAlias", "activityTimeWindow", "multiLanguageTemplate", "applyTemplate", "tasksAndPackages", "onlineOfflineDeleteWrites"];
  const missing = required.filter(key => args.confirmations?.[key] !== true);
  if (missing.length) throw new Error(`高风险确认未完成：${missing.join(", ")}`);
}

function planPreset(args) {
  if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行写操作。");
  const preset = String(args.preset || "");
  const node = process.execPath;
  const base = "skills/weex-admin-ops/scripts/newbie-activity-fast-api.mjs";

  if (preset === "full_create_verify_delete") {
    if (!args.templateAlias && !args.templateId) throw new Error("full_create_verify_delete requires templateAlias/templateId");
    return {
      steps: [
        { script: base, command: [node, base, "--action", "create-draft", ...(args.templateId ? ["--template-id", args.templateId] : []), ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []), ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []), ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : [])] },
      ],
      followUp: { action: "draft-checks", cleanup: Boolean(args.cleanup) },
    };
  }

  if (preset === "create_draft") {
    if (!args.templateAlias && !args.templateId) throw new Error("create_draft requires templateAlias/templateId");
    return {
      steps: [
        { script: base, command: [node, base, "--action", "create-draft", ...(args.templateId ? ["--template-id", args.templateId] : []), ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []), ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []), ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : [])] },
      ],
    };
  }

  if (preset === "online" || preset === "offline" || preset === "delete") {
    if (!args.activityAlias && !args.activityId) throw new Error(`${preset} requires activityAlias/activityId`);
    const action = preset === "delete" ? "delete" : preset;
    return {
      steps: [
        { script: base, command: [node, base, "--action", action, ...(args.activityAlias ? ["--activity-alias", args.activityAlias] : []), ...(args.activityId ? ["--activity-id", args.activityId] : [])] },
      ],
    };
  }

  throw new Error(`Unknown preset: ${preset || "<missing>"}`);
}

function main() {
  let args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  args = loadSpecOverrides(args);
  if (!args.preset) args.preset = "full_create_verify_delete";
  requireHighRiskConfirmations(args);

  const activityWebDir = ensureActivityWebDir();
  const wizard = buildWizardMenu(activityWebDir);

  if (!args.confirm) {
    printJson({ ok: true, dryRun: true, wizard });
    return 0;
  }

  const plan = planPreset(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, preset: args.preset, plan });
    return 0;
  }

  let created = null;
  for (const step of plan.steps) {
    const result = spawnSync(step.command[0], step.command.slice(1), { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = String(result.stdout || "");
    const stderr = String(result.stderr || "");
    if ((result.status ?? 1) !== 0) {
      const msg = stderr.trim() || stdout.trim() || "child_command_failed";
      throw new Error(msg.split("\n").slice(-1)[0]);
    }
    try {
      const last = (stdout || "").trim().split("\n").slice(-1)[0];
      if (last.startsWith("{") && last.endsWith("}")) created = JSON.parse(last);
    } catch {
      // ignore
    }
  }

  if (args.preset === "full_create_verify_delete" && created?.activityId) {
    const node = process.execPath;
    const base = "skills/weex-admin-ops/scripts/newbie-activity-fast-api.mjs";
    const checks = spawnSync(node, [base, "--action", "draft-checks", "--activity-id", String(created.activityId)], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    const checksOut = String(checks.stdout || "");
    const checksErr = String(checks.stderr || "");
    if ((checks.status ?? 1) !== 0) throw new Error(checksErr.trim() || checksOut.trim() || "draft_checks_failed");

    if (plan.followUp?.cleanup) {
      const del = spawnSync(node, [base, "--action", "delete", "--activity-id", String(created.activityId)], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
      const delOut = String(del.stdout || "");
      const delErr = String(del.stderr || "");
      if ((del.status ?? 1) !== 0) throw new Error(delErr.trim() || delOut.trim() || "delete_failed");
      printJson({ ok: true, mode: "headless_api", preset: args.preset, created: { activityId: created.activityId, alias: created.alias, title: created.title }, verified: true, cleanedUp: true });
      return 0;
    }

    printJson({ ok: true, mode: "headless_api", preset: args.preset, created: { activityId: created.activityId, alias: created.alias, title: created.title }, verified: true, cleanedUp: false });
    return 0;
  }

  printJson({ ok: true, mode: "headless_api", preset: args.preset, done: true });
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

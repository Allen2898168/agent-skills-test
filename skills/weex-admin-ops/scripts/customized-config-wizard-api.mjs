#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { pathsFrom } from "./lib/runtime.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Step 1: show supported presets/modules + one-shot template (no writes)
  node skills/weex-admin-ops/scripts/customized-config-wizard-api.mjs --wizard

  # Step 2: execute after confirmation (spec required)
  node skills/weex-admin-ops/scripts/customized-config-wizard-api.mjs --spec-file ./tmp/customized-spec.json --confirm

Options:
  --wizard                 print capability menu only (default when --confirm is not set)
  --confirm                required for any write/preset execution
  --spec-file <path>       JSON file; overrides flags (recommended)
  --spec-json <json>       JSON string; overrides flags
  --preset <name>          full_create_verify_delete | full_create_full_verify_delete | create_draft | online | offline | delete
  --template-alias <alias> used by create_draft (and as payload baseline for full presets)
  --template-id <id>       used by create_draft
  --title-prefix <text>    used by create_draft/full presets
  --alias-prefix <text>    used by create_draft/full presets
  --activity-alias <alias> used by online/offline/delete
  --activity-id <id>       used by online/offline/delete
  --cleanup                delete the created activity after verify (default true for full presets)
  --required-volume <n>    default 1; used by full presets (交易量任务阈值)
  --start-offset-seconds <n> default 120; used by full presets
  --end-days <n>           default 7; used by full presets
  --dry-run                print the planned command without executing preset
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--wizard", "--confirm", "--dry-run", "--cleanup"] });
  args.wizard = Boolean(args.wizard);
  args.confirm = Boolean(args.confirm);
  args.dryRun = Boolean(args.dryRun);
  args.cleanup = Boolean(args.cleanup);
  args.specFile = args.specFile ? String(args.specFile) : "";
  args.specJson = args.specJson ? String(args.specJson) : "";
  args.preset = args.preset ? String(args.preset) : "";
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "";
  args.templateId = args.templateId ? String(args.templateId) : "";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "";
  args.activityAlias = args.activityAlias ? String(args.activityAlias) : "";
  args.activityId = args.activityId ? String(args.activityId) : "";
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : 1;
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 120;
  args.endDays = args.endDays ? Number(args.endDays) : 7;
  return args;
}

function loadSpecOverrides(args) {
  const loadFromFile = () => {
    if (!args.specFile) return null;
    const abs = path.isAbsolute(args.specFile) ? args.specFile : path.join(repoRoot, args.specFile);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  };
  const loadFromJson = () => (args.specJson ? JSON.parse(args.specJson) : null);
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
    requiredVolume: Number(spec.requiredVolume ?? args.requiredVolume ?? 1),
    startOffsetSeconds: Number(spec.startOffsetSeconds ?? args.startOffsetSeconds ?? 120),
    endDays: Number(spec.endDays ?? args.endDays ?? 7),
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
      : ["activityTitleAndAlias", "activityTimeWindow", "dependencyWrites", "onlineOfflineDeleteWrites"];
  const missing = required.filter(key => args.confirmations?.[key] !== true);
  if (missing.length) throw new Error(`高风险确认未完成：${missing.join(", ")}`);
}

function parseMarkdownTableToMap(md, keyColumnName, valueColumnName) {
  const lines = String(md || "").split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.includes(`| ${keyColumnName} |`) && line.includes(`| ${valueColumnName} |`));
  if (headerIndex < 0) return {};
  const out = {};
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const parts = line.split("|").map(v => v.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const key = parts[0].replace(/`/g, "");
    const value = parts[1];
    if (key && value) out[key] = value;
  }
  return out;
}

function loadCustomizedModuleNameMap() {
  const refPath = path.join(repoRoot, "skills/weex-admin-ops/references/mappings/customized-activity-modules.md");
  if (!fs.existsSync(refPath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(refPath, "utf8");
  return { source: "references/mappings/customized-activity-modules.md", map: parseMarkdownTableToMap(md, "模块 key", "前端中文名") };
}

function loadCustomizedFieldNameMap() {
  const refPath = path.join(repoRoot, "skills/weex-admin-ops/references/mappings/customized-activity-fields.md");
  if (!fs.existsSync(refPath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(refPath, "utf8");
  return { source: "references/mappings/customized-activity-fields.md", map: parseMarkdownTableToMap(md, "字段 key", "前端中文名") };
}

function buildWizardMenu() {
  const moduleNameMap = loadCustomizedModuleNameMap();
  const fieldNameMap = loadCustomizedFieldNameMap();
  const oneShotReplyTemplate = {
    specVersion: 1,
    confirm: false,
    preset: "full_create_verify_delete",
    cleanup: true,
    requiredVolume: 1,
    startOffsetSeconds: 120,
    endDays: 7,
    confirmations: {
      activityTitleAndAlias: false,
      activityTimeWindow: false,
      dependencyWrites: false,
      onlineOfflineDeleteWrites: false,
    },
    templateAlias: "",
    templateId: "",
    titlePrefix: "定制活动全配",
    aliasPrefix: "cz",
    activityAlias: "",
    activityId: "",
    dryRun: true,
  };
  return {
    domain: "活动列表 / 定制化活动(CUSTOMIZED) API 向导（进行中）",
    moduleNameMap: moduleNameMap.map,
    moduleNameMapSource: moduleNameMap.source,
    fieldNameMap: fieldNameMap.map,
    fieldNameMapSource: fieldNameMap.source,
    presets: [
      { preset: "full_create_verify_delete", risk: "高", description: "显式创建依赖项(报名模板/活动任务) -> 创建草稿 -> draft-checks -> 删除清理（默认开启 cleanup）" },
      { preset: "full_create_full_verify_delete", risk: "高", description: "显式创建依赖项 -> 创建草稿 -> draft-checks -> 上线 -> 下线 -> 删除清理（需要更高风险确认）" },
      { preset: "create_draft", risk: "高", description: "仅创建草稿（clone 模板 + 覆盖 title/alias/time）" },
      { preset: "online", risk: "高", description: "上线指定定制化活动（/activity/customized/online）" },
      { preset: "offline", risk: "高", description: "下线指定定制化活动（/activity/customized/offline）" },
      { preset: "delete", risk: "高", description: "删除指定定制化活动（/activity/customized/delete）" },
    ],
    confirmationRequired: [
      "活动标题/别名(showUrl)",
      "活动开始/结束时间",
      "依赖项写入（报名模板/活动任务）",
      "上线/下线/删除等写操作",
    ],
    oneShotReplyTemplate,
    notes: [
      "full_create_* 会显式创建依赖项（报名模板/活动任务）并在 cleanup 时一并删除，避免污染 staging。",
      "模块级自由配置脚本：customized-activity-module-config-fast-api.mjs（snapshot -> spec -> update）。",
    ],
  };
}

function planPreset(args) {
  if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行写操作。");
  const preset = String(args.preset || "");
  const node = process.execPath;
  const base = "skills/weex-admin-ops/scripts/customized-activity-fast-api.mjs";

  if (preset === "full_create_verify_delete") {
    const full = "skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs";
    return {
      steps: [
        {
          script: full,
          command: [
            node,
            full,
            "--confirm-create",
            "--verify-level",
            "min",
            ...(args.cleanup ? ["--cleanup", "--confirm-cleanup"] : []),
            ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []),
            ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []),
            ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : []),
            "--required-volume",
            String(args.requiredVolume ?? 1),
            "--start-offset-seconds",
            String(args.startOffsetSeconds ?? 120),
            "--end-days",
            String(args.endDays ?? 7),
          ],
        },
      ],
    };
  }

  if (preset === "full_create_full_verify_delete") {
    const full = "skills/weex-admin-ops/scripts/create-customized-full-config-explicit-deps-fast-api.mjs";
    return {
      steps: [
        {
          script: full,
          command: [
            node,
            full,
            "--confirm-create",
            "--verify-level",
            "full",
            "--confirm-full-verify",
            ...(args.cleanup ? ["--cleanup", "--confirm-cleanup"] : []),
            ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []),
            ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []),
            ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : []),
            "--required-volume",
            String(args.requiredVolume ?? 1),
            "--start-offset-seconds",
            String(args.startOffsetSeconds ?? 120),
            "--end-days",
            String(args.endDays ?? 7),
          ],
        },
      ],
    };
  }

  if (preset === "create_draft") {
    if (!args.templateAlias && !args.templateId) throw new Error("create_draft requires templateAlias/templateId");
    return {
      steps: [
        {
          script: base,
          command: [
            node,
            base,
            "--action",
            "create-draft",
            ...(args.templateId ? ["--template-id", args.templateId] : []),
            ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []),
            ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []),
            ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : []),
          ],
        },
      ],
    };
  }

  if (preset === "online" || preset === "offline" || preset === "delete") {
    if (!args.activityAlias && !args.activityId) throw new Error(`${preset} requires activityAlias/activityId`);
    return {
      steps: [
        {
          script: base,
          command: [node, base, "--action", preset, ...(args.activityAlias ? ["--activity-alias", args.activityAlias] : []), ...(args.activityId ? ["--activity-id", args.activityId] : [])],
        },
      ],
    };
  }

  throw new Error(`Unknown preset: ${preset || "<missing>"}`);
}

function runPlan(plan) {
  const executed = [];
  for (const step of plan.steps) {
    executed.push({ script: step.script, command: step.command });
    const result = spawnSync(step.command[0], step.command.slice(1), { cwd: repoRoot, stdio: "pipe", encoding: "utf8" });
    const stdout = String(result.stdout || "");
    const stderr = String(result.stderr || "");
    if (result.status !== 0) {
      return { ok: false, executed, error: "child_failed", stdout, stderr };
    }
    return { ok: true, executed, stdout };
  }
  return { ok: true, executed };
}

function main() {
  let args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  args = loadSpecOverrides(args);
  requireHighRiskConfirmations(args);

  if (!args.confirm) {
    printJson({ ok: true, dryRun: true, wizard: buildWizardMenu() });
    return 0;
  }

  const plan = planPreset(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, preset: args.preset, plan });
    return 0;
  }
  const result = runPlan(plan);
  printJson(result, result.ok ? process.stdout : process.stderr);
  return result.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

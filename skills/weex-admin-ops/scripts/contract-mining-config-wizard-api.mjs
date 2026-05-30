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
  node skills/weex-admin-ops/scripts/contract-mining-config-wizard-api.mjs --wizard

  # Step 2: execute after confirmation (spec required)
  node skills/weex-admin-ops/scripts/contract-mining-config-wizard-api.mjs --spec-file ./tmp/contract-mining-spec.json --confirm

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
  for (const key of required) {
    if (args.confirmations[key] !== true) throw new Error(`高风险确认未完成：confirmations.${key} 需要为 true。`);
  }
}

function loadModuleNameMap() {
  const filePath = path.join(repoRoot, "skills/weex-admin-ops/references/mappings/contract-mining-activity-modules.md");
  if (!fs.existsSync(filePath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(filePath, "utf8");
  const lines = md.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.includes("| 模块 key |") && line.includes("| 前端中文名 |"));
  if (headerIndex < 0) return { source: "missing", map: {} };
  const map = {};
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const parts = line.split("|").map(v => v.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    map[parts[0].replace(/`/g, "")] = parts[1];
  }
  return { source: "references/mappings/contract-mining-activity-modules.md", map };
}

function loadFieldNameMap() {
  const filePath = path.join(repoRoot, "skills/weex-admin-ops/references/mappings/contract-mining-activity-fields.md");
  if (!fs.existsSync(filePath)) return { source: "missing", map: {} };
  const md = fs.readFileSync(filePath, "utf8");
  const lines = md.split(/\r?\n/);
  const headerIndex = lines.findIndex(line => line.includes("| 字段 key |") && line.includes("| 前端中文名 |"));
  if (headerIndex < 0) return { source: "missing", map: {} };
  const map = {};
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const parts = line.split("|").map(v => v.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    map[parts[0].replace(/`/g, "")] = parts[1];
  }
  return { source: "references/mappings/contract-mining-activity-fields.md", map };
}

function wizardReplyTemplate() {
  return {
    specVersion: 1,
    confirm: false,
    preset: "full_create_verify_delete",
    cleanup: true,
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
    titlePrefix: "合约挖矿全配",
    aliasPrefix: "cm",
    activityAlias: "",
    activityId: "",
    dryRun: true,
  };
}

function wizardOutput() {
  const moduleNameMap = loadModuleNameMap();
  const fieldNameMap = loadFieldNameMap();
  const oneShotReplyTemplate = wizardReplyTemplate();
  return {
    domain: "活动列表 / 合约挖矿活动(CONTRACT_MINING) API 向导（进行中）",
    moduleNameMap: moduleNameMap.map,
    moduleNameMapSource: moduleNameMap.source,
    fieldNameMap: fieldNameMap.map,
    fieldNameMapSource: fieldNameMap.source,
    presets: [
      { preset: "full_create_verify_delete", risk: "高", description: "显式创建依赖项(报名模板/活动任务) -> 创建草稿 -> draft-checks -> 删除清理（默认开启 cleanup）" },
      { preset: "full_create_full_verify_delete", risk: "高", description: "显式创建依赖项 -> 创建草稿 -> draft-checks -> 上线 -> 下线 -> 删除清理（需要更高风险确认）" },
      { preset: "create_draft", risk: "高", description: "仅创建草稿（clone 模板 + 覆盖 title/alias/time）" },
      { preset: "online", risk: "高", description: "上线指定合约挖矿活动（/activity/mining/online）" },
      { preset: "offline", risk: "高", description: "下线指定合约挖矿活动（/activity/mining/offline）" },
      { preset: "delete", risk: "高", description: "删除指定合约挖矿活动（/activity/mining/delete）" },
    ],
    confirmationRequired: ["活动标题/别名(showUrl)", "活动开始/结束时间", "依赖项写入（报名模板/活动任务）", "上线/下线/删除等写操作"],
    oneShotReplyTemplate,
    notes: [
      "full_create_* 会显式创建依赖项（报名模板/活动任务）并在 cleanup 时一并删除，避免污染 staging。",
      "模块级自由配置脚本：contract-mining-activity-module-config-fast-api.mjs（snapshot -> spec -> update）。",
    ],
  };
}

function planPreset(args) {
  if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行写操作。");
  const preset = String(args.preset || "");
  const node = process.execPath;
  const base = "skills/weex-admin-ops/scripts/contract-mining-activity-fast-api.mjs";

  if (preset === "full_create_verify_delete") {
    const full = "skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs";
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
    const full = "skills/weex-admin-ops/scripts/create-contract-mining-full-config-explicit-deps-fast-api.mjs";
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
            "--start-offset-seconds",
            String(args.startOffsetSeconds ?? 120),
            "--end-days",
            String(args.endDays ?? 7),
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
          command: [
            node,
            base,
            "--action",
            preset,
            ...(args.activityId ? ["--activity-id", args.activityId] : []),
            ...(args.activityAlias ? ["--activity-alias", args.activityAlias] : []),
          ],
        },
      ],
    };
  }
  throw new Error(`Unknown preset: ${preset}`);
}

function execSteps(steps, { dryRun } = {}) {
  for (const step of steps) {
    const res = spawnSync(step.command[0], step.command.slice(1), { cwd: repoRoot, env: process.env, encoding: "utf8" });
    if (dryRun) continue;
    if (res.status !== 0) {
      const errText = (res.stderr || "").trim() || (res.stdout || "").trim();
      throw new Error(`Preset step failed (${step.script}): ${errText || "unknown error"}`);
    }
  }
}

async function run() {
  const raw = parseArgs();
  if (raw.help) {
    process.stdout.write(usage());
    return 0;
  }

  const args = loadSpecOverrides(raw);
  const isWizard = args.wizard || !args.confirm;
  if (isWizard) {
    printJson({ ok: true, mode: "headless_api", wizard: wizardOutput() });
    return 0;
  }

  requireHighRiskConfirmations(args);
  const planned = planPreset(args);
  const printable = planned.steps.map(s => ({ script: s.script, command: s.command.join(" ") }));
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, planned: printable });
    return 0;
  }

  execSteps(planned.steps, { dryRun: false });
  printJson({ ok: true, mode: "headless_api", executed: printable });
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}

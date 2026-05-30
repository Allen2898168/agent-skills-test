#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { pathsFrom } from "./lib/runtime.mjs";
import { loadLotteryRaffleStyleCatalog, loadLotterySupportedTasksCatalog } from "./lib/catalogs.mjs";
import { loadMarkdownTableMap } from "./lib/mapping-md.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # Step 1: show supported modules/types (no writes)
  node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --wizard

  # Step 2: execute after confirmation
  node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm

  # Optional: provide a spec file (recommended) for one-shot config
  node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm

Options:
  --wizard                 print capability menu only (default when --confirm is not set)
  --confirm                required for any write/preset execution
  --spec-file <path>       optional JSON file; when present, overrides flags
  --spec-json <json>       optional JSON string; when present, overrides flags
  --preset <name>          default_universal | regression_main | create_draft | online | offline
  --title-prefix <text>    used by regression_main / create_draft
  --alias-prefix <text>    used by regression_main / create_draft
  --template-alias <alias> used by create_draft (default from lottery-activity-fast-api)
  --raffle-style <style>   used by create_draft; see --wizard output for allowed styles
  --uid <uid>              used by default_universal/regression_main task defaults (agent/user scope)
  --country <text>         used by default_universal/regression_main task defaults (country scope)
  --activity-alias <alias> used by online/offline
  --activity-id <id>       used by online/offline
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
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "";
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "";
  args.raffleStyle = args.raffleStyle ? String(args.raffleStyle) : "";
  args.uid = args.uid ? String(args.uid) : "";
  args.country = args.country ? String(args.country) : "";
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

function extractRaffleStyles(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/lottery/components/styleForm.vue");
  const text = readFileSafe(filePath);
  const styles = [];
  const re = /value:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g;
  for (const match of text.matchAll(re)) {
    styles.push({ value: match[1], label: match[2] });
  }
  return { filePath, styles };
}

function extractLotteryTasks(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/const/index.js");
  const text = readFileSafe(filePath);
  const blockMatch = text.match(/export const LOTTERY_TASKS\s*=\s*pick\s*\(\s*supportedTasks\s*,\s*\[\s*([\s\S]*?)\]\s*\)/);
  const keys = [];
  if (blockMatch?.[1]) {
    const keyRe = /'([A-Z0-9_]+)'/g;
    for (const match of blockMatch[1].matchAll(keyRe)) keys.push(match[1]);
  }
  const labelByKey = {};
  for (const key of keys) {
    const re = new RegExp(`${key}\\s*:\\s*\\{\\s*label\\s*:\\s*'([^']+)'\\s*,\\s*value\\s*:\\s*'${key}'`, "m");
    const hit = text.match(re);
    labelByKey[key] = hit?.[1] || "";
  }
  const tasks = keys.map(key => ({ key, label: labelByKey[key] || key }));
  return { filePath, tasks };
}

function extractLotteryPayloadKeys(activityWebDir) {
  const filePath = path.join(activityWebDir, "activity-ui/src/views/activity/lottery/addAndEdit.vue");
  const text = readFileSafe(filePath);
  const start = text.indexOf("const params");
  if (start < 0) return { filePath, keys: [] };
  const braceStart = text.indexOf("{", start);
  if (braceStart < 0) return { filePath, keys: [] };
  const endMarker = "submitLoading.value = true";
  const end = text.indexOf(endMarker, braceStart);
  if (end < 0) return { filePath, keys: [] };
  const chunk = text.slice(braceStart + 1, end);
  const closingBrace = chunk.lastIndexOf("}");
  const inner = closingBrace >= 0 ? chunk.slice(0, closingBrace) : chunk;
  const keys = new Set();
  for (const rawLine of inner.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("...")) continue;
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

function lotteryModules() {
  return [
    { key: "base", label: "活动基本信息(BaseForm)", risk: "高" },
    { key: "style", label: "抽奖样式(StyleForm)", risk: "高" },
    { key: "prize", label: "抽奖奖品配置(PrizeConfigForm)", risk: "高" },
    { key: "prizeWeight", label: "奖品权重配置(PrizeWeightForm)", risk: "中" },
    { key: "colorTag", label: "奖品标记权重(ColorTagConfigForm)", risk: "中" },
    { key: "share", label: "分享配置(ShareInfoForm)", risk: "中" },
    { key: "dailyLimit", label: "每日限量(DailyLimitForm)", risk: "中" },
    { key: "probability", label: "概率配置(PrizeProbabilityForm)", risk: "中" },
    { key: "tasks", label: "活动任务(ActivityTaskForm)", risk: "高" },
    { key: "i18n", label: "多语言(I18nConfigForm)", risk: "中" },
    { key: "faq", label: "FAQ(FAQForm)", risk: "低" },
    { key: "calendar", label: "活动日历(ActivityCalendarConfig)", risk: "中" },
  ];
}

function buildWizardMenu() {
  const raffle = loadLotteryRaffleStyleCatalog(repoRoot);
  const tasks = loadLotterySupportedTasksCatalog(repoRoot);
  const moduleNameMap = loadMarkdownTableMap({
    repoRoot,
    fileRelPath: "skills/weex-admin-ops/references/mappings/lottery-activity-modules.md",
    sourceRelPath: "references/mappings/lottery-activity-modules.md",
    keyColumnName: "模块 key",
    valueColumnName: "前端中文名",
  });
  const fieldNameMap = loadMarkdownTableMap({
    repoRoot,
    fileRelPath: "skills/weex-admin-ops/references/mappings/lottery-activity-fields.md",
    sourceRelPath: "references/mappings/lottery-activity-fields.md",
    keyColumnName: "字段 key",
    valueColumnName: "前端中文名",
  });

  const oneShotReplyTemplate = {
    specVersion: 1,
    confirm: false,
    preset: "default_universal",
    confirmations: {
      activityTitleAndAlias: false,
      activityTimeWindow: false,
      raffleStyle: false,
      dependencyWrites: false,
      onlineOfflineWrites: false,
    },
    titlePrefix: "后管配置",
    aliasPrefix: "ln",
    uid: "9881271952",
    country: "中国",
    templateAlias: "",
    raffleStyle: "",
    activityAlias: "",
    activityId: "",
    desiredModules: ["base", "style", "prize", "prizeWeight", "colorTag", "share", "dailyLimit", "probability", "tasks", "i18n", "faq", "calendar"],
    dryRun: true,
  };

  const dependencyDefaults = [
    {
      id: "create_regression_prizes",
      description: "创建回归用稳定奖品（赠金/币种/实物/虚拟资格等）",
      script: "skills/weex-admin-ops/scripts/create-regression-prizes-fast-api.mjs",
    },
    {
      id: "create_register_templates",
      description: "创建回归用报名模板（含多 signupMode 分支）",
      script: "skills/weex-admin-ops/scripts/create-register-templates-fast-api.mjs",
    },
    {
      id: "create_roulette_tasks",
      description: "创建转盘抽奖任务（参与范围分支；含 agent/user/country scope）",
      script: "skills/weex-admin-ops/scripts/create-roulette-participant-scope-tasks-fast-api.mjs",
      requiredParams: ["uid", "country"],
      defaults: { uid: "9881271952", country: "中国" },
    },
    {
      id: "create_roulette_condition_tasks",
      description: "创建转盘抽奖任务（条件分支：KOL/合约/现货/充值）",
      script: "skills/weex-admin-ops/scripts/create-roulette-condition-tasks-fast-api.mjs",
    },
    {
      id: "create_roulette_reward_mode_tasks",
      description: "创建转盘抽奖任务（奖励模式分支：limited/rights）",
      script: "skills/weex-admin-ops/scripts/create-roulette-reward-mode-tasks-fast-api.mjs",
    },
  ];

  return {
    lottery: {
      modules: lotteryModules(),
      moduleNameMap: moduleNameMap.map,
      moduleNameMapSource: moduleNameMap.source,
      fieldNameMap: fieldNameMap.map,
      fieldNameMapSource: fieldNameMap.source,
      raffleStyles: raffle.styles,
      raffleStylesSource: raffle.source,
      supportedTasks: tasks.tasks,
      supportedTasksSource: tasks.source,
      sources: {
        moduleNameMapFrom: moduleNameMap.source,
        fieldNameMapFrom: fieldNameMap.source,
        raffleStylesFrom: raffle.source,
        supportedTasksFrom: tasks.source,
      },
      dependencyDefaults,
      defaultUniversalConfig: {
        name: "default_universal",
        description: "默认通用配置（无头 API）= 创建依赖奖品/报名模板/任务 + 创建草稿 + 上线 + 校验 + 下线",
        confirmBehavior: "需要使用一次性模板把 confirmations 全部置为 true 后再执行",
        command: "node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm",
      },
      confirmationRequired: [
        "活动标题/别名(showUrl)",
        "活动开始/结束时间",
        "抽奖样式(raffleStyle)",
        "依赖创建（奖品/报名模板/任务等）",
        "奖品池(8个位置)与权重总和=100",
        "活动任务(taskConfig)选择与排序",
        "是否上线/下线/删除等写操作",
      ],
      presets: [
        {
          preset: "default_universal",
          description: "推荐：默认通用配置（无头 API）= 创建依赖奖品/报名模板/任务 + 创建草稿 + 上线 + 校验 + 下线",
          command: "node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm",
        },
        {
          preset: "regression_main",
          description: "同 default_universal（兼容旧名称）",
          command: "node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm",
        },
        {
          preset: "create_draft",
          description: "仅创建转盘抽奖草稿（通过模板 clone；可选覆盖 raffleStyle）",
          command: "node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm  # set preset=create_draft",
        },
        {
          preset: "online",
          description: "上线指定转盘抽奖活动",
          command: "node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm  # set preset=online + activityAlias/activityId",
        },
        {
          preset: "offline",
          description: "下线指定转盘抽奖活动",
          command: "node skills/weex-admin-ops/scripts/lottery-config-wizard-api.mjs --spec-file ./tmp/lottery-spec.json --confirm  # set preset=offline + activityAlias/activityId",
        },
      ],
      oneShotReplyTemplate,
      oneShotReplyTemplateNotes: [
        "把 confirm 改为 true 表示同意执行写操作。",
        "需要把 confirmations 下对应的高风险开关都置为 true（否则会拒绝执行写操作）。",
        "preset=default_universal 推荐；如果只想上线/下线/建草稿，改 preset 并补齐 activityAlias/activityId 或 templateAlias。",
      ],
    },
  };
}

function runPreset(args) {
  if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行写操作。");
  if (!args.preset) throw new Error("--preset is required when --confirm is set");

  const node = process.execPath;
  const preset = args.preset;

  if (preset === "default_universal" || preset === "regression_main") {
    const cmd = [
      "skills/weex-admin-ops/scripts/lottery-admin-main-regression.mjs",
      ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []),
      ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : []),
      ...(args.uid ? ["--uid", args.uid] : []),
      ...(args.country ? ["--country", args.country] : []),
    ];
    return { script: cmd[0], command: [node, ...cmd] };
  }

  if (preset === "create_draft") {
    const cmd = [
      "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
      "--action",
      "create-draft",
      ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []),
      ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []),
      ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : []),
      ...(args.raffleStyle ? ["--raffle-style", args.raffleStyle] : []),
    ];
    return { script: cmd[0], command: [node, ...cmd] };
  }

  if (preset === "online" || preset === "offline") {
    const action = preset === "online" ? "online" : "offline";
    if (!args.activityAlias && !args.activityId) throw new Error("--activity-alias/--activity-id is required for online/offline");
    const cmd = [
      "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs",
      "--action",
      action,
      ...(args.activityAlias ? ["--activity-alias", args.activityAlias] : []),
      ...(args.activityId ? ["--activity-id", args.activityId] : []),
    ];
    return { script: cmd[0], command: [node, ...cmd] };
  }

  throw new Error(`Unknown preset: ${preset}`);
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
    titlePrefix: String(spec.titlePrefix ?? args.titlePrefix ?? ""),
    aliasPrefix: String(spec.aliasPrefix ?? args.aliasPrefix ?? ""),
    uid: String(spec.uid ?? args.uid ?? ""),
    country: String(spec.country ?? args.country ?? ""),
    templateAlias: String(spec.templateAlias ?? args.templateAlias ?? ""),
    raffleStyle: String(spec.raffleStyle ?? args.raffleStyle ?? ""),
    activityAlias: String(spec.activityAlias ?? args.activityAlias ?? ""),
    activityId: String(spec.activityId ?? args.activityId ?? ""),
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
    preset === "online" || preset === "offline"
      ? ["onlineOfflineWrites"]
      : preset === "create_draft"
        ? ["activityTitleAndAlias", "activityTimeWindow", ...(args.raffleStyle ? ["raffleStyle"] : [])]
        : ["activityTitleAndAlias", "activityTimeWindow", "raffleStyle", "dependencyWrites", "onlineOfflineWrites"];
  const missing = required.filter(key => args.confirmations?.[key] !== true);
  if (missing.length) throw new Error(`高风险确认未完成：${missing.join(", ")}`);
}

function main() {
  let args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  args = loadSpecOverrides(args);
  requireHighRiskConfirmations(args);

  const wizard = buildWizardMenu();

  if (!args.confirm) {
    printJson({ ok: true, dryRun: true, wizard });
    return 0;
  }

  const { script, command } = runPreset(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, preset: args.preset, script, command });
    return 0;
  }
  const result = spawnSync(command[0], command.slice(1), { cwd: repoRoot, stdio: "inherit" });
  return result.status ?? 1;
}

try {
  process.exitCode = main();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

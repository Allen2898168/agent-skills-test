#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { pathsFrom } from "./lib/runtime.mjs";
import { ensureActivityWebDir, extractSpeedRaceModuleNameMap } from "./lib/activity-web-mappings.mjs";

const { repoRoot } = pathsFrom(import.meta.url);
const DEFAULT_IMAGE = "https://s3.weexstg.com/otc/images/commonFile/0bc69943370645596e200bdff7d653dc481591a50f60892bdc08c3c107b9f1ee.webp";
const DEFAULT_RULE_HTML = "<p>自动化交易竞速赛规则</p>";

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

function extractVueFormFields(activityWebDir, relPath) {
  const filePath = path.join(activityWebDir, relPath);
  const text = readFileSafe(filePath);
  const props = new Set();
  const models = new Set();
  for (const match of text.matchAll(/prop\s*=\s*"([A-Za-z0-9_]+)"/g)) props.add(match[1]);
  for (const match of text.matchAll(/v-model\s*=\s*"[^"]*?([A-Za-z0-9_]+)"/g)) models.add(match[1]);
  return { filePath, props: Array.from(props).sort(), formModels: Array.from(models).sort() };
}

export function buildWizardMenu(activityWebDir) {
  const { moduleNameMap } = extractSpeedRaceModuleNameMap(activityWebDir);
  return {
    domain: "活动列表 / 交易竞速赛(RACE_COMPETITION)",
    mode: "headless_api_only",
    supportedModules: [
      { key: "base", label: moduleNameMap.base || "交易竞速赛基本信息", risk: "高" },
      { key: "userApply", label: moduleNameMap.userApply || "用户报名", risk: "高" },
      { key: "speedConfig", label: moduleNameMap.speedConfig || "竞速配置", risk: "高" },
      { key: "prizePool", label: moduleNameMap.prizePool || "奖池配置", risk: "高" },
      { key: "leaderboard", label: moduleNameMap.leaderboard || "排行榜配置", risk: "中" },
      { key: "pageSetting", label: moduleNameMap.pageSetting || "活动页面设置", risk: "低" },
      { key: "i18n", label: moduleNameMap.i18n || "多语言", risk: "中" },
      { key: "faq", label: moduleNameMap.faq || "常见问题", risk: "低" },
    ],
    uiModuleFields: {
      base: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/speedRace/components/baseInfo.vue"),
      speedConfig: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/speedRace/components/speedConfig.vue"),
      prizePool: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/speedRace/components/prizePoolConfig.vue"),
      leaderboard: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/speedRace/components/leaderboardConfig.vue"),
      pageSetting: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/competition/components/pageSetting.vue"),
      i18n: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/competition/components/langContentSetting.vue"),
      faq: extractVueFormFields(activityWebDir, "activity-ui/src/views/activity/lottery/components/FAQForm.vue"),
    },
    presets: [
      { preset: "minimal_create_verify_delete", description: "创建草稿 -> 压成最小配置 -> 回查 -> 删除" },
      { preset: "full_create_verify_delete", description: "创建草稿 -> 应用最全配置 -> 回查 -> 删除" },
      { preset: "create_draft", description: "仅创建竞速赛草稿" },
      { preset: "online", description: "上线指定竞速赛活动" },
      { preset: "offline", description: "下线指定竞速赛活动" },
      { preset: "delete", description: "删除指定竞速赛活动" },
    ],
    oneShotReplyTemplate: {
      specVersion: 1,
      confirm: false,
      preset: "minimal_create_verify_delete",
      confirmations: {
        templateClone: false,
        moduleWrites: false,
        onlineOfflineDeleteWrites: false,
      },
      templateAlias: "",
      templateId: "",
      titlePrefix: "竞速赛回归",
      aliasPrefix: "sr",
      activityAlias: "",
      activityId: "",
      cleanup: true,
      dryRun: true,
    },
  };
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
    confirmations: spec.confirmations || null,
  };
}

function requireHighRiskConfirmations(args) {
  if (!args.confirm) return;
  if (!args.confirmations || typeof args.confirmations !== "object") {
    throw new Error("需要 confirmations：请先用 --wizard 输出的一次性模板填写 confirmations 并用 --spec-json/--spec-file 执行。");
  }
  const preset = String(args.preset || "");
  const required = ["online", "offline", "delete"].includes(preset)
    ? ["onlineOfflineDeleteWrites"]
    : ["templateClone", "moduleWrites", "onlineOfflineDeleteWrites"];
  const missing = required.filter(key => args.confirmations?.[key] !== true);
  if (missing.length) throw new Error(`高风险确认未完成：${missing.join(", ")}`);
}

function parseStepResult(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function runNodeStep(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const payload = parseStepResult(result.stdout) || parseStepResult(result.stderr) || {};
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    payload,
  };
}

function buildMinimalModuleSpec(detail) {
  const applyConfigId = detail?.applyConfigId ?? 2442;
  return {
    confirm: true,
    confirmations: { moduleWrites: true },
    modules: {
      base: {
        showCountdown: "MANUAL",
        isPreApply: 0,
        showActivityCalendar: 1,
      },
      userApply: {
        applyConfigId,
      },
      speedConfig: {
        rankType: "TRADING",
        currencySupportType: "ALL_SUPPORTED",
        productCodeList: [],
      },
      prizePool: {
        poolType: "FIXED",
        isParticipantsNum: 0,
        isTotalPricePoolAmount: 0,
        totalPricePoolAmount: null,
      },
      leaderboard: {
        isShow: 0,
      },
      pageSetting: {
        ogImageUrl: detail?.ogImageUrl || DEFAULT_IMAGE,
      },
      i18n: {
        activityConfigI18n: [{
          lang: "zh_CN",
          title: detail?.title || "交易竞速赛-最小配置",
          subTitle: "最小配置回归",
          shareContent: "最小配置分享文案",
          agentShareContent: "最小配置代理文案",
          raceShareContent: "最小配置竞速区文案",
          intro: DEFAULT_RULE_HTML,
          webBannerUrl: DEFAULT_IMAGE,
          appBannerUrl: DEFAULT_IMAGE,
          webShareUrl: DEFAULT_IMAGE,
          appShareUrl: DEFAULT_IMAGE,
          webScoreUrl: DEFAULT_IMAGE,
          appScoreUrl: DEFAULT_IMAGE,
        }],
      },
      faq: {
        questions: [{
          lang: "cn",
          list: [{ title: "最小FAQ", content: "<p>最小FAQ内容</p>" }],
        }],
      },
    },
  };
}

function buildFullModuleSpec(detail) {
  const applyConfigId = detail?.applyConfigId ?? 2442;
  return {
    confirm: true,
    confirmations: { moduleWrites: true },
    modules: {
      base: {
        showCountdown: "MANUAL",
        isPreApply: 0,
        showActivityCalendar: 1,
      },
      userApply: {
        applyConfigId,
      },
      speedConfig: {
        rankType: "TRADING",
        currencySupportType: "PARTIALLY_SUPPORT",
        productCodeList: ["BTC-USDT", "ETH-USDT"],
      },
      prizePool: {
        poolType: "FIXED",
        isParticipantsNum: 1,
        isTotalPricePoolAmount: 1,
        totalPricePoolAmount: 88.88,
      },
      leaderboard: {
        isShow: 1,
        minRank: 1,
        maxRank: 10,
      },
      pageSetting: {
        ogImageUrl: detail?.ogImageUrl || DEFAULT_IMAGE,
      },
      i18n: {
        activityConfigI18n: [
          {
            lang: "zh_CN",
            title: detail?.title || "交易竞速赛-全配置",
            subTitle: "全配置回归",
            shareContent: "全配置分享文案",
            agentShareContent: "全配置代理文案",
            raceShareContent: "全配置竞速区文案",
            intro: DEFAULT_RULE_HTML,
            webBannerUrl: DEFAULT_IMAGE,
            appBannerUrl: DEFAULT_IMAGE,
            webShareUrl: DEFAULT_IMAGE,
            appShareUrl: DEFAULT_IMAGE,
            webScoreUrl: DEFAULT_IMAGE,
            appScoreUrl: DEFAULT_IMAGE,
          },
          {
            lang: "en_US",
            title: "Speed Race Full Config",
            subTitle: "Full config regression",
            shareContent: "Full config share copy",
            agentShareContent: "Full config agent copy",
            raceShareContent: "Full config race zone copy",
            intro: "<p>Full config race rule</p>",
            webBannerUrl: DEFAULT_IMAGE,
            appBannerUrl: DEFAULT_IMAGE,
            webShareUrl: DEFAULT_IMAGE,
            appShareUrl: DEFAULT_IMAGE,
            webScoreUrl: DEFAULT_IMAGE,
            appScoreUrl: DEFAULT_IMAGE,
          },
        ],
      },
      faq: {
        questions: [
          { lang: "cn", list: [{ title: "全配FAQ", content: "<p>全配FAQ内容</p>" }] },
          { lang: "en", list: [{ title: "Full FAQ", content: "<p>Full FAQ content</p>" }] },
        ],
      },
    },
  };
}

function ensureStepOk(stepName, result) {
  if ((result.exitCode ?? 1) !== 0 || result.payload?.ok === false) {
    throw new Error(`${stepName} failed: ${result.stderr || JSON.stringify(result.payload)}`);
  }
}

function planPreset(args) {
  if (!args.confirm) throw new Error("需要用户确认：请加 --confirm 后才允许执行写操作。");
  const preset = String(args.preset || "");
  const base = "skills/weex-admin-ops/scripts/race-activity-fast-api.mjs";
  const moduleScript = "skills/weex-admin-ops/scripts/race-activity-module-config-fast-api.mjs";
  if (["minimal_create_verify_delete", "full_create_verify_delete", "create_draft"].includes(preset)) {
    if (!args.templateAlias && !args.templateId) throw new Error(`${preset} requires templateAlias/templateId`);
  }
  if (["online", "offline", "delete"].includes(preset) && !args.activityAlias && !args.activityId) {
    throw new Error(`${preset} requires activityAlias/activityId`);
  }
  if (preset === "minimal_create_verify_delete" || preset === "full_create_verify_delete") {
    return {
      preset,
      steps: [
        { name: "create-draft", script: base, args: ["--action", "create-draft", ...(args.templateId ? ["--template-id", args.templateId] : []), ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []), ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []), ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : [])] },
        { name: "update-modules", script: moduleScript, args: ["--action", "update"] },
        { name: "draft-checks", script: base, args: ["--action", "draft-checks"] },
      ],
      cleanup: Boolean(args.cleanup),
    };
  }
  if (preset === "create_draft") {
    return {
      preset,
      steps: [
        { name: "create-draft", script: base, args: ["--action", "create-draft", ...(args.templateId ? ["--template-id", args.templateId] : []), ...(args.templateAlias ? ["--template-alias", args.templateAlias] : []), ...(args.titlePrefix ? ["--title-prefix", args.titlePrefix] : []), ...(args.aliasPrefix ? ["--alias-prefix", args.aliasPrefix] : [])] },
      ],
      cleanup: false,
    };
  }
  if (["online", "offline", "delete"].includes(preset)) {
    return {
      preset,
      steps: [
        { name: preset, script: base, args: ["--action", preset, ...(args.activityAlias ? ["--activity-alias", args.activityAlias] : []), ...(args.activityId ? ["--activity-id", args.activityId] : [])] },
      ],
      cleanup: false,
    };
  }
  throw new Error(`Unknown preset: ${preset || "<missing>"}`);
}

function main() {
  let args = parseArgs();
  const activityWebDir = ensureActivityWebDir(repoRoot);
  args = loadSpecOverrides(args);
  if (args.wizard || !args.confirm) {
    printJson({ ok: true, mode: "headless_api", wizard: buildWizardMenu(activityWebDir) });
    return 0;
  }
  requireHighRiskConfirmations(args);
  const plan = planPreset(args);
  if (args.dryRun) {
    printJson({ ok: true, mode: "headless_api", dryRun: true, plan });
    return 0;
  }

  const results = [];
  let created = null;
  for (const step of plan.steps) {
    if (step.name === "update-modules") {
      if (!created?.activityId) throw new Error("create-draft result missing activityId");
      const inspectRes = runNodeStep([
        path.join(repoRoot, "skills/weex-admin-ops/scripts/race-activity-fast-api.mjs"),
        "--action",
        "inspect-template",
        "--activity-id",
        String(created.activityId),
      ]);
      ensureStepOk("inspect-template", inspectRes);
      const inspectSummary = inspectRes.payload?.summary || {};
      const spec = plan.preset === "minimal_create_verify_delete"
        ? buildMinimalModuleSpec(inspectSummary)
        : buildFullModuleSpec(inspectSummary);
      const result = runNodeStep([
        path.join(repoRoot, step.script),
        ...step.args,
        "--activity-id",
        String(created.activityId),
        "--spec-json",
        JSON.stringify(spec),
        "--confirm",
      ]);
      ensureStepOk(step.name, result);
      results.push({ name: step.name, ...result.payload });
      continue;
    }

    const extraArgs = [];
    if (created?.activityId && step.name === "draft-checks") {
      extraArgs.push("--activity-id", String(created.activityId));
    }
    const result = runNodeStep([path.join(repoRoot, step.script), ...step.args, ...extraArgs]);
    ensureStepOk(step.name, result);
    results.push({ name: step.name, ...result.payload });
    if (step.name === "create-draft") created = result.payload;
  }

  if (plan.cleanup && created?.activityId) {
    const cleanupRes = runNodeStep([
      path.join(repoRoot, "skills/weex-admin-ops/scripts/race-activity-fast-api.mjs"),
      "--action",
      "delete",
      "--activity-id",
      String(created.activityId),
    ]);
    ensureStepOk("cleanup-delete", cleanupRes);
    results.push({ name: "cleanup-delete", ...cleanupRes.payload });
  }

  printJson({ ok: true, mode: "headless_api", plan, results });
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    process.exitCode = main();
  } catch (error) {
    printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
    process.exitCode = 1;
  }
}

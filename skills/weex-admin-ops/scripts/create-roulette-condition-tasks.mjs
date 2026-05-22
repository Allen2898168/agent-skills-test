#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { bodyText, loginToTaskPage, watchTaskResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createRouletteConditionTasks } from "./business/activity-task-management/roulette-condition-create.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

const CONDITION_DEFS = {
  kol: { label: "KOL绑定", slug: "kol", shortTag: "kol" },
  contract: { label: "合约交易量", slug: "contract", shortTag: "ctr", compareValue: "100" },
  spot: { label: "现货交易量", slug: "spot", shortTag: "spt", compareValue: "100", firstTrade: "否", allowFailure: true },
  recharge: { label: "充值任务", slug: "recharge", shortTag: "rch", compareValue: "100", firstRecharge: "否", freezeDays: "1" },
};

function usage() {
  return `Usage:
  node scripts/create-roulette-condition-tasks.mjs --conditions kol,contract,spot,recharge

Required environment:
  WEEX_ADMIN_PASSWORD       staging password
  WEEX_ADMIN_GOOGLE_CODE    Google Authenticator code

Options:
  --conditions <csv>        kol,contract,spot,recharge; default all
  --name-prefix <text>      default: 转盘抽奖
  --reward-min <n>          default: 10
  --reward-max <n>          default: 100
  --daily-limit <n>         default: 5
  --total-limit <n>         default: 50
  --visible                 open a headed browser so the tester can watch
  --dry-run                 print planned tasks without opening browser
  --help                    show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), {
    booleans: ["--visible", "--dry-run"],
  });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  return args;
}

function parseConditions(value) {
  if (!value || value === "all") return ["kol", "contract", "spot", "recharge"];
  const conditions = String(value).split(",").map(item => item.trim()).filter(Boolean);
  const bad = conditions.filter(item => !CONDITION_DEFS[item]);
  if (bad.length) throw new Error(`Unknown --conditions value: ${bad.join(", ")}`);
  return conditions;
}

function buildPlan(args) {
  const ts = timestamp();
  return parseConditions(args.conditions).map(condition => {
    const def = CONDITION_DEFS[condition];
    return {
      condition,
      taskCondition: def.label,
      name: `${args.namePrefix || "转盘抽奖"}_${def.slug}_${ts}`,
      content: args.content || `自动化任务条件任务-${def.label}`,
      tag: args.tag || `rc${def.shortTag}${String(ts).slice(-5)}`,
      remark: args.remark || `自动化-${def.label}`,
      enName: args.enName || `Roulette condition ${def.slug} ${ts}`,
      enContent: args.enContent || `Automated roulette condition task ${def.slug}`,
      enTag: args.enTag || `rc${def.shortTag}${String(ts).slice(-5)}`,
      rewardMode: "单一奖励",
      rewardType: "正常奖励",
      rewardMin: args.rewardMin || "10",
      rewardMax: args.rewardMax || "100",
      dailyLimit: args.dailyLimit || "5",
      totalLimit: args.totalLimit || "50",
      compareValue: def.compareValue || "",
      firstTrade: def.firstTrade || "",
      firstRecharge: def.firstRecharge || "",
      freezeDays: def.freezeDays || "",
      allowFailure: Boolean(def.allowFailure),
    };
  });
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = buildPlan(args);
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, visible: args.visible, plan });
    return 0;
  }
  assertAdminConfig(config);
  const { chromium } = loadPlaywright();
  const responses = [];
  const created = [];
  const blocked = [];
  const browser = await chromium.launch({
    headless: !args.visible,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  watchTaskResponses(page, responses);
  try {
    await loginToTaskPage(page, config);
    created.push(...await createRouletteConditionTasks(page, config, plan));
    blocked.push(...created.filter(item => item?.blocked));
    printJson({
      ok: true,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      created,
      blocked,
      evidence: { responses },
    });
    return 0;
  } catch (error) {
    printJson({
      ok: false,
      mode: args.visible ? "visible_browser" : "invisible_browser",
      finalUrl: page.url(),
      error: error.message,
      created,
      responses,
      pageText: (await bodyText(page)).slice(0, 1000),
    }, process.stderr);
    return 1;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

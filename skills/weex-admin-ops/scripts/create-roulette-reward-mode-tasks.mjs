#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { bodyText, loginToTaskPage, watchTaskResponses } from "./lib/browser.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import { createRouletteRewardModeTasks } from "./business/activity-task-management/roulette-reward-mode-create.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/create-roulette-reward-mode-tasks.mjs
  node scripts/create-roulette-reward-mode-tasks.mjs --modes limited,rights --visible

Options:
  --modes <csv>            limited,rights; default both
  --visible                open a headed browser so the tester can watch
  --dry-run                print the planned reward-mode tasks without opening browser
  --help                   show this message
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--visible", "--dry-run"] });
  args.visible = Boolean(args.visible);
  args.dryRun = Boolean(args.dryRun);
  args.modes = String(args.modes || "limited,rights")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return args;
}

function buildPlan(args) {
  const ts = timestamp();
  const definitions = {
    limited: {
      key: "limited",
      name: `转盘抽奖_limited_${ts}`,
      content: "自动化奖励模式任务-限时奖励不同",
      tag: `rlmt${String(ts).slice(-5)}`,
      remark: "自动化-限时奖励不同",
      enName: `Roulette limited ${ts}`,
      enContent: "Automated limited reward roulette task",
      enTag: `rlmt${String(ts).slice(-5)}`,
      taskCondition: "KOL绑定",
      rewardMode: "限时奖励不同",
      rewardValue: "1",
      limitedStartTime: "用户报名时间",
      rewardCountdown: "1",
      rewardChange: "+",
      rewardChangeValue: "1",
      rewardMin: "10",
      rewardMax: "100",
      dailyLimit: "5",
      totalLimit: "50",
    },
    rights: {
      key: "rights",
      name: `转盘抽奖_rights_${ts}`,
      content: "自动化奖励模式任务-正常奖励权益奖励",
      tag: `rrgt${String(ts).slice(-5)}`,
      remark: "自动化-正常奖励+权益奖励",
      enName: `Roulette rights ${ts}`,
      enContent: "Automated rights reward roulette task",
      enTag: `rrgt${String(ts).slice(-5)}`,
      taskCondition: "KOL绑定",
      rewardMode: "正常奖励+权益奖励",
      rightsType: "虚拟积分或资格",
      rightsSubtype: "VIP",
      rewardMin: "10",
      rewardMax: "100",
      dailyLimit: "5",
      totalLimit: "50",
    },
  };
  const plan = args.modes.map(mode => definitions[mode]).filter(Boolean);
  if (!plan.length) throw new Error(`Unsupported --modes value: ${args.modes.join(", ")}`);
  return plan;
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
    created.push(...await createRouletteRewardModeTasks(page, config, plan));
    printJson({ ok: true, mode: args.visible ? "visible_browser" : "invisible_browser", finalUrl: page.url(), created, evidence: { responses } });
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

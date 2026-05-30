import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensureActivityWebDir,
  extractActivityTaskListTypes,
  extractCompetitionActivityModuleNameMap,
  extractLotteryRaffleStyles,
  extractNewbieActivityModuleNameMap,
  extractSpeedRaceModuleNameMap,
  resolveOptionValue,
} from "../lib/activity-web-mappings.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");

test("extractActivityTaskListTypes reads ACTIVITY_TASK_LIST_TYPE options", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { options } = extractActivityTaskListTypes(activityWebDir);
  assert.ok(Array.isArray(options));
  assert.ok(options.length > 5);
  const newbie = options.find(item => item.value === "BEGINNER_TASK");
  assert.ok(newbie);
  assert.equal(resolveOptionValue("新手活动", options), "BEGINNER_TASK");
  assert.equal(resolveOptionValue("beginner_task", options), "BEGINNER_TASK");
});

test("extractLotteryRaffleStyles reads raffleStyle label mapping", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { styles } = extractLotteryRaffleStyles(activityWebDir);
  assert.ok(Array.isArray(styles));
  assert.ok(styles.length >= 1);
  const first = styles[0];
  assert.ok(first.value);
  assert.ok(first.label);
  assert.equal(resolveOptionValue(first.label, styles), first.value);
});

test("extractNewbieActivityModuleNameMap reads el-card headers", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { moduleNameMap } = extractNewbieActivityModuleNameMap(activityWebDir);
  assert.equal(moduleNameMap.base, "活动基本信息");
  assert.equal(moduleNameMap.userApply, "用户报名");
  assert.equal(moduleNameMap.tasks, "活动任务信息");
  assert.equal(moduleNameMap.resourceCard, "资源位信息卡片");
  assert.equal(moduleNameMap.i18n, "多语言");
  assert.equal(moduleNameMap.faq, "常见问题");
});

test("extractCompetitionActivityModuleNameMap reads core competition module headers", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { moduleNameMap } = extractCompetitionActivityModuleNameMap(activityWebDir);
  assert.equal(moduleNameMap.base, "活动基本信息");
  assert.equal(moduleNameMap.schedule, "活动日程");
  assert.equal(moduleNameMap.userApply, "用户报名");
  assert.equal(moduleNameMap.prize, "奖品管理");
  assert.equal(moduleNameMap.contract, "奖池配置");
  assert.equal(moduleNameMap.rankingReward, "排名奖励");
  assert.equal(moduleNameMap.teamAwardSetting, "队内奖励设置");
  assert.equal(moduleNameMap.virtualRanking, "交易排行榜信息");
  assert.equal(moduleNameMap.team, "团队管理");
  assert.equal(moduleNameMap.pageSetting, "活动页面设置");
  assert.equal(moduleNameMap.i18n, "多语言");
  assert.equal(moduleNameMap.faq, "常见问题");
});

test("extractSpeedRaceModuleNameMap reads speed-race module headers", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { moduleNameMap } = extractSpeedRaceModuleNameMap(activityWebDir);
  assert.equal(moduleNameMap.base, "交易竞速赛基本信息");
  assert.equal(moduleNameMap.speedConfig, "竞速配置");
  assert.equal(moduleNameMap.prizePool, "奖池配置");
  assert.equal(moduleNameMap.leaderboard, "排行榜配置");
  assert.equal(moduleNameMap.pageSetting, "活动页面设置");
  assert.equal(moduleNameMap.i18n, "多语言");
  assert.equal(moduleNameMap.faq, "常见问题");
});

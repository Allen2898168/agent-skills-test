import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScenarioMenu,
  collectAutomationCaseIdsForScenarios,
  collectCaseIdsForScenarios,
  loadLotteryRegressionManifest,
  resolveScenarioSelection,
} from "../lib/lottery-regression-manifest.mjs";
import { buildEntrypointCommands } from "../lottery-regression-dispatcher.mjs";

test("scenario menu exposes grouped admin and frontend items with status labels", () => {
  const manifest = loadLotteryRegressionManifest();
  const groups = buildScenarioMenu(manifest);
  const admin = groups.find(item => item.groupId === "admin");
  const frontend = groups.find(item => item.groupId === "frontend");
  assert.ok(admin);
  assert.ok(frontend);
  assert.ok(admin.scenarios.some(item => item.title === "奖品管理" && item.status === "ready"));
  assert.ok(frontend.scenarios.some(item => item.title === "报名链路" && item.status === "partial"));
});

test("selection resolves group names and scenario aliases", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("后管回归, 报名模版", manifest);
  const ids = selection.selectedScenarios.map(item => item.scenarioId);
  assert.ok(ids.includes("admin_activity_list"));
  assert.ok(ids.includes("admin_register_template"));
  assert.equal(selection.unresolved.length, 0);
});

test("all selection only includes runnable statuses from policy", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("全部", manifest);
  const statuses = new Set(selection.selectedScenarios.map(item => item.status));
  assert.ok(statuses.has("partial"));
  assert.equal(statuses.has("planned"), false);
});

test("collectCaseIdsForScenarios deduplicates shared case ids", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("二次权重专项, 活动配置 / 活动信息", manifest);
  const caseIds = collectCaseIdsForScenarios(selection.selectedScenarios);
  assert.equal(caseIds.filter(item => item === "AC-14").length, 1);
});

test("dispatcher builds frontend main regression command for partial frontend scenarios", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("报名链路, 单抽主流程", manifest);
  const executions = buildEntrypointCommands(selection.selectedScenarios, { visible: true, dryRun: false });
  const frontendExecution = executions.find(item => item.entrypoint === "lottery_frontend_main_regression");
  assert.ok(frontendExecution);
  assert.ok(frontendExecution.commandArgs[0].endsWith("scripts/lottery-frontend-main-regression.mjs"));
  const caseIdsFlagIndex = frontendExecution.commandArgs.indexOf("--case-ids");
  assert.ok(caseIdsFlagIndex >= 0);
  const automationCaseIds = collectAutomationCaseIdsForScenarios(selection.selectedScenarios);
  assert.equal(frontendExecution.commandArgs[caseIdsFlagIndex + 1], automationCaseIds.join(","));
  assert.ok(frontendExecution.commandArgs.includes("--visible"));
});

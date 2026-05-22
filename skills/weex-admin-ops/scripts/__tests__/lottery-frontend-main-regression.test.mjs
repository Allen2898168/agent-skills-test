import test from "node:test";
import assert from "node:assert/strict";

import { buildPlan } from "../lottery-frontend-main-regression.mjs";
import { buildFrontendRegressionCaseResults } from "../lib/lottery-frontend-main-regression-lib.mjs";

test("buildPlan creates activity online before frontend flow when alias is not provided", () => {
  const plan = buildPlan({ visible: false, activityAlias: "" });
  assert.equal(plan.actionId, "lottery_frontend_main_regression");
  assert.deepEqual(plan.phases.map(item => item.phaseId), [
    "create_lottery_activity_draft",
    "online_lottery_activity",
    "run_frontend_main_flow",
  ]);
  const flowPhase = plan.phases.find(item => item.phaseId === "run_frontend_main_flow");
  assert.ok(flowPhase.commands[0].includes("--recharge-amount"));
});

test("buildPlan skips activity creation when an existing alias is provided", () => {
  const plan = buildPlan({ visible: true, activityAlias: "ln12345678" });
  assert.deepEqual(plan.phases.map(item => item.phaseId), ["run_frontend_main_flow"]);
  assert.ok(plan.phases[0].commands[0].includes("ln12345678"));
});

test("frontend case result mapper validates signup, draw, reward dialog, and mq linkage", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-82", caseName: "点击立即报名后切换为抽奖状态", module: "报名链路", priority: "P0" },
          { caseId: "FE-83", caseName: "已报名账号再次进入活动页直显抽奖", module: "报名链路", priority: "P0" },
          { caseId: "FE-33", caseName: "单抽成功展示奖品弹窗", module: "单抽主流程", priority: "P0" },
          { caseId: "FE-48", caseName: "我的奖品入口打开奖励记录弹窗", module: "我的奖品 / 奖励记录", priority: "P0" },
          { caseId: "FE-84", caseName: "充值任务-报名后发送MQ回调", module: "前后端联动展示", priority: "P0" },
        ],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "run_frontend_main_flow",
      ok: true,
      cases: plan.phases[0].caseEntries,
      payload: {
        ok: true,
        signup: {
          initialState: "立即报名",
          finalState: "抽奖",
          reopenedState: "抽奖",
          done: true,
        },
        draw: {
          popupVisible: true,
          countBefore: 3,
          countAfter: 2,
          requestObserved: true,
        },
        rewardRecord: {
          opened: true,
          dialogVisible: true,
          fieldHeaders: ["活动名称", "奖励金额", "获奖时间", "备注"],
        },
        mqRecharge: {
          ok: true,
          uid: "5139967417",
          amount: "1000",
          countBefore: 0,
          countAfter: 3,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-82", status: "PASS" },
    { caseId: "FE-83", status: "PASS" },
    { caseId: "FE-33", status: "PASS" },
    { caseId: "FE-48", status: "PASS" },
    { caseId: "FE-84", status: "PASS" },
  ]);
});

test("frontend case result mapper preserves guest-state runtime failure details", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-79", caseName: "活动别名访问正常", module: "报名链路", priority: "P0" },
          { caseId: "FE-82", caseName: "点击立即报名后切换为抽奖状态", module: "报名链路", priority: "P0" },
        ],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "run_frontend_main_flow",
      ok: false,
      cases: plan.phases[0].caseEntries,
      payload: {
        ok: false,
        error: "frontend draw page still showed guest state",
        page: {
          activityAlias: "lf22121600",
          url: "https://stg-www.weex.tech/zh-CN/events/draw/lf22121600",
          guestVisible: true,
          buttons: ["注册", "去充值"],
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status, errorMessage: item.errorMessage })), [
    { caseId: "FE-79", status: "FAIL", errorMessage: "frontend draw page still showed guest state" },
    { caseId: "FE-82", status: "FAIL", errorMessage: "frontend draw page still showed guest state" },
  ]);
});

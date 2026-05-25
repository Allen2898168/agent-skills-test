import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlan,
  buildPhaseProgressLine,
  expandFrontendSelectedCaseIds,
  prepareFrontendRegressionPlan,
  resolveFrontendExecutionSelection,
} from "../lottery-frontend-main-regression.mjs";
import { buildFrontendRegressionCaseResults } from "../lib/lottery-frontend-main-regression-lib.mjs";

test("buildPlan creates activity online before staged frontend phases when alias is not provided", () => {
  const plan = buildPlan({ visible: false, activityAlias: "" });
  assert.equal(plan.actionId, "lottery_frontend_main_regression");
  assert.deepEqual(plan.phases.map(item => item.phaseId), [
    "create_lottery_activity_draft",
    "online_lottery_activity",
    "frontend_readonly_checks",
    "frontend_signup_flow",
    "frontend_recharge_prepare",
    "frontend_single_draw",
    "frontend_reward_record",
  ]);
  const rechargePhase = plan.phases.find(item => item.phaseId === "frontend_recharge_prepare");
  assert.ok(rechargePhase.commands[0].includes("--recharge-amount"));
  const rewardPhase = plan.phases.find(item => item.phaseId === "frontend_reward_record");
  assert.ok(rewardPhase.commands[0].includes("--phase"));
  assert.ok(rewardPhase.commands[0].includes("reward_record"));
});

test("buildPlan skips activity creation when an existing alias is provided and still keeps staged phases", () => {
  const plan = buildPlan({ visible: true, activityAlias: "ln12345678" });
  assert.deepEqual(plan.phases.map(item => item.phaseId), [
    "frontend_readonly_checks",
    "frontend_signup_flow",
    "frontend_recharge_prepare",
    "frontend_single_draw",
    "frontend_reward_record",
  ]);
  assert.ok(plan.phases.every(item => item.commands[0].includes("skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs")));
  assert.ok(plan.phases.every(item => item.commands[0].includes("ln12345678")));
});

test("buildPlan assigns staged frontend cases to matching phases", () => {
  const plan = buildPlan({ visible: false, activityAlias: "ln12345678" });
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "frontend_readonly_checks", caseIds: ["FE-79", "FE-01", "FE-07", "FE-17", "FE-19"] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82", "FE-83"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-21", "FE-22", "FE-84"] },
    { phaseId: "frontend_single_draw", caseIds: ["FE-24", "FE-26", "FE-28", "FE-32", "FE-33", "FE-34", "FE-35"] },
    { phaseId: "frontend_reward_record", caseIds: ["FE-36", "FE-37", "FE-48", "FE-49", "FE-50"] },
  ]);
});

test("buildPlan lets create script calculate activity times at fill time", () => {
  const plan = buildPlan({ visible: false, activityAlias: "" });
  const createPhase = plan.phases.find(item => item.phaseId === "create_lottery_activity_draft");
  assert.equal(createPhase.commands[0].includes("--start"), false);
  assert.equal(createPhase.commands[0].includes("--end"), false);
});

test("buildPlan keeps frontend phase wait window aligned with flow default", () => {
  const plan = buildPlan({ visible: false, activityAlias: "ln12345678" });
  for (const phase of plan.phases) {
    const waitIndex = phase.commands[0].indexOf("--wait-for-start-ms");
    assert.notEqual(waitIndex, -1);
    assert.equal(phase.commands[0][waitIndex + 1], "720000");
  }
});

test("case selection expands FE-82 to include FE-81 and forces a fresh activity", () => {
  const selection = resolveFrontendExecutionSelection({
    caseIds: ["FE-82"],
    activityAlias: "reuse-old-activity",
  });
  assert.deepEqual(selection.expandedCaseIds, ["FE-81", "FE-82"]);
  assert.equal(selection.forceFreshActivity, true);
  assert.equal(selection.effectiveActivityAlias, "");
  assert.equal(selection.ignoredActivityAlias, "reuse-old-activity");
});

test("case selection expands FE-83 through the signup chain and forces a fresh activity", () => {
  const selection = resolveFrontendExecutionSelection({
    caseIds: ["FE-83"],
    activityAlias: "reuse-old-activity",
  });
  assert.deepEqual(selection.expandedCaseIds, ["FE-81", "FE-82", "FE-83"]);
  assert.equal(selection.forceFreshActivity, true);
});

test("case selection expands FE-84 through the signup chain", () => {
  assert.deepEqual(expandFrontendSelectedCaseIds(["FE-84"]), ["FE-81", "FE-82", "FE-84"]);
});

test("prepareFrontendRegressionPlan includes create and recharge phases for FE-84 only selection", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "reuse-old-activity",
    caseIds: ["FE-84"],
  });
  assert.deepEqual(plan.requestedCaseIds, ["FE-84"]);
  assert.deepEqual(plan.selectedCaseIds, ["FE-81", "FE-82", "FE-84"]);
  assert.equal(plan.executionSelection.forceFreshActivity, true);
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "create_lottery_activity_draft", caseIds: [] },
    { phaseId: "online_lottery_activity", caseIds: [] },
    { phaseId: "frontend_readonly_checks", caseIds: [] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"] },
  ]);
});

test("prepareFrontendRegressionPlan expands FE-32 to the fresh signup and recharge chain", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "reuse-old-activity",
    caseIds: ["FE-32"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-81", "FE-82", "FE-84", "FE-32"]);
  assert.equal(plan.executionSelection.forceFreshActivity, true);
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "create_lottery_activity_draft", caseIds: [] },
    { phaseId: "online_lottery_activity", caseIds: [] },
    { phaseId: "frontend_readonly_checks", caseIds: [] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"] },
    { phaseId: "frontend_single_draw", caseIds: ["FE-32"] },
  ]);
});

test("prepareFrontendRegressionPlan routes FE-21 and FE-24/26/28 into executable phases", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "reuse-old-activity",
    caseIds: ["FE-21", "FE-24", "FE-26", "FE-28"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-81", "FE-82", "FE-21", "FE-84", "FE-24", "FE-26", "FE-28"]);
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "create_lottery_activity_draft", caseIds: [] },
    { phaseId: "online_lottery_activity", caseIds: [] },
    { phaseId: "frontend_readonly_checks", caseIds: [] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-21", "FE-84"] },
    { phaseId: "frontend_single_draw", caseIds: ["FE-24", "FE-26", "FE-28"] },
  ]);
});

test("prepareFrontendRegressionPlan routes FE-36 through single draw before reward record", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "reuse-old-activity",
    caseIds: ["FE-36"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-81", "FE-82", "FE-84", "FE-32", "FE-36"]);
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds, dependsOn: item.dependsOn })), [
    { phaseId: "create_lottery_activity_draft", caseIds: [], dependsOn: [] },
    { phaseId: "online_lottery_activity", caseIds: [], dependsOn: ["create_lottery_activity_draft"] },
    { phaseId: "frontend_readonly_checks", caseIds: [], dependsOn: ["online_lottery_activity"] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_single_draw", caseIds: ["FE-32"], dependsOn: ["frontend_recharge_prepare"] },
    { phaseId: "frontend_reward_record", caseIds: ["FE-36"], dependsOn: ["frontend_readonly_checks", "frontend_single_draw"] },
  ]);
});

test("prepareFrontendRegressionPlan keeps FE-48/49/50 reusable without forcing fresh activity", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "existing-online-alias",
    caseIds: ["FE-48", "FE-49", "FE-50"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-48", "FE-49", "FE-50"]);
  assert.equal(plan.executionSelection.forceFreshActivity, false);
  assert.equal(plan.executionSelection.effectiveActivityAlias, "existing-online-alias");
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds, dependsOn: item.dependsOn })), [
    {
      phaseId: "frontend_readonly_checks",
      caseIds: [],
      dependsOn: [],
    },
    {
      phaseId: "frontend_reward_record",
      caseIds: ["FE-48", "FE-49", "FE-50"],
      dependsOn: ["frontend_readonly_checks"],
    },
  ]);
});

test("buildPhaseProgressLine describes phase start and completion", () => {
  assert.equal(
    buildPhaseProgressLine({
      status: "start",
      phaseId: "frontend_recharge_prepare",
      description: "Prepare draw count through recharge task linkage.",
      attempt: 1,
      totalAttempts: 2,
    }),
    "[frontend-main] START frontend_recharge_prepare (attempt 1/2) Prepare draw count through recharge task linkage.",
  );
  assert.equal(
    buildPhaseProgressLine({
      status: "done",
      phaseId: "frontend_recharge_prepare",
      ok: true,
    }),
    "[frontend-main] DONE frontend_recharge_prepare PASS",
  );
});

test("frontend case result mapper validates signup, draw, reward dialog, and mq linkage", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-21", caseName: "抽奖次数为0展示正常", module: "页面状态UI", priority: "P0" },
          { caseId: "FE-24", caseName: "单抽按钮可点击", module: "按钮与交互态", priority: "P0" },
          { caseId: "FE-26", caseName: "抽奖旋转期间再次点击仍只生效一次", module: "按钮与交互态", priority: "P1" },
          { caseId: "FE-28", caseName: "单抽按钮防重复点击", module: "按钮与交互态", priority: "P1" },
          { caseId: "FE-36", caseName: "单抽成功后奖励记录可回查", module: "单抽主流程", priority: "P1" },
          { caseId: "FE-37", caseName: "单抽成功后奖品信息符合预期", module: "单抽主流程", priority: "P1" },
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
          buttonVisibleBefore: true,
          buttonDisabledDuringDraw: false,
          requestSent: true,
          duplicateClickBlocked: true,
          requestCountDelta: 1,
          popupVisible: true,
          countBefore: 3,
          countAfter: 2,
          requestObserved: true,
        },
        rewardRecord: {
          opened: true,
          dialogVisible: true,
          fieldHeaders: ["活动名称", "奖励金额", "获奖时间", "备注"],
          hasRewardRow: true,
          hasReadableRewardValue: true,
          dataLineCount: 6,
        },
        mqRecharge: {
          ok: true,
          sent: true,
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
    { caseId: "FE-21", status: "PASS" },
    { caseId: "FE-24", status: "PASS" },
    { caseId: "FE-26", status: "PASS" },
    { caseId: "FE-28", status: "PASS" },
    { caseId: "FE-36", status: "PASS" },
    { caseId: "FE-37", status: "PASS" },
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

test("frontend case result mapper evaluates independent evidence even when phase failed", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-01", caseName: "落地页打开正常", module: "页面基础UI", priority: "P0" },
          { caseId: "FE-50", caseName: "奖励记录字段展示正确", module: "我的奖品 / 奖励记录", priority: "P0" },
          { caseId: "FE-32", caseName: "单抽接口正常请求", module: "单抽主流程", priority: "P0" },
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
        page: {
          opened: true,
          loginFormVisible: false,
          urlMatchesAlias: true,
        },
        rewardRecord: {
          opened: true,
          dialogVisible: true,
          fieldHeaders: ["活动名称", "奖励金额", "获奖时间", "备注"],
        },
        draw: {
          requestSent: true,
          apiSuccess: false,
          apiCode: "50000",
          apiMessage: "系统繁忙，请稍后再试！",
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-01", status: "PASS" },
    { caseId: "FE-50", status: "PASS" },
    { caseId: "FE-32", status: "FAIL" },
  ]);
});

test("frontend case result mapper uses updated FE-07 FE-17 FE-19 criteria", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-07", caseName: "我的奖品入口展示正常", module: "页面基础UI", priority: "P1" },
          { caseId: "FE-17", caseName: "已登录态页面展示正常", module: "页面状态UI", priority: "P0" },
          { caseId: "FE-19", caseName: "活动进行中展示正常", module: "页面状态UI", priority: "P0" },
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
        page: {
          loginFormVisible: false,
          guestVisible: false,
          mainButtonState: "抽奖",
          drawButtonVariant: "抽奖×5",
          myPrizeVisible: false,
          activityTitle: "转盘抽奖 - 自动化回归测试",
          activityTitleVisible: true,
          countdownText: "364天23:59:58",
          countdownVisible: true,
          countdownTicking: true,
          pageErrorVisible: false,
        },
        rewardRecord: {
          opened: true,
          dialogVisible: true,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-07", status: "PASS" },
    { caseId: "FE-17", status: "PASS" },
    { caseId: "FE-19", status: "PASS" },
  ]);
});

test("frontend case result mapper skips unmet signup and mq preconditions on reused signed-up activity", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-81", caseName: "活动开始后未报名显示立即报名", module: "报名链路", priority: "P0" },
          { caseId: "FE-82", caseName: "点击立即报名后切换为抽奖状态", module: "报名链路", priority: "P0" },
          { caseId: "FE-83", caseName: "已报名账号再次进入活动页直显抽奖", module: "报名链路", priority: "P0" },
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
        page: {
          mainButtonState: "抽奖",
          drawButtonVariant: "抽奖×5",
        },
        signup: {
          initialState: "",
          finalState: "抽奖",
          reopenedState: "抽奖",
          done: true,
        },
        mqRecharge: {
          ok: true,
          sent: false,
          countBefore: 96,
          countAfter: 96,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-81", status: "SKIPPED" },
    { caseId: "FE-82", status: "SKIPPED" },
    { caseId: "FE-83", status: "PASS" },
    { caseId: "FE-84", status: "SKIPPED" },
  ]);
});

test("frontend case result mapper marks FE-81 pass when run starts from 立即报名 and then becomes 抽奖", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-81", caseName: "活动开始后未报名显示立即报名", module: "报名链路", priority: "P0" },
          { caseId: "FE-82", caseName: "点击立即报名后切换为抽奖状态", module: "报名链路", priority: "P0" },
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
        page: {
          mainButtonState: "立即报名",
          drawButtonVariant: "",
        },
        signup: {
          initialState: "立即报名",
          finalState: "抽奖",
          reopenedState: "抽奖",
          done: true,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-81", status: "PASS" },
    { caseId: "FE-82", status: "PASS" },
  ]);
});

test("frontend case result mapper marks FE-32 fail when draw api returns non-success code", () => {
  const plan = {
    phases: [
      {
        phaseId: "run_frontend_main_flow",
        caseEntries: [
          { caseId: "FE-32", caseName: "单抽接口正常请求", module: "单抽主流程", priority: "P0" },
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
        draw: {
          requestObserved: false,
          requestSent: true,
          apiSuccess: false,
          apiCode: "50000",
          apiMessage: "系统繁忙，请稍后再试！",
          popupVisible: false,
          countBefore: 103,
          countAfter: 103,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status, apiCode: item.evidence?.draw?.apiCode })), [
    { caseId: "FE-32", status: "FAIL", apiCode: "50000" },
  ]);
});

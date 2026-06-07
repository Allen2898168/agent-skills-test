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
    "admin_activity_snapshot",
    "frontend_readonly_checks",
    "frontend_signup_flow",
    "frontend_backend_linkage",
    "frontend_backend_linkage_readonly",
    "frontend_style_display",
    "frontend_recharge_prepare",
    "frontend_exception_ui",
    "frontend_five_draw",
    "frontend_low_stock_five_draw",
    "frontend_low_stock_single_draw",
    "frontend_weight_special",
    "frontend_single_draw",
    "frontend_reward_record",
    "frontend_reward_record_extended",
    "frontend_responsive_ui",
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
    "admin_activity_snapshot",
    "frontend_readonly_checks",
    "frontend_signup_flow",
    "frontend_backend_linkage",
    "frontend_backend_linkage_readonly",
    "frontend_style_display",
    "frontend_recharge_prepare",
    "frontend_exception_ui",
    "frontend_five_draw",
    "frontend_low_stock_five_draw",
    "frontend_low_stock_single_draw",
    "frontend_weight_special",
    "frontend_single_draw",
    "frontend_reward_record",
    "frontend_reward_record_extended",
    "frontend_responsive_ui",
  ]);
  assert.ok(plan.phases.every(item => item.commands[0].includes("ln12345678")));
});

test("buildPlan assigns staged frontend cases to matching phases", () => {
  const plan = buildPlan({ visible: false, activityAlias: "ln12345678" });
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "admin_activity_snapshot", caseIds: [] },
    { phaseId: "frontend_readonly_checks", caseIds: ["FE-79", "FE-01", "FE-02", "FE-03", "FE-05", "FE-06", "FE-07", "FE-08", "FE-17", "FE-19"] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82", "FE-83"] },
    { phaseId: "frontend_backend_linkage", caseIds: ["FE-73"] },
    { phaseId: "frontend_backend_linkage_readonly", caseIds: ["FE-75", "FE-76", "FE-77", "FE-78"] },
    { phaseId: "frontend_style_display", caseIds: ["FE-09", "FE-10", "FE-11", "FE-12", "FE-13", "FE-14", "FE-15"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-21", "FE-22", "FE-84"] },
    { phaseId: "frontend_exception_ui", caseIds: ["FE-38", "FE-39", "FE-58", "FE-59", "FE-60", "FE-61", "FE-62", "FE-63"] },
    { phaseId: "frontend_five_draw", caseIds: ["FE-25", "FE-29", "FE-40", "FE-41", "FE-42", "FE-43", "FE-44", "FE-47"] },
    { phaseId: "frontend_low_stock_five_draw", caseIds: ["FE-23", "FE-45", "FE-46", "FE-57"] },
    { phaseId: "frontend_low_stock_single_draw", caseIds: ["FE-85"] },
    { phaseId: "frontend_weight_special", caseIds: ["FE-64", "FE-65", "FE-66", "FE-67"] },
    { phaseId: "frontend_single_draw", caseIds: ["FE-24", "FE-26", "FE-27", "FE-28", "FE-32", "FE-33", "FE-34", "FE-35"] },
    { phaseId: "frontend_reward_record", caseIds: ["FE-36", "FE-37", "FE-48", "FE-49", "FE-50", "FE-55", "FE-56"] },
    { phaseId: "frontend_reward_record_extended", caseIds: ["FE-51", "FE-52", "FE-53", "FE-54"] },
    { phaseId: "frontend_responsive_ui", caseIds: ["FE-68", "FE-69", "FE-70", "FE-71", "FE-72"] },
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
    if (!phase.commands[0].includes("skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs")) continue;
    const waitIndex = phase.commands[0].indexOf("--wait-for-start-ms");
    assert.notEqual(waitIndex, -1);
    assert.equal(phase.commands[0][waitIndex + 1], "720000");
  }
});

test("case selection expands FE-82 to include FE-81 and preserves a provided activity alias", () => {
  const selection = resolveFrontendExecutionSelection({
    caseIds: ["FE-82"],
    activityAlias: "reuse-old-activity",
  });
  assert.deepEqual(selection.expandedCaseIds, ["FE-81", "FE-82"]);
  assert.equal(selection.forceFreshActivity, false);
  assert.equal(selection.effectiveActivityAlias, "reuse-old-activity");
  assert.equal(selection.ignoredActivityAlias, "");
});

test("case selection expands FE-83 through the signup chain and preserves a provided activity alias", () => {
  const selection = resolveFrontendExecutionSelection({
    caseIds: ["FE-83"],
    activityAlias: "reuse-old-activity",
  });
  assert.deepEqual(selection.expandedCaseIds, ["FE-81", "FE-82", "FE-83"]);
  assert.equal(selection.forceFreshActivity, false);
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
  assert.equal(plan.executionSelection.forceFreshActivity, false);
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "admin_activity_snapshot", caseIds: [] },
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
  assert.equal(plan.executionSelection.forceFreshActivity, false);
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds })), [
    { phaseId: "admin_activity_snapshot", caseIds: [] },
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
    { phaseId: "admin_activity_snapshot", caseIds: [] },
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
    { phaseId: "admin_activity_snapshot", caseIds: [], dependsOn: [] },
    { phaseId: "frontend_readonly_checks", caseIds: [], dependsOn: ["admin_activity_snapshot"] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_single_draw", caseIds: ["FE-32"], dependsOn: ["frontend_recharge_prepare"] },
    { phaseId: "frontend_reward_record", caseIds: ["FE-36"], dependsOn: ["frontend_readonly_checks", "frontend_single_draw"] },
  ]);
});

test("prepareFrontendRegressionPlan routes FE-40 through recharge into five-draw phase", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "reuse-old-activity",
    caseIds: ["FE-40"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-81", "FE-82", "FE-84", "FE-40"]);
  const phaseSummary = plan.phases.map(item => ({
    phaseId: item.phaseId,
    caseIds: item.caseIds,
    dependsOn: item.dependsOn,
    commandPhase: item.commands?.[0]?.includes("--phase")
      ? item.commands[0][item.commands[0].indexOf("--phase") + 1]
      : "",
  }));
  assert.deepEqual(phaseSummary, [
    { phaseId: "admin_activity_snapshot", caseIds: [], dependsOn: [], commandPhase: "" },
    { phaseId: "frontend_readonly_checks", caseIds: [], dependsOn: ["admin_activity_snapshot"], commandPhase: "readonly" },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"], dependsOn: ["frontend_readonly_checks"], commandPhase: "signup" },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"], dependsOn: ["frontend_readonly_checks"], commandPhase: "recharge" },
    { phaseId: "frontend_five_draw", caseIds: ["FE-40"], dependsOn: ["frontend_recharge_prepare"], commandPhase: "five_draw" },
  ]);
});

test("prepareFrontendRegressionPlan routes low-stock cases through five-draw before single-draw phase", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "stock-online-alias",
    caseIds: ["FE-23", "FE-45", "FE-46", "FE-57", "FE-85"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-81", "FE-82", "FE-84", "FE-23", "FE-45", "FE-46", "FE-57", "FE-85"]);
  assert.deepEqual(plan.phases.map(item => ({
    phaseId: item.phaseId,
    caseIds: item.caseIds,
    dependsOn: item.dependsOn,
    commandPhase: item.commands?.[0]?.includes("--phase")
      ? item.commands[0][item.commands[0].indexOf("--phase") + 1]
      : "",
  })), [
    { phaseId: "admin_activity_snapshot", caseIds: [], dependsOn: [], commandPhase: "" },
    { phaseId: "frontend_readonly_checks", caseIds: [], dependsOn: ["admin_activity_snapshot"], commandPhase: "readonly" },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"], dependsOn: ["frontend_readonly_checks"], commandPhase: "signup" },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"], dependsOn: ["frontend_readonly_checks"], commandPhase: "recharge" },
    { phaseId: "frontend_low_stock_five_draw", caseIds: ["FE-23", "FE-45", "FE-46", "FE-57"], dependsOn: ["frontend_recharge_prepare"], commandPhase: "five_draw" },
    { phaseId: "frontend_low_stock_single_draw", caseIds: ["FE-85"], dependsOn: ["frontend_recharge_prepare", "frontend_low_stock_five_draw"], commandPhase: "low_stock_single_draw" },
  ]);
});

test("prepareFrontendRegressionPlan routes weight-special cases through cumulative weight phase", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "weight-online-alias",
    caseIds: ["FE-64", "FE-65", "FE-66", "FE-67"],
  });
  assert.deepEqual(plan.selectedCaseIds, ["FE-64", "FE-65", "FE-66", "FE-67"]);
  assert.deepEqual(plan.phases.map(item => ({
    phaseId: item.phaseId,
    caseIds: item.caseIds,
    dependsOn: item.dependsOn,
    script: item.commands?.[0]?.[0] || "",
  })), [
    { phaseId: "admin_activity_snapshot", caseIds: [], dependsOn: [], script: "skills/weex-admin-ops/scripts/lottery-activity-fast-api.mjs" },
    { phaseId: "frontend_readonly_checks", caseIds: [], dependsOn: ["admin_activity_snapshot"], script: "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs" },
    { phaseId: "frontend_recharge_prepare", caseIds: [], dependsOn: ["frontend_readonly_checks"], script: "skills/weex-frontend-ops/scripts/lottery-frontend-main-flow.mjs" },
    { phaseId: "frontend_weight_special", caseIds: ["FE-64", "FE-65", "FE-66", "FE-67"], dependsOn: ["frontend_recharge_prepare"], script: "skills/weex-frontend-ops/scripts/frontend-draw-weight-special-verify.mjs" },
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
      phaseId: "admin_activity_snapshot",
      caseIds: [],
      dependsOn: [],
    },
    {
      phaseId: "frontend_readonly_checks",
      caseIds: [],
      dependsOn: ["admin_activity_snapshot"],
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

test("frontend case result mapper validates normal five-draw flow", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_five_draw",
        caseEntries: [
          { caseId: "FE-25", caseName: "可用次数大于5时展示并可点击五连抽按钮", module: "按钮与交互态", priority: "P0" },
          { caseId: "FE-29", caseName: "五连抽按钮防重复点击", module: "按钮与交互态", priority: "P1" },
          { caseId: "FE-40", caseName: "五连抽接口正常请求", module: "五连抽主流程", priority: "P0" },
          { caseId: "FE-41", caseName: "五连抽成功展示奖品弹窗", module: "五连抽主流程", priority: "P0" },
          { caseId: "FE-42", caseName: "五连抽成功后抽奖次数消耗5次", module: "五连抽主流程", priority: "P0" },
          { caseId: "FE-43", caseName: "五连抽成功后奖励记录可回查", module: "五连抽主流程", priority: "P0" },
          { caseId: "FE-44", caseName: "五连抽奖励记录字段正确", module: "五连抽主流程", priority: "P0" },
          { caseId: "FE-47", caseName: "五连抽结果展示完整", module: "五连抽主流程", priority: "P1" },
        ],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "frontend_five_draw",
      ok: true,
      cases: plan.phases[0].caseEntries,
      payload: {
        ok: true,
        fiveDraw: {
          requestSent: true,
          requestObserved: true,
          buttonVisibleBefore: true,
          duplicateClickBlocked: true,
          requestCountDelta: 1,
          apiSuccess: true,
          popupVisible: true,
          popupRewardCount: 5,
          popupRewardSummary: "奖品1 奖品2 奖品3 奖品4 奖品5",
          countBefore: 10,
          countAfter: 5,
        },
        fiveDrawRewardRecord: {
          opened: true,
          dialogVisible: true,
          fieldHeaders: ["活动名称", "奖励金额", "获奖时间", "备注"],
          hasRewardRow: true,
          hasReadableRewardValue: true,
          dataLineCount: 8,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-25", status: "PASS" },
    { caseId: "FE-29", status: "PASS" },
    { caseId: "FE-40", status: "PASS" },
    { caseId: "FE-41", status: "PASS" },
    { caseId: "FE-42", status: "PASS" },
    { caseId: "FE-43", status: "PASS" },
    { caseId: "FE-44", status: "PASS" },
    { caseId: "FE-47", status: "PASS" },
  ]);
});

test("frontend case result mapper validates low-stock five-draw failure flow", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_low_stock_five_draw",
        caseEntries: [
          { caseId: "FE-23", caseName: "库存不足时五连抽返回固定提示且不扣次数", module: "页面状态UI", priority: "P1" },
          { caseId: "FE-45", caseName: "小库存模板下五连抽可能被库存规则拦截", module: "五连抽主流程", priority: "P1" },
          { caseId: "FE-46", caseName: "五连抽失败不消耗次数", module: "五连抽主流程", priority: "P1" },
          { caseId: "FE-57", caseName: "小库存模板下五连抽库存不足提示正确", module: "异常提示与容错UI", priority: "P0" },
        ],
      },
    ],
  };
  const [fe23, fe45, fe46, fe57] = buildFrontendRegressionCaseResults(plan, [
    {
      phaseId: "frontend_low_stock_five_draw",
      ok: true,
      payload: {
        fiveDraw: {
          requestSent: true,
          apiSuccess: false,
          failurePromptVisible: true,
          apiCode: "51031",
          apiMessage: "当日奖品所剩不多，请尝试单次抽奖。",
          countBefore: 110,
          countAfter: 110,
        },
      },
      cases: plan.phases[0].caseEntries,
    },
  ]);
  assert.equal(fe23.status, "PASS");
  assert.equal(fe45.status, "PASS");
  assert.equal(fe46.status, "PASS");
  assert.equal(fe57.status, "PASS");
});

test("frontend case result mapper validates low-stock single-draw success then shortage flow", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_low_stock_single_draw",
        caseEntries: [
          { caseId: "FE-85", caseName: "小库存单抽首次成功后再次提示库存不足", module: "小库存专项", priority: "P0" },
        ],
      },
    ],
  };
  const [result] = buildFrontendRegressionCaseResults(plan, [
    {
      phaseId: "frontend_low_stock_single_draw",
      ok: true,
      payload: {
        lowStockSingleDraw: {
          first: {
            requestSent: true,
            apiSuccess: true,
            popupVisible: true,
            countBefore: 110,
            countAfter: 109,
          },
          second: {
            requestSent: true,
            apiSuccess: false,
            apiCode: "51031",
            apiMessage: "当日奖品所剩不多，请尝试单次抽奖。",
            failurePromptVisible: true,
            countBefore: 109,
            countAfter: 109,
          },
        },
      },
      cases: plan.phases[0].caseEntries,
    },
  ]);
  assert.equal(result.status, "PASS");
});

test("frontend case result mapper accepts sold-out prompt for second low-stock single draw", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_low_stock_single_draw",
        caseEntries: [
          { caseId: "FE-85", caseName: "小库存单抽首次成功后再次提示库存不足", module: "小库存专项", priority: "P0" },
        ],
      },
    ],
  };
  const [result] = buildFrontendRegressionCaseResults(plan, [
    {
      phaseId: "frontend_low_stock_single_draw",
      ok: true,
      payload: {
        lowStockSingleDraw: {
          first: {
            requestSent: true,
            apiSuccess: true,
            popupVisible: true,
            countBefore: 110,
            countAfter: 109,
          },
          second: {
            requestSent: true,
            apiSuccess: false,
            apiCode: "51020",
            apiMessage: "今日奖品已被抽完，请明天再来！",
            failurePromptVisible: true,
            countBefore: 109,
            countAfter: 109,
          },
        },
      },
      cases: plan.phases[0].caseEntries,
    },
  ]);
  assert.equal(result.status, "PASS");
});

test("frontend case result mapper validates cumulative weight frontend flow", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_weight_special",
        caseEntries: [
          { caseId: "FE-64", caseName: "二次权重专项校验-N+1生效", module: "二次权重与专项校验", priority: "P0" },
          { caseId: "FE-65", caseName: "未配置二次权重场景不做专项校验", module: "二次权重与专项校验", priority: "P1" },
          { caseId: "FE-66", caseName: "需要验证二次权重时使用专项活动", module: "二次权重与专项校验", priority: "P1" },
          { caseId: "FE-67", caseName: "二次权重命中后奖励记录正确", module: "二次权重与专项校验", priority: "P1" },
        ],
      },
    ],
  };
  const results = buildFrontendRegressionCaseResults(plan, [
    {
      phaseId: "frontend_weight_special",
      ok: true,
      payload: {
        activityAlias: "weight-online-alias",
        expectedPrizeText: "100 USDT 合约赠金",
        countBefore: 10,
        countAfter: 4,
        drawTimes: 6,
        targetDraw: {
          drawNo: 6,
          popupVisible: true,
          popupPrizeText: "100 USDT 合约赠金",
        },
        assertions: {
          allApiSuccess: true,
          allPopupVisible: true,
          targetDrawContainsExpectedPrizeText: true,
        },
        rewardRecord: {
          opened: true,
          dialogVisible: true,
          hasRewardRow: true,
          hasReadableRewardValue: true,
        },
        draws: Array.from({ length: 6 }, (_, index) => ({
          drawNo: index + 1,
          luckDraw: { code: "00000" },
          popupVisible: true,
        })),
      },
      cases: plan.phases[0].caseEntries,
    },
  ]);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-64", status: "PASS" },
    { caseId: "FE-65", status: "PASS" },
    { caseId: "FE-66", status: "PASS" },
    { caseId: "FE-67", status: "PASS" },
  ]);
});

test("frontend case result mapper fails five-draw count assertion when only four chances are consumed", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_five_draw",
        caseEntries: [
          { caseId: "FE-42", caseName: "五连抽成功后抽奖次数消耗5次", module: "五连抽主流程", priority: "P0" },
        ],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "frontend_five_draw",
      ok: true,
      cases: plan.phases[0].caseEntries,
      payload: {
        ok: true,
        fiveDraw: {
          apiSuccess: true,
          popupVisible: true,
          countBefore: 10,
          countAfter: 6,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(results.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "FE-42", status: "FAIL" },
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

test("prepareFrontendRegressionPlan routes remaining frontend coverage gaps into executable phases", () => {
  const plan = prepareFrontendRegressionPlan({
    visible: false,
    activityAlias: "normal-online-alias",
    caseIds: [
      "FE-09", "FE-10", "FE-11", "FE-12", "FE-13", "FE-14", "FE-15",
      "FE-38", "FE-39", "FE-58", "FE-59", "FE-60", "FE-61", "FE-62", "FE-63",
      "FE-51", "FE-52", "FE-53", "FE-54",
      "FE-68", "FE-69", "FE-70", "FE-71", "FE-72",
    ],
  });
  assert.deepEqual(plan.phases.map(item => ({ phaseId: item.phaseId, caseIds: item.caseIds, dependsOn: item.dependsOn })), [
    { phaseId: "admin_activity_snapshot", caseIds: [], dependsOn: [] },
    { phaseId: "frontend_readonly_checks", caseIds: [], dependsOn: ["admin_activity_snapshot"] },
    { phaseId: "frontend_signup_flow", caseIds: ["FE-81", "FE-82"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_style_display", caseIds: ["FE-09", "FE-10", "FE-11", "FE-12", "FE-13", "FE-14", "FE-15"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_recharge_prepare", caseIds: ["FE-84"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_exception_ui", caseIds: ["FE-38", "FE-39", "FE-58", "FE-59", "FE-60", "FE-61", "FE-62", "FE-63"], dependsOn: ["frontend_recharge_prepare"] },
    { phaseId: "frontend_reward_record_extended", caseIds: ["FE-51", "FE-52", "FE-53", "FE-54"], dependsOn: ["frontend_readonly_checks"] },
    { phaseId: "frontend_responsive_ui", caseIds: ["FE-68", "FE-69", "FE-70", "FE-71", "FE-72"], dependsOn: ["frontend_readonly_checks"] },
  ]);
});

test("frontend case result mapper validates style, exception, reward-record, and responsive gap phases", () => {
  const plan = {
    phases: [
      {
        phaseId: "frontend_style_display",
        caseEntries: ["FE-09", "FE-10", "FE-11", "FE-12", "FE-13", "FE-14", "FE-15"].map(caseId => ({ caseId })),
      },
      {
        phaseId: "frontend_exception_ui",
        caseEntries: ["FE-38", "FE-39", "FE-58", "FE-59", "FE-60", "FE-61", "FE-62", "FE-63"].map(caseId => ({ caseId })),
      },
      {
        phaseId: "frontend_reward_record_extended",
        caseEntries: ["FE-51", "FE-52", "FE-53", "FE-54"].map(caseId => ({ caseId })),
      },
      {
        phaseId: "frontend_responsive_ui",
        caseEntries: ["FE-68", "FE-69", "FE-70", "FE-71", "FE-72"].map(caseId => ({ caseId })),
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "frontend_style_display",
      ok: true,
      cases: plan.phases[0].caseEntries,
      payload: {
        styleDisplay: {
          styles: {
            CIRCLE: { opened: true, mainVisualVisible: true, horizontalOverflow: false },
            DART: { opened: true, mainVisualVisible: true, horizontalOverflow: false },
            EASTER_EGG: { opened: true, mainVisualVisible: true, horizontalOverflow: false },
            CIRCULAR_RECORD: { opened: true, mainVisualVisible: true, horizontalOverflow: false },
            WORLD_CUP_KICK_BALL: { opened: true, mainVisualVisible: true, horizontalOverflow: false },
          },
          prizeAssetsVisible: true,
          prizeNamesVisible: true,
          nonCircleFiveDrawHidden: true,
        },
      },
    },
    {
      phaseId: "frontend_exception_ui",
      ok: true,
      cases: plan.phases[1].caseEntries,
      payload: {
        exceptionUi: {
          singleDrawFailure: { injected: true, requestSent: true, popupPrizeVisible: false, countBefore: 10, countAfter: 10 },
          apiFailurePromptVisible: true,
          timeoutPromptVisible: true,
          networkPromptVisible: true,
          buttonRestored: true,
          duplicatePopupBlocked: true,
          pageAlive: true,
        },
      },
    },
    {
      phaseId: "frontend_reward_record_extended",
      ok: true,
      cases: plan.phases[2].caseEntries,
      payload: {
        rewardRecordExtended: {
          emptyStateVisible: true,
          dataStateVisible: true,
          timeFilterOperable: true,
          scrollLoadOk: true,
        },
      },
    },
    {
      phaseId: "frontend_responsive_ui",
      ok: true,
      cases: plan.phases[3].caseEntries,
      payload: {
        responsiveUi: {
          h5Opened: true,
          mobileWidthsOk: true,
          lowHeightButtonVisible: true,
          mobileDialogWithinViewport: true,
          longTextNoOverflow: true,
        },
      },
    },
  ];

  const results = buildFrontendRegressionCaseResults(plan, phaseResults);
  assert.equal(results.length, 24);
  assert.deepEqual(results.map(item => item.status), Array.from({ length: 24 }, () => "PASS"));
});

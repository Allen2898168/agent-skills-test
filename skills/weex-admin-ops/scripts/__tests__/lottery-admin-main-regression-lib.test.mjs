import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRegressionCaseResults,
  evaluateAdminMainCase,
  resolvePhaseCommands,
} from "../lib/lottery-admin-main-regression-lib.mjs";

test("resolvePhaseCommands expands all commands in one phase and applies visible mode", () => {
  const phase = {
    phaseId: "create_prizes",
    commands: [
      ["script-a.mjs", "--x", "1"],
      ["script-b.mjs", "--y", "2"],
    ],
  };
  const commands = resolvePhaseCommands(phase, { visible: true }, { activityAlias: "", activityId: "" });
  assert.deepEqual(commands, [
    ["script-a.mjs", "--x", "1", "--visible"],
    ["script-b.mjs", "--y", "2", "--visible"],
  ]);
});

test("buildRegressionCaseResults maps supported prize cases from successful child results", () => {
  const plan = {
    phases: [
      {
        phaseId: "create_prizes",
        caseIds: ["PM-04", "PM-05"],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "create_prizes",
      ok: true,
      payload: { ok: true },
      cases: [
        { caseId: "PM-04", caseName: "新增奖品-赠金" },
        { caseId: "PM-05", caseName: "新增奖品-币种BTC" },
      ],
      childResults: [
        {
          ok: true,
          payload: {
            ok: true,
            created: [
              { id: "476", category: "赠金", subtype: "赠金" },
              { id: "477", category: "币种", subtype: "BTC" },
            ],
          },
        },
      ],
    },
  ];
  const caseResults = buildRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(caseResults.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "PM-04", status: "PASS" },
    { caseId: "PM-05", status: "PASS" },
  ]);
});

test("buildRegressionCaseResults marks all cases in a failed phase as FAIL and keeps phase metadata", () => {
  const plan = {
    phases: [
      {
        phaseId: "create_lottery_activity_draft",
        caseIds: ["AC-01", "AC-02"],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "create_lottery_activity_draft",
      ok: false,
      cases: [
        { caseId: "AC-01", caseName: "新增活动-最小必填草稿" },
        { caseId: "AC-02", caseName: "长度限制-活动标题/副标题" },
      ],
    },
  ];
  const caseResults = buildRegressionCaseResults(plan, phaseResults);
  assert.equal(caseResults[0].phaseId, "create_lottery_activity_draft");
  assert.equal(caseResults[0].status, "FAIL");
  assert.equal(caseResults[1].status, "FAIL");
});

test("buildRegressionCaseResults marks unexecuted later phases as SKIPPED", () => {
  const plan = {
    phases: [
      {
        phaseId: "create_prizes",
        caseIds: ["PM-04"],
      },
      {
        phaseId: "create_register_templates",
        caseIds: ["RT-03"],
      },
    ],
  };
  const phaseResults = [
    {
      phaseId: "create_prizes",
      ok: false,
      cases: [
        { caseId: "PM-04", caseName: "新增奖品-赠金" },
      ],
    },
  ];
  const caseResults = buildRegressionCaseResults(plan, phaseResults);
  assert.deepEqual(caseResults.map(item => ({ caseId: item.caseId, status: item.status })), [
    { caseId: "PM-04", status: "FAIL" },
    { caseId: "RT-03", status: "SKIPPED" },
  ]);
});

test("evaluateAdminMainCase validates AC-01 from lottery draft payload", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AC-01", caseName: "新增活动-最小必填草稿" },
    {
      phaseId: "create_lottery_activity_draft",
      ok: true,
      payload: {
        ok: true,
        verifyFirst: { id: 9223, showUrl: "lottery-admin-main-1" },
      },
    }
  );
  assert.equal(result.status, "PASS");
});

test("evaluateAdminMainCase validates AC-07 by checking 8 prizes in verifyFirst", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AC-07", caseName: "奖品配置区" },
    {
      phaseId: "create_lottery_activity_draft",
      ok: true,
      payload: {
        ok: true,
        verifyFirst: {
          prize: Array.from({ length: 8 }, (_, i) => ({ id: i + 1 })),
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
});

test("evaluateAdminMainCase validates AC-08 by checking taskRequirement exists", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AC-08", caseName: "活动任务信息绑定" },
    {
      phaseId: "create_lottery_activity_draft",
      ok: true,
      payload: {
        ok: true,
        verifyFirst: {
          taskRequirement: [{ id: 4998 }, { id: 4997 }, { id: 4996 }, { id: 5102 }],
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
});

test("evaluateAdminMainCase validates AC-08 by checking taskConfig exists in activity detail payload", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AC-08", caseName: "活动任务信息绑定" },
    {
      phaseId: "create_lottery_activity_draft",
      ok: true,
      payload: {
        ok: true,
        verifyFirst: {
          taskConfig: [{ id: 4998 }, { id: 4997 }],
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
});

test("evaluateAdminMainCase validates ST-01 by checking ONLINE status", () => {
  const result = evaluateAdminMainCase(
    { caseId: "ST-01", caseName: "草稿上线" },
    {
      phaseId: "online_lottery_activity",
      ok: true,
      payload: {
        ok: true,
        verifyItem: { status: "ONLINE" },
      },
    }
  );
  assert.equal(result.status, "PASS");
});

test("evaluateAdminMainCase validates PM-04 to PM-07 from created prize child results", () => {
  const phaseResult = {
    phaseId: "create_prizes",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          created: [
            { id: "476", category: "赠金", subtype: "赠金", alias: "auto_bonus_1" },
            { id: "477", category: "币种", subtype: "BTC", alias: "auto_btc_1" },
            { id: "478", category: "实物", subtype: "实物", alias: "auto_physical_1" },
            { id: "479", category: "虚拟积分或资格", subtype: "抽奖次数", alias: "auto_draw_count_1" },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "PM-04", caseName: "新增奖品-赠金" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "PM-05", caseName: "新增奖品-币种BTC" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "PM-06", caseName: "新增奖品-实物" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "PM-07", caseName: "新增奖品-虚拟积分或资格" }, phaseResult).status, "PASS");
});

test("evaluateAdminMainCase keeps prize-specific evidence for PM-04", () => {
  const result = evaluateAdminMainCase(
    { caseId: "PM-04", caseName: "新增奖品-赠金" },
    {
      phaseId: "create_prizes",
      ok: true,
      payload: { ok: true },
      childResults: [
        {
          ok: true,
          payload: {
            ok: true,
            created: [
              { id: "476", category: "赠金", subtype: "赠金", name: "自动化测试 - 赠金", alias: "auto_bonus_1", submitStatus: 200 },
            ],
          },
        },
      ],
    }
  );
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.evidence, {
    ok: undefined,
    alias: "auto_bonus_1",
    activityId: "476",
    prizeCount: 0,
    taskRequirementCount: 0,
    status: "",
    onlineCode: "",
    recordType: "prize",
    prizeId: "476",
    category: "赠金",
    subtype: "赠金",
    name: "自动化测试 - 赠金",
  });
});

test("evaluateAdminMainCase requires 抽奖次数 subtype for PM-07 in current plan", () => {
  const result = evaluateAdminMainCase(
    { caseId: "PM-07", caseName: "新增奖品-虚拟积分或资格" },
    {
      phaseId: "create_prizes",
      ok: true,
      payload: { ok: true },
      childResults: [
        {
          ok: true,
          payload: {
            ok: true,
            created: [
              { id: "479", category: "虚拟积分或资格", subtype: "VIP体验卡", alias: "auto_vip_1", submitStatus: 200 },
            ],
          },
        },
      ],
    }
  );
  assert.equal(result.status, "FAIL");
});

test("evaluateAdminMainCase marks unsupported prize row-action cases as SKIPPED", () => {
  const result = evaluateAdminMainCase(
    { caseId: "PM-08", caseName: "奖品行操作-查看" },
    {
      phaseId: "create_prizes",
      ok: true,
      payload: { ok: true },
      childResults: [{ ok: true, payload: { ok: true, created: [{ id: "476", category: "赠金", subtype: "赠金" }] } }],
    }
  );
  assert.equal(result.status, "SKIPPED");
});

test("evaluateAdminMainCase validates PM-08 to PM-11 from prize row-action results", () => {
  const phaseResult = {
    phaseId: "create_prizes",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          results: [
            {
              originalId: "476",
              originalName: "操作列临时奖品",
              originalAlias: "prize_row_action_temp_1",
              modifiedName: "操作列临时奖品_已修改",
              copiedId: "477",
              steps: [
                { step: "view", status: 200, responseCode: 200, viewedName: "操作列临时奖品", viewedAlias: "prize_row_action_temp_1" },
                { step: "modify", status: 200, responseCode: 200, row: ["476", "赠金", "赠金", "操作列临时奖品_已修改", "prize_row_action_temp_1"] },
                { step: "copy", confirmText: "确认复制", copied: { id: "477", name: "复制从 操作列临时奖品_已修改", alias: "prize_row_action_temp_1" } },
                { step: "delete", status: 200, responseCode: 200, deletedId: "477", rowAbsentAfterSearch: true },
              ],
            },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "PM-08", caseName: "奖品行操作-查看" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "PM-09", caseName: "奖品行操作-修改" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "PM-10", caseName: "奖品行操作-复制" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "PM-11", caseName: "奖品行操作-删除" }, phaseResult).status, "PASS");
});

test("evaluateAdminMainCase keeps row-action evidence for PM-10", () => {
  const result = evaluateAdminMainCase(
    { caseId: "PM-10", caseName: "奖品行操作-复制" },
    {
      phaseId: "create_prizes",
      ok: true,
      payload: { ok: true },
      childResults: [
        {
          ok: true,
          payload: {
            ok: true,
            results: [
              {
                originalId: "476",
                originalName: "操作列临时奖品",
                originalAlias: "prize_row_action_temp_1",
                modifiedName: "操作列临时奖品_已修改",
                copiedId: "477",
                steps: [
                  { step: "copy", confirmText: "确认复制", copied: { id: "477", name: "复制从 操作列临时奖品_已修改", alias: "prize_row_action_temp_1" } },
                ],
              },
            ],
          },
        },
      ],
    }
  );
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.evidence, {
    ok: undefined,
    alias: "prize_row_action_temp_1",
    activityId: "476",
    prizeCount: 0,
    taskRequirementCount: 0,
    status: "",
    onlineCode: "",
    recordType: "prize_row_action",
    actionStep: "copy",
    prizeId: "476",
    copiedPrizeId: "477",
    name: "操作列临时奖品",
    modifiedName: "操作列临时奖品_已修改",
  });
});

test("evaluateAdminMainCase validates RT-03 and RT-04 from created register templates", () => {
  const phaseResult = {
    phaseId: "create_register_templates",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          created: [
            {
              name: "自动化报名模板_auto_1",
              signupMode: "注册即报名",
              platformScope: "全平台用户",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
            {
              name: "自动化报名模板_manual_1",
              signupMode: "用户手动点击报名",
              platformScope: "全平台用户",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "RT-03", caseName: "模版新增-最小主链路（全平台用户）" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "RT-04", caseName: "模版新增-全平台用户+用户手动点击报名" }, phaseResult).status, "PASS");
});

test("evaluateAdminMainCase marks uncovered register template branch and row-action cases as SKIPPED", () => {
  const phaseResult = {
    phaseId: "create_register_templates",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          created: [
            {
              name: "自动化报名模板_auto_1",
              signupMode: "注册即报名",
              platformScope: "全平台用户",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "RT-05", caseName: "模版新增-平台用户参与范围分支" }, phaseResult).status, "SKIPPED");
  assert.equal(evaluateAdminMainCase({ caseId: "RT-07", caseName: "模版行操作-查看" }, phaseResult).status, "SKIPPED");
});

test("evaluateAdminMainCase validates TM-07 and TM-09 from created task records", () => {
  const phaseResult = {
    phaseId: "create_roulette_tasks",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          created: [
            {
              id: "5056",
              name: "转盘抽奖_all_1",
              scope: "报名的所有用户",
              taskCondition: "KOL绑定",
              rewardMode: "单一奖励",
              rewardMin: "10",
              rewardMax: "100",
              submit: { status: 200, body: { code: 200 } },
            },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "TM-07", caseName: "新增任务-最小必填链路" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-09", caseName: "奖励模式-单一奖励" }, phaseResult).status, "PASS");
});

test("evaluateAdminMainCase marks uncovered task condition and other reward-mode cases as SKIPPED", () => {
  const phaseResult = {
    phaseId: "create_roulette_tasks",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          created: [
            {
              id: "5056",
              name: "转盘抽奖_all_1",
              scope: "报名的所有用户",
              taskCondition: "KOL绑定",
              rewardMode: "单一奖励",
              rewardMin: "10",
              rewardMax: "100",
              submit: { status: 200, body: { code: 200 } },
            },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "TM-08", caseName: "任务条件分支覆盖" }, phaseResult).status, "SKIPPED");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-10", caseName: "奖励模式-限时奖励不同" }, phaseResult).status, "SKIPPED");
});

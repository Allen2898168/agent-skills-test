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

test("resolvePhaseCommands replaces created placeholders for follow-up activity list phases", () => {
  const phase = {
    phaseId: "verify_activity_list_draft",
    commands: [
      ["script-a.mjs", "--activity-alias", "<created-alias>"],
      ["script-b.mjs", "--activity-id", "<created-id>"],
    ],
  };
  const commands = resolvePhaseCommands(phase, { visible: false }, { activityAlias: "demo-alias", activityId: "9107" });
  assert.deepEqual(commands, [
    ["script-a.mjs", "--activity-alias", "demo-alias"],
    ["script-b.mjs", "--activity-id", "9107"],
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

test("evaluateAdminMainCase validates AL-06 from draft row action visibility payload", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AL-06", caseName: "草稿活动行操作" },
    {
      phaseId: "verify_activity_list_draft",
      ok: true,
      payload: {
        ok: true,
        activityId: "9107",
        alias: "lottery-admin-main-1",
        draftRowActions: {
          ok: true,
          actions: ["查看", "修改", "上线", "删除", "复制"],
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.evidence.recordType, "activity_row_action_visibility");
  assert.equal(result.evidence.stage, "draft");
});

test("evaluateAdminMainCase validates AL-07 from online row action visibility and copy payload", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AL-07", caseName: "已上线活动行操作" },
    {
      phaseId: "verify_activity_list_online",
      ok: true,
      payload: {
        ok: true,
        activityId: "9107",
        alias: "lottery-admin-main-1",
        onlineRowActions: {
          ok: true,
          actions: ["查看", "修改", "下线", "复制"],
        },
        copyCheck: {
          copiedId: "9108",
          copiedAlias: "lottery-copy-1",
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.evidence.recordType, "activity_row_action_visibility");
  assert.equal(result.evidence.stage, "online");
  assert.equal(result.evidence.copiedActivityId, "9108");
});

test("evaluateAdminMainCase validates AC-15 from activity copy payload", () => {
  const result = evaluateAdminMainCase(
    { caseId: "AC-15", caseName: "活动复制" },
    {
      phaseId: "verify_activity_list_online",
      ok: true,
      payload: {
        ok: true,
        activityId: "9107",
        alias: "lottery-admin-main-1",
        copyCheck: {
          copiedId: "9108",
          copiedAlias: "lottery-copy-1",
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.evidence.recordType, "activity_copy");
  assert.equal(result.evidence.copiedActivityId, "9108");
});

test("evaluateAdminMainCase validates RT-01 and RT-02 from register template search payload", () => {
  const phaseResult = {
    phaseId: "verify_register_template_search",
    ok: true,
    payload: {
      ok: true,
      searchChecks: {
        byName: {
          ok: true,
          recordType: "register_template_search",
          searchBy: "name",
          templateId: "2781",
          templateName: "自动化报名模板_auto_1",
          searchedValue: "自动化报名模板_auto_1",
          rowCount: 1,
        },
        byId: {
          ok: true,
          recordType: "register_template_search",
          searchBy: "id",
          templateId: "2781",
          templateName: "自动化报名模板_auto_1",
          searchedValue: "2781",
          rowCount: 1,
        },
      },
    },
  };
  assert.equal(evaluateAdminMainCase({ caseId: "RT-01", caseName: "模版列表搜索-模版名称" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "RT-02", caseName: "模版列表搜索-模版ID" }, phaseResult).status, "PASS");
});

test("evaluateAdminMainCase validates TM-01 to TM-06 from task search payload", () => {
  const phaseResult = {
    phaseId: "create_roulette_tasks",
    ok: true,
    payload: {
      ok: true,
      searchChecks: {
        byId: { ok: true, recordType: "task_search", searchBy: "id", taskId: "5056", taskAlias: "转盘抽奖_all_1", searchedValue: "5056", rowCount: 1 },
        byAlias: { ok: true, recordType: "task_search", searchBy: "alias", taskId: "5056", taskAlias: "转盘抽奖_all_1", searchedValue: "转盘抽奖_all_1", rowCount: 1 },
        byTag: { ok: true, recordType: "task_search", searchBy: "tag", taskId: "5056", taskAlias: "转盘抽奖_all_1", searchedValue: "rall12345", rowCount: 1 },
        byRemark: { ok: true, recordType: "task_search", searchBy: "remark", taskId: "5056", taskAlias: "转盘抽奖_all_1", searchedValue: "自动化-报名的所有用户", rowCount: 1 },
        byStartTime: { ok: true, recordType: "task_search", searchBy: "start_time", taskId: "5056", taskAlias: "转盘抽奖_all_1", searchedValue: "2026-05-22", rowCount: 1 },
        byEndTime: { ok: true, recordType: "task_search", searchBy: "end_time", taskId: "5056", taskAlias: "转盘抽奖_all_1", searchedValue: "2026-05-22", rowCount: 1 },
      },
    },
  };
  assert.equal(evaluateAdminMainCase({ caseId: "TM-01", caseName: "任务列表搜索-任务编号" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-02", caseName: "任务列表搜索-任务别名" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-03", caseName: "任务列表搜索-任务标签" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-04", caseName: "任务列表搜索-备注" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-05", caseName: "任务列表搜索-开始时间" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-06", caseName: "任务列表搜索-结束时间" }, phaseResult).status, "PASS");
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

test("evaluateAdminMainCase validates ST-02 by checking OFFLINE status", () => {
  const result = evaluateAdminMainCase(
    { caseId: "ST-02", caseName: "已上线活动下线" },
    {
      phaseId: "offline_lottery_activity",
      ok: true,
      payload: {
        ok: true,
        verifyItem: { status: "OFFLINE" },
        offlineBody: { code: 200 },
      },
    }
  );
  assert.equal(result.status, "PASS");
});

test("evaluateAdminMainCase validates ST-03 from copied draft delete payload", () => {
  const result = evaluateAdminMainCase(
    { caseId: "ST-03", caseName: "草稿删除" },
    {
      phaseId: "verify_activity_list_online",
      ok: true,
      payload: {
        ok: true,
        deleteCopiedDraft: {
          code: 200,
          rowAbsentAfterSearch: true,
          confirmText: "删除确认",
        },
      },
    }
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.evidence.recordType, "activity_delete");
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
    error: "",
    alias: "auto_bonus_1",
    activityId: "476",
    prizeCount: 0,
    taskRequirementCount: 0,
    status: "",
    onlineCode: "",
    finalUrl: "",
    pageText: "",
    responseCount: 0,
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
    error: "",
    alias: "prize_row_action_temp_1",
    activityId: "476",
    prizeCount: 0,
    taskRequirementCount: 0,
    status: "",
    onlineCode: "",
    finalUrl: "",
    pageText: "",
    responseCount: 0,
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

test("evaluateAdminMainCase validates RT-05 and RT-06 from created register template branches", () => {
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
              platformScope: "指定渠道码或邀请码",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
            {
              name: "自动化报名模板_auto_2",
              signupMode: "注册即报名",
              platformScope: "自然流量",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
            {
              name: "自动化报名模板_auto_3",
              signupMode: "注册即报名",
              platformScope: "非活跃用户",
              restrictScope: "无",
              registerTimeRange: { start: "2026-05-22 10:00:00", end: "2027-05-22 10:00:00" },
              status: 200,
              responseCode: 200,
            },
            {
              name: "自动化报名模板_auto_4",
              signupMode: "注册即报名",
              platformScope: "混合条件",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
            {
              name: "自动化报名模板_auto_5",
              signupMode: "注册即报名",
              platformScope: "假钱账户",
              restrictScope: "无",
              status: 200,
              responseCode: 200,
            },
          ],
        },
      },
    ],
  };

  assert.equal(evaluateAdminMainCase({ caseId: "RT-05", caseName: "模版新增-平台用户参与范围分支" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "RT-06", caseName: "模版新增-可参与注册时间范围" }, phaseResult).status, "PASS");
});

test("evaluateAdminMainCase validates RT-07 to RT-09 from register template row actions", () => {
  const phaseResult = {
    phaseId: "verify_register_template_row_actions",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          results: [
            {
              id: "2781",
              originalName: "操作列临时模板_1",
              modifiedName: "操作列临时模板_1_已修改",
              steps: [
                { step: "view", status: 200, responseCode: 200, title: "用户报名管理（查看）" },
                { step: "modify", status: 200, responseCode: 200, row: ["2781", "操作列临时模板_1_已修改"] },
                { step: "delete", status: 200, responseCode: 200, rowAbsentAfterSearch: true, confirmText: "确认删除" },
              ],
            },
          ],
        },
      },
    ],
  };
  assert.equal(evaluateAdminMainCase({ caseId: "RT-07", caseName: "模版行操作-查看" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "RT-08", caseName: "模版行操作-修改" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "RT-09", caseName: "模版行操作-删除" }, phaseResult).status, "PASS");
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

test("evaluateAdminMainCase marks uncovered task condition case as SKIPPED", () => {
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
});

test("evaluateAdminMainCase validates TM-10 and TM-11 from reward-mode task records", () => {
  const phaseResult = {
    phaseId: "create_roulette_reward_mode_tasks",
    ok: true,
    payload: { ok: true },
    childResults: [
      {
        ok: true,
        payload: {
          ok: true,
          created: [
            {
              id: "5204",
              name: "转盘抽奖_limited_20260522021421",
              scope: "报名的所有用户",
              taskCondition: "KOL绑定",
              rewardMode: "限时奖励不同",
              rewardMin: "10",
              rewardMax: "100",
              submit: { status: 200, body: { code: 200 } },
            },
            {
              id: "5205",
              name: "转盘抽奖_rights_20260522021848",
              scope: "报名的所有用户",
              taskCondition: "KOL绑定",
              rewardMode: "正常奖励+权益奖励",
              rewardMin: "10",
              rewardMax: "100",
              submit: { status: 200, body: { code: 200 } },
            },
          ],
        },
      },
    ],
  };
  assert.equal(evaluateAdminMainCase({ caseId: "TM-10", caseName: "奖励模式-限时奖励不同" }, phaseResult).status, "PASS");
  assert.equal(evaluateAdminMainCase({ caseId: "TM-11", caseName: "奖励模式-正常奖励+权益奖励" }, phaseResult).status, "PASS");
});

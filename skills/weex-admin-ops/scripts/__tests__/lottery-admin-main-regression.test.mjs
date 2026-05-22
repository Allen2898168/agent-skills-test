import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { matchAction } from "../cache/matcher.mjs";
import { commandFor } from "../cache/command.mjs";
import { buildPlan } from "../lottery-admin-main-regression.mjs";

const skillRoot = path.resolve(
  "/Users/jonathan/Documents/Codex/2026-05-05/https-github-com-allen2898168-agent-skills/agent-skills-test/skills/weex-admin-ops"
);

test("matcher routes admin main regression query to lottery_admin_main_regression", () => {
  const manifest = {
    actions: [
      {
        id: "lottery_admin_main_regression",
        intentKeywords: ["回归", "自动化"],
        objectKeywords: ["后管", "转盘抽奖"],
        scopeKeywords: ["主回归"],
      },
      {
        id: "create_lottery_activity_draft",
        intentKeywords: ["创建"],
        objectKeywords: ["活动"],
      },
    ],
  };
  const match = matchAction(manifest, {
    query: "帮我跑一轮转盘抽奖后管主回归自动化",
    passthrough: {},
  });
  assert.equal(match.action.id, "lottery_admin_main_regression");
});

test("command builder includes title alias uid country and visible flags for admin main regression", () => {
  const match = {
    action: {
      id: "lottery_admin_main_regression",
      script: "scripts/lottery-admin-main-regression.mjs",
    },
    inferred: {
      titlePrefix: "后管主回归",
      aliasPrefix: "admin-main",
      uid: "9881271952",
      country: "中国",
      visible: true,
    },
  };
  const args = {
    dryRun: false,
    visible: false,
    passthrough: {},
  };
  const { commandArgs } = commandFor(match, args, skillRoot);
  assert.deepEqual(commandArgs, [
    path.join(skillRoot, "scripts/lottery-admin-main-regression.mjs"),
    "--title-prefix",
    "后管主回归",
    "--alias-prefix",
    "admin-main",
    "--uid",
    "9881271952",
    "--country",
    "中国",
    "--visible",
  ]);
});

test("buildPlan expands register template coverage into create, search, and row-action phases", () => {
  const plan = buildPlan({ visible: false });
  const createPhase = plan.phases.find(item => item.phaseId === "create_register_templates");
  const searchPhase = plan.phases.find(item => item.phaseId === "verify_register_template_search");
  const rowActionPhase = plan.phases.find(item => item.phaseId === "verify_register_template_row_actions");
  assert.ok(createPhase, "create_register_templates phase should exist");
  assert.deepEqual(createPhase.caseIds, ["RT-03", "RT-04", "RT-05", "RT-06"]);
  assert.deepEqual(createPhase.commands.slice(0, 5), [
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--name-prefix", "自动化报名模板"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "manual", "--name-prefix", "自动化报名模板"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "team", "--name-prefix", "自动化报名模板", "--min-team", "2"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto_manual", "--name-prefix", "自动化报名模板"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--platform-scopes", "channel_invite,natural,non_active,mixed,fake_money", "--name-prefix", "自动化报名模板"],
  ]);
  assert.deepEqual(createPhase.commands[5].slice(0, 6), [
    "skills/weex-admin-ops/scripts/create-register-templates.mjs",
    "--signup-modes",
    "auto",
    "--platform-scopes",
    "non_active",
    "--register-start",
  ]);
  assert.match(createPhase.commands[5][6], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(createPhase.commands[5].slice(7), [
    "--register-end",
    createPhase.commands[5][8],
    "--name-prefix",
    "自动化报名模板",
  ]);
  assert.match(createPhase.commands[5][8], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(searchPhase.caseIds, ["RT-01", "RT-02"]);
  assert.deepEqual(searchPhase.dependsOn, ["create_register_templates"]);
  assert.deepEqual(searchPhase.commands, [
    ["skills/weex-admin-ops/scripts/register-template-search-checks.mjs", "--name-prefix", "自动化报名模板"],
  ]);
  assert.deepEqual(rowActionPhase.caseIds, ["RT-07", "RT-08", "RT-09"]);
  assert.deepEqual(rowActionPhase.commands, [
    ["skills/weex-admin-ops/scripts/register-template-row-actions.mjs", "--name-prefix", "操作列临时模板"],
  ]);
});

test("buildPlan includes task search coverage inside the roulette task phase", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_roulette_tasks");
  assert.deepEqual(phase.caseIds, ["TM-01", "TM-02", "TM-03", "TM-04", "TM-05", "TM-06", "TM-07", "TM-09"]);
});

test("buildPlan includes dedicated task-condition phase", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_roulette_condition_tasks");
  assert.deepEqual(phase.caseIds, ["TM-08"]);
  assert.deepEqual(phase.commands, [
    ["skills/weex-admin-ops/scripts/create-roulette-condition-tasks.mjs", "--conditions", "kol,contract,spot,recharge"],
  ]);
});

test("buildPlan includes dedicated reward-mode task phase", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_roulette_reward_mode_tasks");
  assert.deepEqual(phase.caseIds, ["TM-10", "TM-11"]);
  assert.deepEqual(phase.commands, [
    ["skills/weex-admin-ops/scripts/create-roulette-reward-mode-tasks.mjs", "--modes", "limited,rights"],
  ]);
});

test("buildPlan runs draft creation in headless real UI mode by default", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_lottery_activity_draft");
  assert.ok(phase, "create_lottery_activity_draft phase should exist");
  assert.equal(phase.commands[0].includes("--headless-ui"), true);
});

test("buildPlan phase metadata keeps dependency ordering for filtered execution", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "online_lottery_activity");
  assert.deepEqual(phase.dependsOn, ["create_lottery_activity_draft"]);
});

test("buildPlan includes activity list verification phases around draft and online activity states", () => {
  const plan = buildPlan({ visible: false });
  const draftPhase = plan.phases.find(item => item.phaseId === "verify_activity_list_draft");
  const onlinePhase = plan.phases.find(item => item.phaseId === "verify_activity_list_online");
  const offlinePhase = plan.phases.find(item => item.phaseId === "offline_lottery_activity");
  assert.deepEqual(draftPhase.caseIds, ["AL-01", "AL-02", "AL-03", "AL-04", "AL-05", "AL-06"]);
  assert.deepEqual(draftPhase.dependsOn, ["create_lottery_activity_draft"]);
  assert.deepEqual(onlinePhase.caseIds, ["AL-07", "AC-15", "ST-03"]);
  assert.deepEqual(onlinePhase.dependsOn, ["online_lottery_activity"]);
  assert.deepEqual(offlinePhase.caseIds, ["ST-02"]);
  assert.deepEqual(offlinePhase.dependsOn, ["online_lottery_activity"]);
  assert.deepEqual(offlinePhase.commands, [
    ["skills/weex-admin-ops/scripts/offline-lottery-activity.mjs", "--activity-alias", "<created-alias>"],
  ]);
});

test("buildPlan collapses regression prize creation into one command plus row actions", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_prizes");
  assert.deepEqual(phase.commands, [
    ["skills/weex-admin-ops/scripts/create-regression-prizes.mjs"],
    ["skills/weex-admin-ops/scripts/prize-row-actions.mjs", "--category", "赠金", "--subtype", "赠金", "--count", "1", "--name-prefix", "操作列临时奖品", "--alias-prefix", "prize_row_action_temp"],
  ]);
});

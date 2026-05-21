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

test("buildPlan splits register template creation into independent mode commands", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_register_templates");
  assert.ok(phase, "create_register_templates phase should exist");
  assert.deepEqual(phase.commands, [
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto", "--name-prefix", "自动化报名模板"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "manual", "--name-prefix", "自动化报名模板"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "team", "--name-prefix", "自动化报名模板", "--min-team", "2"],
    ["skills/weex-admin-ops/scripts/create-register-templates.mjs", "--signup-modes", "auto_manual", "--name-prefix", "自动化报名模板"],
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

test("buildPlan collapses regression prize creation into one command plus row actions", () => {
  const plan = buildPlan({ visible: false });
  const phase = plan.phases.find(item => item.phaseId === "create_prizes");
  assert.deepEqual(phase.commands, [
    ["skills/weex-admin-ops/scripts/create-regression-prizes.mjs"],
    ["skills/weex-admin-ops/scripts/prize-row-actions.mjs", "--category", "赠金", "--subtype", "赠金", "--count", "1", "--name-prefix", "操作列临时奖品", "--alias-prefix", "prize_row_action_temp"],
  ]);
});

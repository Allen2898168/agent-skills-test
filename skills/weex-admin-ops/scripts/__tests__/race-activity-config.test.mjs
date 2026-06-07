import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchAction } from "../cache/matcher.mjs";
import { commandFor } from "../cache/command.mjs";
import { buildWizardMenu } from "../race-config-wizard-api.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(skillRoot, "../..");

test("matcher routes race activity create query to configure_race_activity", () => {
  const manifest = {
    actions: [
      {
        id: "configure_race_activity",
        intentKeywords: ["配置", "创建", "新增"],
        objectKeywords: ["交易竞速赛"],
      },
      {
        id: "configure_newbie_activity",
        intentKeywords: ["配置"],
        objectKeywords: ["新手活动"],
      },
    ],
  };
  const match = matchAction(manifest, {
    query: "帮我配置一个交易竞速赛活动并支持删除",
    passthrough: {},
  });
  assert.equal(match.action.id, "configure_race_activity");
});

test("command builder supports race activity wizard and module snapshot", () => {
  const createMatch = {
    action: {
      id: "configure_race_activity",
      script: "scripts/race-config-wizard-api.mjs",
    },
    inferred: {
      templateId: "9209",
      titlePrefix: "竞速赛回归",
      aliasPrefix: "sr",
    },
  };
  const createCommand = commandFor(createMatch, { dryRun: true, passthrough: {} }, skillRoot);
  assert.deepEqual(createCommand.commandArgs, [
    path.join(skillRoot, "scripts/race-config-wizard-api.mjs"),
    "--wizard",
    "--template-id",
    "9209",
    "--title-prefix",
    "竞速赛回归",
    "--alias-prefix",
    "sr",
    "--dry-run",
  ]);

  const moduleMatch = {
    action: {
      id: "configure_race_activity_modules",
      script: "scripts/race-activity-module-config-fast-api.mjs",
    },
    inferred: {
      activityAlias: "sr12345678",
    },
  };
  const moduleCommand = commandFor(moduleMatch, { dryRun: true, passthrough: {} }, skillRoot);
  assert.deepEqual(moduleCommand.commandArgs, [
    path.join(skillRoot, "scripts/race-activity-module-config-fast-api.mjs"),
    "--wizard",
    "--action",
    "snapshot",
    "--activity-alias",
    "sr12345678",
    "--dry-run",
  ]);
});

test("race wizard exposes minimal full and delete presets", () => {
  const menu = buildWizardMenu(path.resolve(repoRoot, "../../activity-web"));
  assert.equal(menu.domain, "活动列表 / 交易竞速赛(RACE_COMPETITION)");
  assert.ok(Array.isArray(menu.supportedModules));
  assert.ok(menu.supportedModules.find(item => item.key === "speedConfig"));
  assert.deepEqual(
    menu.presets.map(item => item.preset),
    ["minimal_create_verify_delete", "full_create_verify_delete", "create_draft", "online", "offline", "delete"],
  );
});

import test from "node:test";
import assert from "node:assert/strict";

import { loadLotteryRegressionManifest, resolveScenarioSelection } from "../lib/lottery-regression-manifest.mjs";
import { resolvePreconditions } from "../lib/lottery-precondition-resolver.mjs";

test("frontend main regression auto-handles staged frontend preconditions", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("报名链路, 单抽主流程, 我的奖品 / 奖励记录", manifest);
  const preconditions = resolvePreconditions(selection.selectedScenarios, manifest);
  const byKey = new Map(preconditions.map(item => [item.key, item]));

  assert.equal(byKey.get("FRONTEND_SESSION")?.autoHandled, true);
  assert.equal(byKey.get("NORMAL_ACTIVITY_ONLINE")?.autoHandled, true);
  assert.equal(byKey.get("NORMAL_ACTIVITY_SIGNED_UP")?.autoHandled, true);
  assert.equal(byKey.get("NORMAL_ACTIVITY_DRAW_GE1")?.autoHandled, true);
  assert.equal(byKey.get("REWARD_RECORD_DELAY_READY")?.autoHandled, true);
});

test("frontend five-draw precondition remains manual until dedicated entrypoint is implemented", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("五连抽主流程", manifest);
  const preconditions = resolvePreconditions(selection.selectedScenarios, manifest);
  const gt5 = preconditions.find(item => item.key === "NORMAL_ACTIVITY_DRAW_GT5");
  assert.ok(gt5);
  assert.equal(gt5.autoHandled, false);
});

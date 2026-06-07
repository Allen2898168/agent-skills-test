import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const scriptPath = path.join(repoRoot, "orchestrations/automation-review-pipeline/scripts/resolve-entry-mode.mjs");

function run(args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const payload = JSON.parse((result.stdout || result.stderr).trim());
  return { status: result.status ?? 1, payload };
}

test("subagent链路活动后管全量回归默认进入 automation review pipeline", () => {
  const result = run([
    "--requirement",
    "subagent链路 全量回归活动后管",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.payload.routingDecision, "automation_review_pipeline");
  assert.equal(result.payload.mustUseAutomationReviewPipeline, true);
  assert.equal(result.payload.historyRequired, true);
  assert.ok(result.payload.reasons.some(item => item.includes("subagent")));
  assert.ok(result.payload.requiredSteps.includes("prepare-run"));
});

test("超过 10 个用例即使未写 subagent 也默认进入 pipeline", () => {
  const result = run([
    "--requirement",
    "活动后管回归 12 个用例",
    "--case-count",
    "12",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.payload.routingDecision, "automation_review_pipeline");
  assert.equal(result.payload.matchedSignals.caseCountExceeded, true);
});

test("普通单链路需求默认保持 direct skill flow", () => {
  const result = run([
    "--requirement",
    "创建一个转盘抽奖草稿并校验标题",
    "--case-count",
    "3",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.payload.routingDecision, "direct_skill_flow");
  assert.equal(result.payload.mustUseAutomationReviewPipeline, false);
  assert.deepEqual(result.payload.requiredSteps, []);
});

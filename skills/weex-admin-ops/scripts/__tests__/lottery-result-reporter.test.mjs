import test from "node:test";
import assert from "node:assert/strict";

import { loadLotteryRegressionManifest, resolveScenarioSelection } from "../lib/lottery-regression-manifest.mjs";
import { summarizeDispatcherResult } from "../lib/lottery-result-reporter.mjs";

test("reporter synthesizes skipped case results for selected but not yet automated cases", () => {
  const manifest = loadLotteryRegressionManifest();
  const selection = resolveScenarioSelection("活动列表,奖品管理", manifest);
  const report = summarizeDispatcherResult({
    selectedScenarios: selection.selectedScenarios,
    manifest,
    executionResults: [
      {
        entrypoint: "lottery_admin_main_regression",
        caseResults: [
          {
            caseId: "PM-04",
            caseName: "新增奖品-赠金",
            module: "奖品管理",
            priority: "P0",
            phaseId: "create_prizes",
            status: "PASS",
            evidence: { ok: true },
          },
        ],
      },
    ],
  });

  const al01 = report.caseResults.find(item => item.caseId === "AL-01");
  const pm04 = report.caseResults.find(item => item.caseId === "PM-04");
  const activityList = report.scenarioResults.find(item => item.scenarioId === "admin_activity_list");

  assert.ok(al01);
  assert.equal(al01.status, "SKIPPED");
  assert.ok(pm04);
  assert.equal(pm04.status, "PASS");
  assert.ok(activityList);
  assert.equal(activityList.status, "SKIPPED");
});

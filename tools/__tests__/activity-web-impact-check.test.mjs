import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeActivityWebImpact } from "../lib/activity-web-impact.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function makeActivityWebFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "activity-web-impact-"));
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
  return root;
}

test("lottery prize component change recommends admin, frontend, and special regression coverage", () => {
  const result = analyzeActivityWebImpact({
    repoRoot,
    activityWebDir: makeActivityWebFixture({}),
    changedFiles: [
      "activity-ui/src/views/activity/lottery/components/prizeConfigForm.vue",
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(result.affectedAreas.some(item => item.id === "lottery_prize_config"));
  assert.ok(result.recommendedCaseIds.includes("AC-04"));
  assert.ok(result.recommendedCaseIds.includes("PM-01"));
  assert.ok(result.recommendedCaseIds.includes("FE-32"));
  assert.ok(result.recommendedCaseIds.includes("FE-25"));
  assert.ok(result.recommendedCaseIds.includes("FE-57"));
  assert.ok(result.recommendedActions.some(item => item.id === "configure_lottery_activity"));
  assert.ok(result.recommendedActions.some(item => item.id === "lottery_admin_main_regression"));
});

test("new lottery field and endpoint are reported as potential automation coverage gaps", () => {
  const activityWebDir = makeActivityWebFixture({
    "activity-ui/src/views/activity/lottery/components/prizeConfigForm.vue": `
      <el-form-item label="新字段角标" prop="badgeType">
        <el-select v-model="row.badgeType">
          <el-option label="新角标" value="BADGE_NEW" />
        </el-select>
      </el-form-item>
    `,
    "activity-ui/src/api/activity/lotteryExtra.js": `
      import request from '@/utils/request'
      export function createExtra(data) {
        return request({ url: '/activity/lottery/newFeature', method: 'post', data })
      }
    `,
  });

  const result = analyzeActivityWebImpact({
    repoRoot,
    activityWebDir,
    changedFiles: [
      "activity-ui/src/views/activity/lottery/components/prizeConfigForm.vue",
      "activity-ui/src/api/activity/lotteryExtra.js",
    ],
  });

  assert.ok(result.coverageGaps.some(item => item.type === "field" && item.name === "新字段角标"));
  assert.ok(result.coverageGaps.some(item => item.type === "field-model" && item.name === "badgeType"));
  assert.ok(result.coverageGaps.some(item => item.type === "enum" && item.name === "BADGE_NEW"));
  assert.ok(result.coverageGaps.some(item => item.type === "endpoint" && item.name === "/activity/lottery/newFeature"));
});

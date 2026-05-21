import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = "/Users/jonathan/Documents/Codex/2026-05-05/https-github-com-allen2898168-agent-skills/agent-skills-test";
const manifestPath = path.join(repoRoot, "docs/workflows/lottery-regression-manifest.json");

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

test("lottery regression manifest declares expected top-level structure", () => {
  const manifest = readManifest();
  assert.equal(typeof manifest.meta, "object");
  assert.equal(typeof manifest.scenarios, "object");
  assert.ok(Array.isArray(manifest.packs));
  assert.ok(Array.isArray(manifest.entries));
});

test("lottery regression manifest declares main and special entrypoints", () => {
  const manifest = readManifest();
  const packIds = new Set(manifest.packs.map((item) => item.packId));
  assert.ok(packIds.has("lottery_admin_main_regression"));
  assert.ok(packIds.has("lottery_frontend_main_regression"));
  assert.ok(packIds.has("lottery_low_stock_regression"));
  assert.ok(packIds.has("lottery_weight_regression"));
});

test("lottery regression manifest maps representative cases to expected scenarios", () => {
  const manifest = readManifest();
  const byCaseId = new Map(manifest.entries.map((item) => [item.caseId, item]));

  assert.equal(byCaseId.get("AC-14")?.scenarioKey, "WEIGHT_ACTIVITY_ONLINE");
  assert.equal(byCaseId.get("FE-25")?.scenarioKey, "NORMAL_ACTIVITY_DRAW_GT5");
  assert.equal(byCaseId.get("FE-57")?.scenarioKey, "LOW_STOCK_ACTIVITY_DRAW_GT5");
  assert.equal(byCaseId.get("FE-64")?.scenarioKey, "WEIGHT_ACTIVITY_DRAW_GE3");
  assert.equal(byCaseId.get("FE-84")?.scenarioKey, "NORMAL_ACTIVITY_SIGNED_UP");
});

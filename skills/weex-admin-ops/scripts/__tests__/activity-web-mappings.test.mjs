import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensureActivityWebDir,
  extractActivityTaskListTypes,
  extractLotteryRaffleStyles,
  resolveOptionValue,
} from "../lib/activity-web-mappings.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");

test("extractActivityTaskListTypes reads ACTIVITY_TASK_LIST_TYPE options", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { options } = extractActivityTaskListTypes(activityWebDir);
  assert.ok(Array.isArray(options));
  assert.ok(options.length > 5);
  const newbie = options.find(item => item.value === "BEGINNER_TASK");
  assert.ok(newbie);
  assert.equal(resolveOptionValue("新手活动", options), "BEGINNER_TASK");
  assert.equal(resolveOptionValue("beginner_task", options), "BEGINNER_TASK");
});

test("extractLotteryRaffleStyles reads raffleStyle label mapping", () => {
  const activityWebDir = ensureActivityWebDir(repoRoot);
  const { styles } = extractLotteryRaffleStyles(activityWebDir);
  assert.ok(Array.isArray(styles));
  assert.ok(styles.length >= 1);
  const first = styles[0];
  assert.ok(first.value);
  assert.ok(first.label);
  assert.equal(resolveOptionValue(first.label, styles), first.value);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  isExpiredSessionPromptText,
  shouldRestoreAdminSession,
} from "../lib/admin-session.mjs";

test("isExpiredSessionPromptText detects admin session expiry dialog copy", () => {
  assert.equal(isExpiredSessionPromptText("系统提示 登录状态已过期，您可以继续留在该页面，或者重新登录"), true);
});

test("shouldRestoreAdminSession returns true when current page is login page", () => {
  assert.equal(shouldRestoreAdminSession({
    currentUrl: "https://stg-activity.weex.tech/login?redirect=%2Findex",
    dialogText: "",
  }), true);
});

test("shouldRestoreAdminSession returns true when expiry dialog is visible on a business page", () => {
  assert.equal(shouldRestoreAdminSession({
    currentUrl: "https://stg-activity.weex.tech/activities/lottery",
    dialogText: "登录状态已过期，您可以继续留在该页面，或者重新登录",
  }), true);
});

test("shouldRestoreAdminSession returns false for normal business page without expiry signal", () => {
  assert.equal(shouldRestoreAdminSession({
    currentUrl: "https://stg-activity.weex.tech/activities/lottery",
    dialogText: "",
  }), false);
});

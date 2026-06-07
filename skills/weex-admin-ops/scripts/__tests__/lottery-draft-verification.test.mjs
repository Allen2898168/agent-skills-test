import test from "node:test";
import assert from "node:assert/strict";

import {
  isLotteryDraftCreateSuccessful,
  shouldSearchLotteryListAfterSubmit,
} from "../lib/lottery-draft-verification.mjs";

test("shouldSearchLotteryListAfterSubmit skips list ui search when redirected to login but auth header is already available", () => {
  assert.equal(shouldSearchLotteryListAfterSubmit({
    currentUrl: "https://stg-activity.weex.tech/login?redirect=%2Findex",
    authHeader: "Bearer test-token",
  }), false);
});

test("shouldSearchLotteryListAfterSubmit keeps list ui search when auth header is missing", () => {
  assert.equal(shouldSearchLotteryListAfterSubmit({
    currentUrl: "https://stg-activity.weex.tech/login?redirect=%2Findex",
    authHeader: "",
  }), true);
});

test("isLotteryDraftCreateSuccessful returns true when create response succeeds even without follow-up verify payload", () => {
  assert.equal(isLotteryDraftCreateSuccessful({
    createBody: { code: 200 },
    verify: null,
  }), true);
});

test("isLotteryDraftCreateSuccessful returns true when verify payload finds the created alias", () => {
  assert.equal(isLotteryDraftCreateSuccessful({
    createBody: null,
    verify: { total: 1 },
  }), true);
});

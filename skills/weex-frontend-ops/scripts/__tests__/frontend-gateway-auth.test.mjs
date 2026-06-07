import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFrontendGatewayHeaders,
  isFrontendGatewayUrl,
} from "../lib/frontend-gateway-auth.mjs";

test("isFrontendGatewayUrl matches stg gateway hosts only", () => {
  assert.equal(isFrontendGatewayUrl("https://stg-gateway.weex.tech/v1/user/overview/userinfo"), true);
  assert.equal(isFrontendGatewayUrl("https://stg-gateway2.weex.tech/v1/activity/general/raffle/frequency"), true);
  assert.equal(isFrontendGatewayUrl("https://stg-www.weex.tech/zh-CN/account"), false);
});

test("buildFrontendGatewayHeaders adds U-Token and frontend locale headers", () => {
  const headers = buildFrontendGatewayHeaders(
    { accept: "application/json", referer: "https://old.example/path" },
    "token-123",
    { referer: "https://stg-www.weex.tech/zh-CN/events/draw/demo" },
  );
  assert.deepEqual(headers, {
    accept: "application/json",
    referer: "https://stg-www.weex.tech/zh-CN/events/draw/demo",
    "U-Token": "token-123",
    language: "zh_CN",
    locale: "zh_CN",
    origin: "https://stg-www.weex.tech",
  });
});

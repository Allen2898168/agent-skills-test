import test from "node:test";
import assert from "node:assert/strict";

import { selectPlaceholder } from "../lib/element-ui-select.mjs";

test("selectPlaceholder waits for visible dropdown before selecting option", async () => {
  const calls = [];
  const page = {
    locator(selector) {
      calls.push({ type: "locator", selector });
      return {
        last() {
          return {
            async waitFor() {
              calls.push({ type: "waitFor", selector });
            },
            locator(innerSelector) {
              calls.push({ type: "dialog.locator", selector: innerSelector });
              return {
                first() {
                  return {
                    async scrollIntoViewIfNeeded() {
                      calls.push({ type: "scrollIntoViewIfNeeded", selector: innerSelector });
                    },
                    async click() {
                      calls.push({ type: "click", selector: innerSelector });
                    },
                  };
                },
              };
            },
          };
        },
        first() {
          return {
            async scrollIntoViewIfNeeded() {
              calls.push({ type: "scrollIntoViewIfNeeded", selector });
            },
            async click() {
              calls.push({ type: "click", selector });
            },
          };
        },
      };
    },
    async waitForFunction(fn, arg, options) {
      calls.push({ type: "waitForFunction", source: String(fn), arg, options });
      return true;
    },
    async evaluate(fn, arg) {
      calls.push({ type: "evaluate", source: String(fn), arg });
      return arg;
    },
  };

  await selectPlaceholder(page, "奖品分类", "币种");

  const waitIndex = calls.findIndex(item => item.type === "waitForFunction");
  const evaluateIndex = calls.findIndex(item => item.type === "evaluate");
  assert.ok(waitIndex >= 0, "selectPlaceholder should wait for dropdown visibility");
  assert.ok(evaluateIndex > waitIndex, "selection should happen after waiting for dropdown");
});

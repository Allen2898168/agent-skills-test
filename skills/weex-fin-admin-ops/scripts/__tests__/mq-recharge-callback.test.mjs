import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchAction } from "../cache/matcher.mjs";
import { commandFor } from "../cache/command.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("matcher routes explicit uid recharge request to mq callback action", () => {
  const manifest = {
    actions: [
      {
        id: "mq_recharge_callback_send",
        intentKeywords: ["充值", "mq", "MQ"],
        objectKeywords: ["uid"],
      },
      {
        id: "finance_airdrop_reward_grant",
        intentKeywords: ["发放"],
        objectKeywords: ["USDT"],
      },
    ],
  };
  const match = matchAction(manifest, {
    query: "帮我 uid 5139967417 充值1000",
    passthrough: {},
  });
  assert.equal(match.action.id, "mq_recharge_callback_send");
  assert.equal(match.inferred.uid, "5139967417");
  assert.equal(match.inferred.amount, "1000");
  assert.equal(match.inferred.confirmSend, true);
});

test("command builder includes uid amount and confirm-send for mq callback action", () => {
  const match = {
    action: {
      id: "mq_recharge_callback_send",
      script: "scripts/mq-recharge-callback-send.mjs",
    },
    inferred: {
      uid: "5139967417",
      amount: "1000",
      confirmSend: true,
    },
  };
  const args = {
    dryRun: false,
    passthrough: {},
  };
  const { commandArgs } = commandFor(match, args, skillRoot);
  assert.deepEqual(commandArgs, [
    path.join(skillRoot, "scripts/mq-recharge-callback-send.mjs"),
    "--uid",
    "5139967417",
    "--amount",
    "1000",
    "--confirm-send",
  ]);
});

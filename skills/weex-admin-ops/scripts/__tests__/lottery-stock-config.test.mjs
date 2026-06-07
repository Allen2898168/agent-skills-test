import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDeterministicCumulativePrizeWeight,
  applySinglePrizeStockWeights,
} from "../lib/lottery-stock-config.mjs";

test("applySinglePrizeStockWeights makes one low-stock prize deterministic", () => {
  const payload = {
    prize: Array.from({ length: 8 }, (_, index) => ({
      prizeId: index + 1,
      weight: 12.5,
      inventoryQuantity: 1,
      remainingQuantity: 1,
    })),
    prizeColorTagWeightConfig: [
      {
        type: 1,
        prizeWeightList: Array.from({ length: 8 }, (_, index) => ({
          awardPrizeId: index + 1,
          weight: 12.5,
        })),
      },
      {
        type: 2,
        prizeWeightList: Array.from({ length: 8 }, (_, index) => ({
          awardPrizeId: index + 1,
          weight: 12.5,
        })),
      },
    ],
  };

  applySinglePrizeStockWeights(payload, { prizeId: 1 });

  assert.deepEqual(payload.prize.map(item => item.weight), [100, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(payload.prizeColorTagWeightConfig[0].prizeWeightList.map(item => item.weight), [100, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(payload.prizeColorTagWeightConfig[1].prizeWeightList.map(item => item.weight), [100, 0, 0, 0, 0, 0, 0, 0]);
});

test("applyDeterministicCumulativePrizeWeight makes prize 5 deterministic after cumulative threshold", () => {
  const payload = {
    prize: Array.from({ length: 8 }, (_, index) => ({
      prizeId: index + 1,
    })),
    prizeWeight: Array.from({ length: 8 }, (_, index) => ({
      prizeId: index + 1,
      weight: 12.5,
      cumulativeCount: 5,
      type: 1,
    })),
  };

  applyDeterministicCumulativePrizeWeight(payload, { prizeId: 5, cumulativeCount: 5, type: 1 });

  assert.deepEqual(payload.prizeWeight.map(item => item.weight), [0, 0, 0, 0, 100, 0, 0, 0]);
  assert.deepEqual(new Set(payload.prizeWeight.map(item => item.cumulativeCount)), new Set([5]));
  assert.deepEqual(new Set(payload.prizeWeight.map(item => item.type)), new Set([1]));
});

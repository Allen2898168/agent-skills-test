export function applySinglePrizeStockWeights(payload, { prizeId = 1 } = {}) {
  const targetPrizeId = Number(prizeId || 1);
  if (!payload || typeof payload !== "object") return payload;

  if (Array.isArray(payload.prize)) {
    for (const prize of payload.prize) {
      if (!prize || typeof prize !== "object") continue;
      prize.weight = Number(prize.prizeId) === targetPrizeId ? 100 : 0;
    }
  }

  if (Array.isArray(payload.prizeColorTagWeightConfig)) {
    for (const group of payload.prizeColorTagWeightConfig) {
      const rows = Array.isArray(group?.prizeWeightList) ? group.prizeWeightList : [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        row.weight = Number(row.awardPrizeId) === targetPrizeId ? 100 : 0;
      }
    }
  }

  return payload;
}

export function applyDeterministicCumulativePrizeWeight(payload, { prizeId = 5, cumulativeCount = 5, type = 1 } = {}) {
  const targetPrizeId = Number(prizeId || 5);
  const targetCount = Number(cumulativeCount || 5);
  const targetType = Number(type || 1);
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.prize)) return payload;

  payload.prizeWeight = payload.prize
    .map(prize => Number(prize?.prizeId))
    .filter(Number.isFinite)
    .map(currentPrizeId => ({
      prizeId: currentPrizeId,
      weight: currentPrizeId === targetPrizeId ? 100 : 0,
      cumulativeCount: targetCount,
      type: targetType,
    }));

  return payload;
}

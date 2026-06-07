const FRONTEND_AUTO_HANDLED_KEYS = new Set([
  "FRONTEND_SESSION",
  "NORMAL_ACTIVITY_ONLINE",
  "NORMAL_ACTIVITY_SIGNED_UP",
  "NORMAL_ACTIVITY_DRAW_GE1",
  "NORMAL_ACTIVITY_DRAW_GT5",
  "LOW_STOCK_ACTIVITY_ONLINE",
  "LOW_STOCK_ACTIVITY_DRAW_GT5",
  "REWARD_RECORD_DELAY_READY",
]);

export function isFrontendAutoHandledPrecondition(key, scenarios) {
  if (!FRONTEND_AUTO_HANDLED_KEYS.has(key)) return false;
  return (scenarios || []).some(item => item.entrypoint === "lottery_frontend_main_regression");
}

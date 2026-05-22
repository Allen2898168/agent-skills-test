const FRONTEND_AUTO_HANDLED_KEYS = new Set([
  "NORMAL_ACTIVITY_ONLINE",
]);

export function isFrontendAutoHandledPrecondition(key, scenarios) {
  if (!FRONTEND_AUTO_HANDLED_KEYS.has(key)) return false;
  return (scenarios || []).some(item => item.entrypoint === "lottery_frontend_main_regression");
}

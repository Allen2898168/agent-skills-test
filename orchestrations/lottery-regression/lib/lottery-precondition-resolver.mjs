import { isFrontendAutoHandledPrecondition } from "./lottery-frontend-preconditions.mjs";

export function resolvePreconditions(selectedScenarios, manifest) {
  const descriptions = manifest?.scenarios || {};
  const requiredKeys = Array.from(new Set((selectedScenarios || []).flatMap(item => item.preconditions || [])));
  return requiredKeys.map(key => ({
    key,
    description: descriptions[key]?.description || "",
    autoHandled: isAutoHandledPrecondition(key, selectedScenarios),
  }));
}

function isAutoHandledPrecondition(key, scenarios) {
  if (key === "ADMIN_SESSION") return true;
  if (["REGISTER_TEMPLATE_READY", "ROULETTE_TASK_READY", "PRIZE_SET_READY", "NORMAL_ACTIVITY_DRAFT"].includes(key)) {
    return (scenarios || []).some(item => item.entrypoint === "lottery_admin_main_regression");
  }
  if (isFrontendAutoHandledPrecondition(key, scenarios)) return true;
  return false;
}

import path from "node:path";

export function commandFor(match, args, skillRoot) {
  if (match.action.id === "copy_prize_by_id") return copyPrizeCommand(match, args, skillRoot);
  if (match.action.id === "create_roulette_participant_scope_tasks") return rouletteParticipantScopeCommand(match, args, skillRoot);
  if (match.action.id === "create_register_templates") return registerTemplateCommand(match, args, skillRoot);
  if (match.action.id !== "create_prizes") throw new Error(`No runner implemented for action: ${match.action.id}`);
  const params = { ...match.inferred, ...args.passthrough };
  if (!params.category || !params.subtype) {
    throw new Error("Cached create_prizes action requires category and subtype. Fallback to normal workflow or pass --category/--subtype.");
  }
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script, "--category", params.category, "--subtype", params.subtype, "--count", String(params.count || 1)];
  if (params.namePrefix) commandArgs.push("--name-prefix", params.namePrefix);
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", params.aliasPrefix);
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function registerTemplateCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.signupModes) commandArgs.push("--signup-modes", String(params.signupModes));
  if (params.namePrefix) commandArgs.push("--name-prefix", String(params.namePrefix));
  if (params.minTeam) commandArgs.push("--min-team", String(params.minTeam));
  if (params.permissions) commandArgs.push("--permissions", String(params.permissions));
  if (params.peopleLimit) commandArgs.push("--people-limit", String(params.peopleLimit));
  if (params.platformScopes) commandArgs.push("--platform-scopes", String(params.platformScopes));
  if (params.platformScope) commandArgs.push("--platform-scope", String(params.platformScope));
  if (params.restrictScopes) commandArgs.push("--restrict-scopes", String(params.restrictScopes));
  if (params.uid) commandArgs.push("--uid", String(params.uid));
  if (params.registerStart) commandArgs.push("--register-start", String(params.registerStart));
  if (params.registerEnd) commandArgs.push("--register-end", String(params.registerEnd));
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function rouletteParticipantScopeCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.scopes) commandArgs.push("--scopes", String(params.scopes));
  if (params.uid) commandArgs.push("--uid", String(params.uid));
  if (params.country) commandArgs.push("--country", String(params.country));
  if (params.countryFirst) commandArgs.push("--country-first");
  if (params.vipWhitelist) commandArgs.push("--vip-whitelist", String(params.vipWhitelist));
  if (params.namePrefix) commandArgs.push("--name-prefix", String(params.namePrefix));
  if (params.rewardMin) commandArgs.push("--reward-min", String(params.rewardMin));
  if (params.rewardMax) commandArgs.push("--reward-max", String(params.rewardMax));
  if (params.dailyLimit) commandArgs.push("--daily-limit", String(params.dailyLimit));
  if (params.totalLimit) commandArgs.push("--total-limit", String(params.totalLimit));
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function copyPrizeCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  if (!params.prizeId) throw new Error("Cached copy_prize_by_id action requires --prize-id or a query containing 奖品ID.");
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script, "--prize-id", String(params.prizeId)];
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

import path from "node:path";

export function commandFor(match, args, skillRoot) {
  if (match.action.id === "lottery_admin_main_regression") return lotteryAdminMainRegressionCommand(match, args, skillRoot);
  if (match.action.id === "configure_lottery_activity") return configureLotteryActivityCommand(match, args, skillRoot);
  if (match.action.id === "copy_prize_by_id") return copyPrizeCommand(match, args, skillRoot);
  if (match.action.id === "create_roulette_participant_scope_tasks") return rouletteParticipantScopeCommand(match, args, skillRoot);
  if (match.action.id === "create_register_templates") return registerTemplateCommand(match, args, skillRoot);
  if (match.action.id === "verify_register_template_row_actions") return registerTemplateRowActionsCommand(match, args, skillRoot);
  if (match.action.id === "delete_register_templates_by_operator") return deleteRegisterTemplatesByOperatorCommand(match, args, skillRoot);
  if (match.action.id === "verify_activity_tasks_all_types") return verifyActivityTasksAllTypesCommand(match, args, skillRoot);
  if (match.action.id === "verify_activity_tasks_complex_all_types") return verifyActivityTasksComplexAllTypesCommand(match, args, skillRoot);
  if (match.action.id === "create_guide_templates") return createGuideTemplatesCommand(match, args, skillRoot);
  if (match.action.id === "verify_guide_template_row_actions") return guideTemplateRowActionsCommand(match, args, skillRoot);
  if (match.action.id === "create_lottery_activity_draft") return createLotteryActivityDraftCommand(match, args, skillRoot);
  if (match.action.id === "online_lottery_activity") return onlineLotteryActivityCommand(match, args, skillRoot);
  if (match.action.id !== "create_prizes") throw new Error(`No runner implemented for action: ${match.action.id}`);
  const params = { ...match.inferred, ...args.passthrough };
  if (!params.category || !params.subtype) {
    throw new Error("Cached create_prizes action requires category and subtype. Fallback to normal workflow or pass --category/--subtype.");
  }
  const script = args.visible || params.visible
    ? path.join(skillRoot, "scripts/create-prizes.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script, "--category", params.category, "--subtype", params.subtype, "--count", String(params.count || 1)];
  if (params.namePrefix) commandArgs.push("--name-prefix", params.namePrefix);
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", params.aliasPrefix);
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function verifyActivityTasksAllTypesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  if (params.types) commandArgs.push("--types", String(params.types));
  if (params.pageSize) commandArgs.push("--page-size", String(params.pageSize));
  if (params.confirm || args.confirm) commandArgs.push("--confirm");
  return { script, commandArgs };
}

function verifyActivityTasksComplexAllTypesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  if (params.types) commandArgs.push("--types", String(params.types));
  if (params.pageSize) commandArgs.push("--page-size", String(params.pageSize));
  if (params.candidates) commandArgs.push("--candidates", String(params.candidates));
  if (params.maxAttempts) commandArgs.push("--max-attempts", String(params.maxAttempts));
  if (params.confirm || args.confirm) commandArgs.push("--confirm");
  return { script, commandArgs };
}

function configureLotteryActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard"); // always no writes on first pass
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.raffleStyle) commandArgs.push("--raffle-style", String(params.raffleStyle));
  if (params.uid) commandArgs.push("--uid", String(params.uid));
  if (params.country) commandArgs.push("--country", String(params.country));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function lotteryAdminMainRegressionCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.uid) commandArgs.push("--uid", String(params.uid));
  if (params.country) commandArgs.push("--country", String(params.country));
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function createLotteryActivityDraftCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const visible = Boolean(args.visible || params.visible);
  const script = visible
    ? path.join(skillRoot, "scripts/create-lottery-activity-draft.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (!visible) commandArgs.push("--action", "create-draft");
  if (params.titleExact) commandArgs.push("--title-exact", String(params.titleExact));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.subtitle) commandArgs.push("--subtitle", String(params.subtitle));
  if (params.aliasExact) commandArgs.push("--alias-exact", String(params.aliasExact));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.start) commandArgs.push("--start", String(params.start));
  if (params.end) commandArgs.push("--end", String(params.end));
  if (params.preapplyStart) commandArgs.push("--preapply-start", String(params.preapplyStart));
  if (params.preapplyEnd) commandArgs.push("--preapply-end", String(params.preapplyEnd));
  if (params.style) commandArgs.push("--style", String(params.style));
  if (params.activityTaskLabels) commandArgs.push("--activity-task-labels", String(params.activityTaskLabels));
  if (params.noPreapply) commandArgs.push("--no-preapply");
  if (visible) commandArgs.push("--visible");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function onlineLotteryActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  if (!params.activityAlias && !params.activityId) {
    throw new Error("Cached online_lottery_activity action requires --activity-alias/--activity-id or a query containing 活动别名/活动ID.");
  }
  const visible = Boolean(args.visible || params.visible);
  const script = visible
    ? path.join(skillRoot, "scripts/online-lottery-activity.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (!visible) commandArgs.push("--action", "online");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (visible) commandArgs.push("--visible");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function guideTemplateRowActionsCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const visible = Boolean(args.visible || params.visible);
  const script = visible
    ? path.join(skillRoot, "scripts/guide-template-row-actions.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function createGuideTemplatesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const visible = Boolean(args.visible || params.visible);
  const script = visible
    ? path.join(skillRoot, "scripts/create-guide-templates.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.modeLabel) commandArgs.push("--mode-label", String(params.modeLabel));
  if (params.activityTypes) commandArgs.push("--activity-types", String(params.activityTypes));
  if (params.frequencies) commandArgs.push("--frequencies", String(params.frequencies));
  if (params.steps) commandArgs.push("--steps", String(params.steps));
  if (params.includeNone) commandArgs.push("--include-none");
  if (visible) commandArgs.push("--visible");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function deleteRegisterTemplatesByOperatorCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const visible = Boolean(args.visible || params.visible);
  const script = visible
    ? path.join(skillRoot, "scripts/delete-register-templates-by-operator.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script, "--operator", String(params.operator || "auto")];
  if (params.pageSize) commandArgs.push("--page-size", String(params.pageSize));
  if (visible) commandArgs.push("--visible");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  if (args.confirmDelete || params.confirmDelete) commandArgs.push("--confirm-delete");
  return { script, commandArgs };
}

function registerTemplateRowActionsCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.namePrefix) commandArgs.push("--name-prefix", String(params.namePrefix));
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
  const visible = Boolean(args.visible || params.visible);
  const script = visible
    ? path.join(skillRoot, "scripts/copy-prize.mjs")
    : path.join(skillRoot, match.action.script);
  const commandArgs = [script, "--prize-id", String(params.prizeId)];
  if (visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

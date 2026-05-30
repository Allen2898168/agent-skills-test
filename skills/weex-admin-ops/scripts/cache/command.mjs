import path from "node:path";

export function commandFor(match, args, skillRoot) {
  if (match.action.id === "lottery_admin_main_regression") return lotteryAdminMainRegressionCommand(match, args, skillRoot);
  if (match.action.id === "configure_lottery_activity") return configureLotteryActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_lottery_activity_modules") return configureLotteryModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_race_activity") return configureRaceActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_race_activity_modules") return configureRaceModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_newbie_activity") return configureNewbieActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_trading_competition_activity") return configureTradingCompetitionActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_trading_competition_activity_modules") return configureTradingCompetitionModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_race_competition_activity") return configureRaceCompetitionActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_race_competition_activity_modules") return configureRaceCompetitionModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_trace_pro_activity") return configureTraceProActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_agent_trace_pro_activity") return configureAgentTraceProActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_trace_pro_activity_modules") return configureTraceProModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_agent_trace_pro_activity_modules") return configureAgentTraceProModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_customized_activity") return configureCustomizedActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_customized_activity_modules") return configureCustomizedModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_recharge_trans_task_activity") return configureRechargeTransTaskActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_recharge_trans_task_activity_modules") return configureRechargeTransTaskModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_agent_activity") return configureAgentActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_agent_activity_modules") return configureAgentModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_contract_mining_activity") return configureContractMiningActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_contract_mining_activity_modules") return configureContractMiningModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_flip_activity") return configureFlipActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_flip_activity_modules") return configureFlipModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_guess_activity") return configureGuessActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_guess_activity_modules") return configureGuessModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_monopoly_world_cup_activity") return configureMonopolyWorldCupActivityCommand(match, args, skillRoot);
  if (match.action.id === "configure_monopoly_world_cup_activity_modules") return configureMonopolyWorldCupModulesCommand(match, args, skillRoot);
  if (match.action.id === "configure_newbie_activity_modules") return configureNewbieModulesCommand(match, args, skillRoot);
  if (match.action.id === "create_task_packages") return taskPackageCommand(match, args, skillRoot);
  if (match.action.id === "create_resource_cards") return resourceCardCommand(match, args, skillRoot);
  if (match.action.id === "create_multilanguage_templates") return multilanguageTemplateCommand(match, args, skillRoot);
  if (match.action.id === "manage_multilanguage_template_items") return multilanguageTemplateItemCommand(match, args, skillRoot);
  if (match.action.id === "batch_bind_i18n_templates") return batchBindI18nTemplateCommand(match, args, skillRoot);
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

function configureLotteryModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureTradingCompetitionModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureRaceCompetitionModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureRaceModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureNewbieModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureTraceProModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureAgentTraceProModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureCustomizedModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureRechargeTransTaskModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureAgentModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureContractMiningModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureFlipModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureGuessModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureMonopolyWorldCupModulesCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec) commandArgs.push("--action", "update");
  if (!hasSpec) commandArgs.push("--action", "snapshot");
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function taskPackageCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.action) commandArgs.push("--action", String(params.action));
  else commandArgs.push("--action", "list");
  if (params.id) commandArgs.push("--id", String(params.id));
  if (params.taskIds) commandArgs.push("--task-ids", String(params.taskIds));
  if (params.name) commandArgs.push("--name", String(params.name));
  if (params.remark) commandArgs.push("--remark", String(params.remark));
  if (params.confirmCreate || args.confirm) commandArgs.push("--confirm-create");
  if (params.confirmCleanup || args.confirmCleanup) commandArgs.push("--confirm-cleanup");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function resourceCardCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (params.wizard) {
    commandArgs.push("--wizard");
  } else if (hasSpec) {
    commandArgs.push("--action", String(params.resourceAction || "create"));
    if (params.id) commandArgs.push("--id", String(params.id));
    if (params.confirm || args.confirm) commandArgs.push("--confirm");
    if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
    if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  } else {
    if (params.action) commandArgs.push("--action", String(params.action));
    else commandArgs.push("--action", "list-newbie");
    if (params.id) commandArgs.push("--id", String(params.id));
    if (params.count) commandArgs.push("--count", String(params.count));
    if (params.namePrefix) commandArgs.push("--name-prefix", String(params.namePrefix));
    if (params.confirmCreate || args.confirm) commandArgs.push("--confirm-create");
    if (params.confirmCleanup || args.confirmCleanup) commandArgs.push("--confirm-cleanup");
    if (params.cleanup || args.cleanup) commandArgs.push("--cleanup");
  }
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function multilanguageTemplateCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (params.action) commandArgs.push("--action", String(params.action));
  else commandArgs.push("--action", "list");
  if (params.id) commandArgs.push("--id", String(params.id));
  if (params.namePrefix) commandArgs.push("--name-prefix", String(params.namePrefix));
  if (params.confirmCreate || args.confirm) commandArgs.push("--confirm-create");
  if (params.confirmCleanup || args.confirmCleanup) commandArgs.push("--confirm-cleanup");
  if (params.cleanup || args.cleanup) commandArgs.push("--cleanup");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function multilanguageTemplateItemCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) {
    if (params.templateId) {
      commandArgs.push("--action", "list", "--template-id", String(params.templateId));
      if (params.key) commandArgs.push("--key", String(params.key));
    } else {
      commandArgs.push("--wizard");
    }
  } else {
    commandArgs.push("--action", String(params.itemAction || "upsert"));
    if (params.confirm || args.confirm) commandArgs.push("--confirm");
    if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
    if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  }
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function batchBindI18nTemplateCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) {
    if (params.snapshot) commandArgs.push("--action", "snapshot");
    else commandArgs.push("--wizard");
  } else {
    commandArgs.push("--action", "bind");
    if (params.confirm || args.confirm) commandArgs.push("--confirm");
    if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
    if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  }
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
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

function configureRaceActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureNewbieActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureTradingCompetitionActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureRaceCompetitionActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureTraceProActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.requiredVolume) commandArgs.push("--required-volume", String(params.requiredVolume));
  if (params.resourceCards) commandArgs.push("--resource-cards", String(params.resourceCards));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureAgentTraceProActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.requiredVolume) commandArgs.push("--required-volume", String(params.requiredVolume));
  if (params.resourceCards) commandArgs.push("--resource-cards", String(params.resourceCards));
  if (params.startOffsetSeconds) commandArgs.push("--start-offset-seconds", String(params.startOffsetSeconds));
  if (params.endDays) commandArgs.push("--end-days", String(params.endDays));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (params.cleanup) commandArgs.push("--cleanup");
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureCustomizedActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.requiredVolume) commandArgs.push("--required-volume", String(params.requiredVolume));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureRechargeTransTaskActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.requiredVolume) commandArgs.push("--required-volume", String(params.requiredVolume));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureAgentActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureContractMiningActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureFlipActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureGuessActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.activityAlias) commandArgs.push("--activity-alias", String(params.activityAlias));
  if (params.activityId) commandArgs.push("--activity-id", String(params.activityId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

function configureMonopolyWorldCupActivityCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  const hasSpec = Boolean(params.specFile || params.specJson);
  if (!hasSpec) commandArgs.push("--wizard");
  if (hasSpec && (params.confirm || args.confirm)) commandArgs.push("--confirm");
  if (params.specFile) commandArgs.push("--spec-file", String(params.specFile));
  if (params.specJson) commandArgs.push("--spec-json", String(params.specJson));
  if (params.preset) commandArgs.push("--preset", String(params.preset));
  if (params.templateAlias) commandArgs.push("--template-alias", String(params.templateAlias));
  if (params.templateId) commandArgs.push("--template-id", String(params.templateId));
  if (params.titlePrefix) commandArgs.push("--title-prefix", String(params.titlePrefix));
  if (params.aliasPrefix) commandArgs.push("--alias-prefix", String(params.aliasPrefix));
  if (params.requiredVolume) commandArgs.push("--required-volume", String(params.requiredVolume));
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

import path from "node:path";

export function commandFor(match, args, skillRoot) {
  if (match.action.id === "copy_prize_by_id") return copyPrizeCommand(match, args, skillRoot);
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

function copyPrizeCommand(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  if (!params.prizeId) throw new Error("Cached copy_prize_by_id action requires --prize-id or a query containing 奖品ID.");
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script, "--prize-id", String(params.prizeId)];
  if (args.visible || params.visible) commandArgs.push("--visible");
  if (args.dryRun) commandArgs.push("--dry-run");
  return { script, commandArgs };
}

import path from "node:path";

export function commandFor(match, args, skillRoot) {
  const params = { ...match.inferred, ...args.passthrough };
  const script = path.join(skillRoot, match.action.script);
  const commandArgs = [script];
  if (match.action.id === "create_api_account_fund_contract_order") {
    if (params.userType) commandArgs.push("--user-type", String(params.userType));
    if (params.remark) commandArgs.push("--remark", String(params.remark));
    if (params.fundAmount) commandArgs.push("--fund-amount", String(params.fundAmount));
    if (params.orderNotional) commandArgs.push("--order-notional", String(params.orderNotional));
    if (params.symbol) commandArgs.push("--symbol", String(params.symbol));
    if (params.side) commandArgs.push("--side", String(params.side));
    if (params.positionSide) commandArgs.push("--position-side", String(params.positionSide));
    if (params.quantity) commandArgs.push("--quantity", String(params.quantity));
    if (params.outputDir) commandArgs.push("--output-dir", String(params.outputDir));
    if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
    if (args.confirmCreateAccount || params.confirmCreateAccount) commandArgs.push("--confirm-create-account");
    if (args.confirmRecharge || params.confirmRecharge) commandArgs.push("--confirm-recharge");
    if (args.confirmTransfer || params.confirmTransfer) commandArgs.push("--confirm-transfer");
    if (args.confirmOrder || params.confirmOrder) commandArgs.push("--confirm-order");
    return { script, commandArgs };
  }
  if (match.action.id === "fin_system_account_create") {
    if (params.count) commandArgs.push("--count", String(params.count));
    if (params.userType) commandArgs.push("--user-type", String(params.userType));
    if (params.remark) commandArgs.push("--remark", String(params.remark));
    if (params.tagId) commandArgs.push("--tag-id", String(params.tagId));
    if (params.site) commandArgs.push("--site", String(params.site));
    if (params.authorities) commandArgs.push("--authorities", String(params.authorities));
    if (params.outputDir) commandArgs.push("--output-dir", String(params.outputDir));
    if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
    if (args.confirmCreate || params.confirmCreate) commandArgs.push("--confirm-create");
    if (args.saveSecrets || params.saveSecrets) commandArgs.push("--save-secrets");
    return { script, commandArgs };
  }
  if (match.action.id === "batch_register_recharge" || match.action.id === "register_recharge_transfer_contract") {
    if (params.count) commandArgs.push("--count", String(params.count));
    if (params.amount) commandArgs.push("--amount", String(params.amount));
    if (params.currency) commandArgs.push("--currency", String(params.currency));
    if (params.emailPrefix) commandArgs.push("--email-prefix", String(params.emailPrefix));
    if (params.fromAccountType) commandArgs.push("--from-account-type", String(params.fromAccountType));
    if (params.toAccountType) commandArgs.push("--to-account-type", String(params.toAccountType));
    if (params.transferCoinId) commandArgs.push("--transfer-coin-id", String(params.transferCoinId));
    if (params.concurrency) commandArgs.push("--concurrency", String(params.concurrency));
    if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
    if (args.confirmRegister || params.confirmRegister) commandArgs.push("--confirm-register");
    if (args.confirmRecharge || params.confirmRecharge) commandArgs.push("--confirm-recharge");
    if (args.confirmTransfer || params.confirmTransfer) commandArgs.push("--confirm-transfer");
    if (args.skipGrantDryRun || params.skipGrantDryRun) commandArgs.push("--skip-grant-dry-run");
    if (args.allowUnverifiedTransferChain || params.allowUnverifiedTransferChain) commandArgs.push("--allow-unverified-transfer-chain");
    return { script, commandArgs };
  }
  if (match.action.id !== "finance_airdrop_reward_grant") {
    throw new Error(`No runner implemented for action: ${match.action.id}`);
  }
  if (params.uid) commandArgs.push("--uid", String(params.uid));
  if (params.amount) commandArgs.push("--amount", String(params.amount));
  if (params.currency) commandArgs.push("--currency", String(params.currency));
  if (params.subBizType) commandArgs.push("--sub-biz-type", String(params.subBizType));
  if (params.remark1) commandArgs.push("--remark1", String(params.remark1));
  if (params.auditType) commandArgs.push("--audit-type", String(params.auditType));
  if (params.auditRemark) commandArgs.push("--audit-remark", String(params.auditRemark));
  if (params.approveOnlyOrderId) commandArgs.push("--approve-only-order-id", String(params.approveOnlyOrderId));
  if (args.dryRun || params.dryRun) commandArgs.push("--dry-run");
  if (args.confirmCreate || params.confirmCreate) commandArgs.push("--confirm-create");
  if (args.confirmApprove || params.confirmApprove) commandArgs.push("--confirm-approve");
  return { script, commandArgs };
}

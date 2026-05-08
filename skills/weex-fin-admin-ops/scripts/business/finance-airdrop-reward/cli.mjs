import {
  DEFAULT_CURRENCY,
  DEFAULT_SUB_BIZ_TYPE,
  assertPositiveNumber,
  assertUid,
  defaultCdpUrl,
} from "./api.mjs";

export function parseGrantArgs(argv, env) {
  const args = {
    cdpUrl: defaultCdpUrl(env),
    uid: "",
    amount: "",
    currency: DEFAULT_CURRENCY,
    subBizType: DEFAULT_SUB_BIZ_TYPE,
    remark1: "",
    auditType: "",
    auditRemark: "",
    confirmCreate: false,
    confirmApprove: false,
    dryRun: false,
    approveOnlyOrderId: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--cdp-url") args.cdpUrl = argv[++index] || "";
    else if (value === "--uid") args.uid = argv[++index] || "";
    else if (value === "--amount") args.amount = argv[++index] || "";
    else if (value === "--currency") args.currency = argv[++index] || "";
    else if (value === "--sub-biz-type") args.subBizType = argv[++index] || "";
    else if (value === "--remark1") args.remark1 = argv[++index] || "";
    else if (value === "--audit-type") args.auditType = argv[++index] || "";
    else if (value === "--audit-remark") args.auditRemark = argv[++index] || "";
    else if (value === "--approve-only-order-id") args.approveOnlyOrderId = argv[++index] || "";
    else if (value === "--confirm-create") args.confirmCreate = true;
    else if (value === "--confirm-approve") args.confirmApprove = true;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--help" || value === "-h") args.help = true;
  }
  return args;
}

export function grantHelp() {
  return `Usage:
  node scripts/finance-airdrop-reward-grant.mjs --dry-run --uid <uid> --amount <amount>
  node scripts/finance-airdrop-reward-grant.mjs --uid <uid> --amount <amount> --confirm-create
  node scripts/finance-airdrop-reward-grant.mjs --uid <uid> --amount <amount> --confirm-create --confirm-approve

Creates and optionally approves a FIN Admin airdrop reward product grant through the current CDP Chrome login state.
Secrets are read from skills/weex-fin-admin-ops/.env.local or same-skill WEEX_FIN_* runtime environment variables only and are never printed.`;
}

export function validateGrantArgs(args, env) {
  const missing = [];
  if (!args.uid && !args.approveOnlyOrderId) missing.push("--uid");
  if (!args.amount && !args.approveOnlyOrderId) missing.push("--amount");
  if (args.confirmApprove && !env.WEEX_FIN_GOOGLE_CODE) {
    missing.push("WEEX_FIN_GOOGLE_CODE");
  }
  if (missing.length) {
    console.log(JSON.stringify({ ok: false, dryRun: args.dryRun, missing }, null, 2));
    process.exit(args.dryRun ? 0 : 2);
  }
  if (args.uid) assertUid(args.uid);
  if (args.amount) assertPositiveNumber(args.amount, "amount");
}

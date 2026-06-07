export function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmCreateAccount: false,
    confirmRecharge: false,
    confirmTransfer: false,
    confirmOrder: false,
    userType: "codex_api_order",
    remark: "codex_api_order",
    fundAmount: "20",
    orderNotional: "10",
    symbol: "ETHUSDT",
    side: "BUY",
    positionSide: "LONG",
    orderType: "MARKET",
    quantity: "",
    quantityDecimals: 4,
    outputDir: "generated/fin-system-accounts",
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--confirm-create-account") args.confirmCreateAccount = true;
    else if (value === "--confirm-recharge") args.confirmRecharge = true;
    else if (value === "--confirm-transfer") args.confirmTransfer = true;
    else if (value === "--confirm-order") args.confirmOrder = true;
    else if (value === "--user-type") args.userType = argv[++index] || "";
    else if (value === "--remark") args.remark = argv[++index] || "";
    else if (value === "--fund-amount") args.fundAmount = argv[++index] || "";
    else if (value === "--order-notional") args.orderNotional = argv[++index] || "";
    else if (value === "--symbol") args.symbol = argv[++index] || "";
    else if (value === "--side") args.side = argv[++index] || "";
    else if (value === "--position-side") args.positionSide = argv[++index] || "";
    else if (value === "--type") args.orderType = argv[++index] || "";
    else if (value === "--quantity") args.quantity = argv[++index] || "";
    else if (value === "--quantity-decimals") args.quantityDecimals = Number(argv[++index]);
    else if (value === "--output-dir") args.outputDir = argv[++index] || "";
    else throw new Error(`Unknown option: ${value}`);
  }
  return args;
}

export function help() {
  return `Usage:
  node skills/weex-fin-admin-ops/scripts/create-api-account-fund-contract-order.mjs --dry-run
  node skills/weex-fin-admin-ops/scripts/create-api-account-fund-contract-order.mjs --confirm-create-account --confirm-recharge --confirm-transfer --confirm-order

Creates one FIN system/API account, funds contract balance, then places a contract Open API order.

Options:
  --user-type <text>       FIN system account user type. Default codex_api_order.
  --remark <text>          FIN system account remark. Default codex_api_order.
  --fund-amount <n>        USDT to grant and transfer to contract. Default 20.
  --order-notional <n>     Approximate USDT order notional when --quantity is omitted. Default 10.
  --symbol <symbol>        Contract symbol. Default ETHUSDT.
  --side <BUY|SELL>        Order side. Default BUY.
  --position-side <LONG|SHORT>  Position side. Default LONG.
  --quantity <n>           Explicit contract quantity. If omitted, calculated from ticker.
  --quantity-decimals <n>  Decimal places for calculated quantity. Default 4.
  --confirm-create-account Required for FIN system/API account creation.
  --confirm-recharge       Required for FIN recharge approval.
  --confirm-transfer       Required for frontend spot-to-contract transfer.
  --confirm-order          Required for contract order placement.`;
}

function assertPositiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be a positive number`);
}

export function validateArgs(args) {
  const missing = [];
  if (!args.userType) missing.push("--user-type");
  if (!args.remark) missing.push("--remark");
  if (!/^[A-Z0-9_-]{5,30}$/i.test(args.symbol)) missing.push("--symbol");
  if (!["BUY", "SELL"].includes(args.side.toUpperCase())) missing.push("--side BUY|SELL");
  if (!["LONG", "SHORT"].includes(args.positionSide.toUpperCase())) missing.push("--position-side LONG|SHORT");
  if (!["MARKET"].includes(args.orderType.toUpperCase())) missing.push("--type MARKET");
  if (!Number.isInteger(args.quantityDecimals) || args.quantityDecimals < 0 || args.quantityDecimals > 8) missing.push("--quantity-decimals 0-8");
  if (missing.length) throw new Error(`Missing or invalid options: ${missing.join(", ")}`);
  assertPositiveNumber(args.fundAmount, "--fund-amount");
  if (args.quantity) assertPositiveNumber(args.quantity, "--quantity");
  else assertPositiveNumber(args.orderNotional, "--order-notional");
}

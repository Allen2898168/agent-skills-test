export const DEFAULT_KAFKA_UI_URL = "http://10.5.53.28:8080/ui/clusters/new-stg-kafka/all-topics/flink.exchange.spot_capital_order_info/messages?keySerde=String&valueSerde=String&limit=100";

export function parseMqRechargeArgs(argv, env = process.env) {
  const args = {
    kafkaUrl: env.WEEX_FIN_MQ_RECHARGE_URL || DEFAULT_KAFKA_UI_URL,
    uid: "",
    amount: "",
    messageId: "",
    coinId: "2",
    bizType: "1",
    bizSubType: "1",
    status: "9",
    timeoutMs: "45000",
    dryRun: false,
    confirmSend: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--kafka-url") args.kafkaUrl = argv[++index] || "";
    else if (value === "--uid") args.uid = argv[++index] || "";
    else if (value === "--amount") args.amount = argv[++index] || "";
    else if (value === "--message-id") args.messageId = argv[++index] || "";
    else if (value === "--coin-id") args.coinId = argv[++index] || "";
    else if (value === "--biz-type") args.bizType = argv[++index] || "";
    else if (value === "--biz-sub-type") args.bizSubType = argv[++index] || "";
    else if (value === "--status") args.status = argv[++index] || "";
    else if (value === "--timeout-ms") args.timeoutMs = argv[++index] || "";
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--confirm-send") args.confirmSend = true;
    else if (value === "--help" || value === "-h") args.help = true;
  }
  return args;
}

export function mqRechargeHelp() {
  return `Usage:
  node scripts/mq-recharge-callback-send.mjs --dry-run --uid <uid> --amount <amount>
  node scripts/mq-recharge-callback-send.mjs --uid <uid> --amount <amount> --confirm-send

Sends one recharge MQ callback message through the Kafka UI page for topic flink.exchange.spot_capital_order_info.
By default the script uses the verified staging Kafka UI URL and generates a unique message id automatically.`;
}

export function validateMqRechargeArgs(args) {
  const missing = [];
  if (!/^\d+$/.test(String(args.uid || "").trim())) missing.push("--uid");
  if (!/^\d+(?:\.\d+)?$/.test(String(args.amount || "").trim())) missing.push("--amount");
  if (!/^\d+$/.test(String(args.coinId || "").trim())) missing.push("--coin-id");
  if (!/^\d+$/.test(String(args.bizType || "").trim())) missing.push("--biz-type");
  if (!/^\d+$/.test(String(args.bizSubType || "").trim())) missing.push("--biz-sub-type");
  if (!/^\d+$/.test(String(args.status || "").trim())) missing.push("--status");
  if (!/^\d+$/.test(String(args.timeoutMs || "").trim())) missing.push("--timeout-ms");
  if (missing.length) {
    console.log(JSON.stringify({ ok: false, dryRun: args.dryRun, missing }, null, 2));
    process.exit(args.dryRun ? 0 : 2);
  }
}

export function resolvedMessageId(args) {
  return args.messageId || String(Date.now()).slice(-11);
}

export function buildMqRechargePayload(args) {
  return {
    after: {
      id: Number(resolvedMessageId(args)),
      user_id: Number(args.uid),
      coin_id: Number(args.coinId),
      amount: String(args.amount),
      biz_type: Number(args.bizType),
      biz_sub_type: Number(args.bizSubType),
      status: Number(args.status),
    },
  };
}

export function parseArgs(argv) {
  const args = {
    dryRun: false,
    confirmRun: false,
    visible: false,
    activityAlias: '',
    activityId: '',
    taskId: '4991',
    email: '',
    uid: '',
    amount: '200',
    timeoutMs: '90000',
    kafkaUrl: 'http://10.5.53.28:8080/ui/clusters/new-stg-kafka/all-topics/flink.exchange.spot_capital_order_info/messages?keySerde=String&valueSerde=String&limit=100'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--confirm-run') args.confirmRun = true;
    else if (value === '--visible') args.visible = true;
    else if (value === '--activity-alias') args.activityAlias = argv[++index] || '';
    else if (value === '--activity-id') args.activityId = argv[++index] || '';
    else if (value === '--task-id') args.taskId = argv[++index] || '4991';
    else if (value === '--email') args.email = argv[++index] || '';
    else if (value === '--uid') args.uid = argv[++index] || '';
    else if (value === '--amount') args.amount = argv[++index] || '200';
    else if (value === '--timeout-ms') args.timeoutMs = argv[++index] || '90000';
    else if (value === '--kafka-url') args.kafkaUrl = argv[++index] || args.kafkaUrl;
    else if (value === '--help' || value === '-h') args.help = true;
  }
  return args;
}

export function help() {
  return `Usage:
  node scripts/frontend-draw-kafka-recharge-verify.mjs --dry-run --activity-alias <alias> --activity-id <id> --email <email> --uid <uid>
  node scripts/frontend-draw-kafka-recharge-verify.mjs --confirm-run --visible --activity-alias <alias> --activity-id <id> --email <email> --uid <uid>

Notes:
  - Uses frontend login cookie injection, optional signup click, Kafka UI callback send, then draw-page task verification.
  - Reads password from WEEX_FRONTEND_COMMON_PASSWORD or WEEX_FRONTEND_PASSWORD.
  - Does not print tokens/cookies/password.`;
}

export function resolveConfig(args, password) {
  const timeoutMs = Number(args.timeoutMs || '90000');
  const amount = Number(args.amount || '200');
  const uid = Number(args.uid || '0');
  const taskId = Number(args.taskId || '4991');
  const drawUrl = `https://stg-www.weex.tech/zh-CN/events/draw/${args.activityAlias}`;
  const missing = [];
  if (!args.activityAlias) missing.push('activityAlias');
  if (!args.activityId) missing.push('activityId');
  if (!args.email) missing.push('email');
  if (!args.uid) missing.push('uid');
  if (!password) missing.push('WEEX_FRONTEND_COMMON_PASSWORD/WEEX_FRONTEND_PASSWORD');
  return { timeoutMs, amount, uid, taskId, drawUrl, missing };
}

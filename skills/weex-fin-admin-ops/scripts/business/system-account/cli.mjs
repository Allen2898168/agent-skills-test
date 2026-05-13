export function parseArgs(argv) {
  const args = {
    count: 1,
    userType: "",
    remark: "",
    tagId: 9,
    site: "GLOBAL",
    authorities: "1,2,3,4,5,6",
    isSystem: 0,
    isGray: 0,
    isInternal: 0,
    isSpotPro: 0,
    isFirstTime: 0,
    outputDir: "generated/fin-system-accounts",
    pollIntervalMs: 1000,
    pollTimeoutMs: 120000,
    dryRun: false,
    confirmCreate: false,
    saveSecrets: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--confirm-create") args.confirmCreate = true;
    else if (value === "--save-secrets") args.saveSecrets = true;
    else if (value === "--count") args.count = Number(argv[++index]);
    else if (value === "--user-type") args.userType = argv[++index] || "";
    else if (value === "--remark") args.remark = argv[++index] || "";
    else if (value === "--tag-id") args.tagId = Number(argv[++index]);
    else if (value === "--site") args.site = argv[++index] || "";
    else if (value === "--authorities") args.authorities = argv[++index] || "";
    else if (value === "--output-dir") args.outputDir = argv[++index] || "";
    else if (value === "--poll-timeout-ms") args.pollTimeoutMs = Number(argv[++index]);
    else if (value === "--poll-interval-ms") args.pollIntervalMs = Number(argv[++index]);
    else throw new Error(`Unknown option: ${value}`);
  }
  return args;
}

export function help() {
  return `Usage:
  node skills/weex-fin-admin-ops/scripts/system-account-create.mjs --dry-run --count 1 --user-type <type> --remark <remark>
  node skills/weex-fin-admin-ops/scripts/system-account-create.mjs --confirm-create --save-secrets --count 1 --user-type <type> --remark <remark>

Options:
  --count <n>             Number of system accounts to create.
  --user-type <text>      Required user type label.
  --remark <text>         Required remark.
  --tag-id <id>           Account tag id. Default 9, matching the captured FIN UI flow.
  --site <site>           Site. Default GLOBAL.
  --authorities <csv>     API permissions. Default 1,2,3,4,5,6.
  --output-dir <dir>      Local output dir for generated JSON/CSV.
  --dry-run               Print the plan without creating accounts.
  --confirm-create        Required for actual account creation.
  --save-secrets          Required to save returned password, Google code, API key, secret, and passphrase locally.

Secrets returned by FIN are never printed to stdout. They are saved only when --save-secrets is present.`;
}

export function validateArgs(args) {
  const missing = [];
  if (!Number.isInteger(args.count) || args.count <= 0 || args.count > 100) missing.push("--count 1-100");
  if (!args.userType) missing.push("--user-type");
  if (!args.remark) missing.push("--remark");
  if (!Number.isInteger(args.tagId) || args.tagId <= 0) missing.push("--tag-id");
  if (!args.site) missing.push("--site");
  if (!/^\d+(,\d+)*$/.test(args.authorities)) missing.push("--authorities");
  if (!args.outputDir) missing.push("--output-dir");
  if (missing.length) throw new Error(`Missing or invalid options: ${missing.join(", ")}`);
}

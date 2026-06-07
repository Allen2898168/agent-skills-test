#!/usr/bin/env node
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-register-template-from-scratch-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-register-template-from-scratch-fast-api.mjs --confirm-create

Options:
  --name <text>              optional; default 自动化报名模板_从零_<ts>
  --participant-mode <csv>   default REGISTERED_MANUAL
  --limit-permissions <csv>  default APPLY
  --allow-range <text>       default NONE
  --limit-range <csv>        default NONE
  --min-team-size <n>        optional
  --max-participant <n>      optional
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.name = args.name ? String(args.name) : "";
  args.participantMode = String(args.participantMode || "REGISTERED_MANUAL")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
  args.limitPermissions = String(args.limitPermissions || "APPLY")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
  args.allowRange = String(args.allowRange || "NONE");
  args.limitRange = String(args.limitRange || "NONE")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
  args.minTeamSize = args.minTeamSize !== undefined ? Number(args.minTeamSize) : null;
  args.maxParticipant = args.maxParticipant !== undefined ? Number(args.maxParticipant) : null;
  return args;
}

function buildPayload(args) {
  const name = String(args.name || `自动化报名模板_从零_${timestamp()}`).slice(0, 60);
  return {
    name,
    allowRange: args.allowRange,
    limitRange: args.limitRange,
    participantMode: args.participantMode,
    limitPermissions: args.limitPermissions,
    maxParticipant: Number.isFinite(args.maxParticipant) ? args.maxParticipant : null,
    minTeamSize: Number.isFinite(args.minTeamSize) ? args.minTeamSize : null,
    conditions: {
      type: null,
      allowAgentList: [],
      allowUserList: [],
      allowAreaList: [],
      limitAgentList: [],
      limitAgentDirectList: [],
      limitUserList: [],
      limitUserLabelList: [],
      limitAreaList: [],
      limitKyc: false,
      limitKycList: [],
      limitBackupChannel: false,
      limitDeviceList: [],
      allowAgencyGroupList: [],
      allowAgentRoleDivideList: ["NONE"],
      allowChannelCodeList: [],
      allowInviteCodeList: [],
      mixedType: null,
      limitApplyCount: null,
      tradeTypeList: [],
      userRegion: "",
      limitVipLevelList: [],
      limitVipWhiteType: "",
      limitRiskLabelList: [],
      contractAccountValue: 0,
      registerTimeStart: null,
      registerTimeEnd: null,
      limitChannelCodeList: [],
      limitInviteCodeList: [],
    },
  };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  const payload = buildPayload(args);
  const plan = {
    mode: "headless_api",
    writes: { create: true },
    payloadPreview: {
      name: payload.name,
      participantMode: payload.participantMode,
      allowRange: payload.allowRange,
      limitRange: payload.limitRange,
      limitPermissions: payload.limitPermissions,
      maxParticipant: payload.maxParticipant,
      minTeamSize: payload.minTeamSize,
    },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建报名模板。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const created = await api.post("/prod-api/activity/apply", payload);
    if (created.body?.code !== 200) throw new Error(`Create register template failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);
    const verify = await api.get(`/prod-api/activity/apply/list?name=${encodeURIComponent(payload.name)}&pageNum=1&pageSize=1`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created register template not found by name: ${payload.name}`);
    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/register`,
      created: { id: String(row.id), name: row.name || payload.name },
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api.close();
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


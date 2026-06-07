#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { buildSuffix, createAdminApiSession, firstRow, stripCloneFields } from "./lib/admin-api.mjs";
import { parseLastJson } from "../../../tools/lib/parse-last-json.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # plan only
  node skills/weex-admin-ops/scripts/create-lottery-contract-doge-position-airdrop-fast-api.mjs --required-volume 2 --dry-run

  # create + online
  node skills/weex-admin-ops/scripts/create-lottery-contract-doge-position-airdrop-fast-api.mjs --required-volume 2 --confirm-create

Options:
  --required-volume <n>       required; 合约交易量阈值（USDT）
  --coin <symbol>             default DOGE
  --start-offset-seconds <n>  default 120
  --end-days <n>              default 30
  --template-alias <alias>    default lf25085715
  --title-prefix <text>       default DOGE仓位
  --alias-prefix <text>       default dg
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.requiredVolume = args.requiredVolume ? Number(args.requiredVolume) : NaN;
  args.coin = args.coin ? String(args.coin) : "DOGE";
  args.startOffsetSeconds = args.startOffsetSeconds ? Number(args.startOffsetSeconds) : 120;
  args.endDays = args.endDays ? Number(args.endDays) : 30;
  args.templateAlias = args.templateAlias ? String(args.templateAlias) : "lf25085715";
  args.titlePrefix = args.titlePrefix ? String(args.titlePrefix) : "DOGE仓位";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "dg";
  return args;
}

function formatDateTimeInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function activityWindow(offsetSeconds = 120, endDays = 30) {
  const start = new Date(Date.now() + Number(offsetSeconds) * 1000);
  const end = new Date(start.getTime() + Number(endDays) * 24 * 60 * 60 * 1000);
  return {
    start: formatDateTimeInTimeZone(start, "Asia/Shanghai"),
    end: formatDateTimeInTimeZone(end, "Asia/Shanghai"),
  };
}

function runChildJson(commandArgs, { timeoutMs = 300000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;
    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, Math.max(30000, Number(timeoutMs)));
    child.stdout.on("data", chunk => (stdout += chunk.toString()));
    child.stderr.on("data", chunk => (stderr += chunk.toString()));
    child.on("close", code => {
      clearTimeout(timer);
      const parsed = parseLastJson(stdout) || parseLastJson(stderr);
      resolve({ ok: code === 0 && Boolean(parsed?.ok !== false), code, killedByTimeout, stdout, stderr, json: parsed });
    });
  });
}

async function resolveTemplate(api, templateAlias) {
  const list = await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=LOTTERY&showUrl=${encodeURIComponent(templateAlias)}`);
  const row = firstRow(list);
  const id = row?.activityId || row?.id;
  if (!id) throw new Error(`Template activity not found: ${templateAlias}`);
  const detail = await api.get(`/prod-api/activity/config/${encodeURIComponent(id)}`);
  if (detail.body?.code !== 200 || !detail.body?.data) throw new Error(`Template detail failed: ${id}`);
  return { id: String(id), alias: templateAlias, detail: detail.body.data };
}

function buildActivityPayloadFromTemplate({ templateDetail, args, applyConfigId, taskId, prizeId }) {
  const ts = buildSuffix();
  const window = activityWindow(args.startOffsetSeconds, args.endDays);
  const alias = String(`${args.aliasPrefix}${Date.now().toString().slice(-8)}`).slice(0, 10);
  const title = String(`${args.titlePrefix}${ts.slice(-6)}`).slice(0, 15);
  const payload = stripCloneFields(templateDetail);
  payload.title = title;
  payload.showUrl = alias;
  if ("startTime" in payload) payload.startTime = window.start;
  if ("endTime" in payload) payload.endTime = window.end;
  if (Array.isArray(payload.periods) && payload.periods[0]) {
    if ("startTime" in payload.periods[0]) payload.periods[0].startTime = window.start;
    if ("endTime" in payload.periods[0]) payload.periods[0].endTime = window.end;
  }

  payload.applyConfigId = Number(applyConfigId);
  payload.taskConfig = [{ id: Number(taskId), order: 1 }];
  payload.showBeginnerTaskConfig = [];

  if (Array.isArray(payload.prize) && payload.prize.length === 8) {
    payload.prize = payload.prize.map(record => ({
      ...record,
      prizeType: 4,
      linkPrizeId: Number(prizeId),
      prizeName: record?.prizeName || `DOGE_POSITION_${prizeId}`,
    }));
  }

  return { alias, title, window, payload };
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!Number.isFinite(args.requiredVolume) || args.requiredVolume <= 0) throw new Error("--required-volume is required and must be > 0");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  const plan = {
    mode: "headless_api",
    timeZone: "Asia/Shanghai",
    window: activityWindow(args.startOffsetSeconds, args.endDays),
    dependencies: {
      prize: { coin: args.coin, subtype: "POSITION_AIRDROP", script: "create-position-airdrop-prize-fast-api.mjs" },
      task: { kind: "contract_trading_volume", requiredVolume: args.requiredVolume, script: "create-roulette-contract-volume-task-fast-api.mjs" },
    },
    templateAlias: args.templateAlias,
    activity: { titlePrefix: args.titlePrefix, aliasPrefix: args.aliasPrefix },
    writes: { create: true, online: true },
  };

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建并上线转盘抽奖活动。");
  assertAdminLoginConfig(config);

  const startedAt = Date.now();
  let api = null;
  try {
    const prize = await runChildJson([
      "skills/weex-admin-ops/scripts/create-position-airdrop-prize-fast-api.mjs",
      "--coin",
      args.coin,
      "--contract-keyword",
      args.coin,
      "--required-amount",
      "1",
      "--leverage",
      "1",
      "--confirm-create",
    ]);
    if (!prize.ok) throw new Error(`create-position-airdrop-prize-fast-api.mjs failed: ${prize.json?.error || "unknown"}`);
    const prizeId = String(prize.json?.created?.id || "");
    if (!prizeId) throw new Error("Missing created prize id");

    const task = await runChildJson([
      "skills/weex-admin-ops/scripts/create-roulette-contract-volume-task-fast-api.mjs",
      "--required-volume",
      String(args.requiredVolume),
      "--confirm-create",
    ]);
    if (!task.ok) throw new Error(`create-roulette-contract-volume-task-fast-api.mjs failed: ${task.json?.error || "unknown"}`);
    const taskId = String(task.json?.created?.id || "");
    if (!taskId) throw new Error("Missing created task id");

    api = await createAdminApiSession({ config, requireApiLogin: true });
    const template = await resolveTemplate(api, args.templateAlias);
    const applyConfigId = String(template.detail?.applyConfigId || "");
    if (!applyConfigId) throw new Error("Template activity is missing applyConfigId");

    const built = buildActivityPayloadFromTemplate({
      templateDetail: template.detail,
      args,
      applyConfigId,
      taskId,
      prizeId,
    });

    const create = await api.post("/prod-api/activity/config", built.payload);
    if (create.body?.code !== 200) throw new Error(`Create lottery activity failed: ${JSON.stringify({ code: create.body?.code, msg: create.body?.msg || create.body?.message })}`);

    const row = firstRow(await api.get(`/prod-api/activity/config/list?pageNum=1&pageSize=1&type=LOTTERY&showUrl=${encodeURIComponent(built.alias)}`));
    const activityId = String(row?.activityId || row?.id || "");
    if (!activityId) throw new Error(`Created activity not found by alias: ${built.alias}`);

    const online = await api.post("/prod-api/activity/lottery/online", { activityId: Number(activityId), totp: String(config.googleCode || "") });
    if (online.body?.code !== 200) throw new Error(`Online failed: ${JSON.stringify({ code: online.body?.code, msg: online.body?.msg || online.body?.message })}`);

    const verify = await api.get(`/prod-api/activity/config/${encodeURIComponent(activityId)}`);
    const verifyItem = verify.body?.data || null;

    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activities/lottery`,
      created: {
        activityId,
        alias: built.alias,
        title: built.title,
        startTime: built.window.start,
        endTime: built.window.end,
        requiredVolume: args.requiredVolume,
      },
      dependencyIds: {
        prizeId,
        taskId,
        applyConfigId,
        template: { activityId: template.id, alias: template.alias },
      },
      verifyHints: {
        status: verifyItem?.status || null,
        stage: verifyItem?.stage || null,
        raffleStyle: verifyItem?.raffleStyle || null,
        prizeCount: Array.isArray(verifyItem?.prize) ? verifyItem.prize.length : null,
        taskConfigCount: Array.isArray(verifyItem?.taskConfig) ? verifyItem.taskConfig.length : null,
      },
      plan,
      durationMs: Date.now() - startedAt,
    });
    await api.close();
    api = null;
    return 0;
  } finally {
    if (api) await api.close().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


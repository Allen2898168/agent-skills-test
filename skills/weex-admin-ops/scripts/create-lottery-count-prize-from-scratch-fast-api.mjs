#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson, timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession, firstRow } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-lottery-count-prize-from-scratch-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-lottery-count-prize-from-scratch-fast-api.mjs --confirm-create

Options:
  --name-prefix <text>   default 自动化-抽奖次数
  --alias-prefix <text>  default api_draw
  --efficient-day <n>    default 1
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "自动化-抽奖次数";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "api_draw";
  args.efficientDay = Number(args.efficientDay || 1);
  return args;
}

async function uploadImgReplace({ baseUrl, authorization, imagePath }) {
  const bytes = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath) || "default.webp";
  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: "image/webp" }));
  const response = await fetch(`${String(baseUrl).replace(/\/+$/, "")}/prod-api/common/uploadImgReplace`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`uploadImgReplace failed: HTTP ${response.status}`);
  if (Number(body?.code) !== 200) throw new Error(`uploadImgReplace not accepted: ${JSON.stringify({ code: body?.code, msg: body?.msg || body?.message })}`);
  if (!body?.data) throw new Error("uploadImgReplace missing data");
  return String(body.data);
}

function buildPayload({ args, picture }) {
  const ts = timestamp();
  const short = String(Date.now()).slice(-6);
  const prizeName = `${args.namePrefix}_${ts}_${short}`.slice(0, 60);
  const prizeAlias = `${args.aliasPrefix}_${short}`.slice(0, 60);
  return {
    prizeType: "VIRTUAL",
    prizeSubType: "LOTTERY_COUNT",
    prizeName,
    prizeAlias,
    prizeNameI18: [],
    picture: String(picture || ""),
    prizeThreeTierType: 1,
    prizeUnit: "1",
    prizeScale: 2,
    efficientDay: Number(args.efficientDay || 1),
    couponEfficientDay: null,
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

  const plan = {
    mode: "headless_api",
    prize: { type: "VIRTUAL", subtype: "LOTTERY_COUNT", efficientDay: args.efficientDay },
    writes: { create: true },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建抽奖次数奖品。");
  assertAdminLoginConfig(config);

  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const picture = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, imagePath: config.imagePath });
    const payload = buildPayload({ args, picture });
    const created = await api.post("/prod-api/activity/prize", payload);
    if (created.body?.code !== 200) throw new Error(`Create prize failed: ${JSON.stringify({ code: created.body?.code, msg: created.body?.msg || created.body?.message })}`);
    const verify = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=${encodeURIComponent(payload.prizeAlias)}`);
    const row = firstRow(verify);
    if (!row?.id) throw new Error(`Created prize not found by alias: ${payload.prizeAlias}`);
    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/prize`,
      created: {
        id: String(row.id),
        prizeName: row.prizeName || payload.prizeName,
        prizeAlias: row.prizeAlias || payload.prizeAlias,
        prizeType: payload.prizeType,
        prizeSubType: payload.prizeSubType,
        prizeThreeTierType: payload.prizeThreeTierType,
      },
      durationMs: Date.now() - startedAt,
    });
    return 0;
  } finally {
    await api.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


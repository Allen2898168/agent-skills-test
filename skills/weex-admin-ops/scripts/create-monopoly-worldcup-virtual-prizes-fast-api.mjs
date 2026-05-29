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
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-virtual-prizes-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-monopoly-worldcup-virtual-prizes-fast-api.mjs --confirm-create

Options:
  --subtypes <csv>         default DICE,INTEGRAL,NO_REWARD
  --name-prefix <text>     default 大富翁-虚拟奖品
  --alias-prefix <text>    default mwc_v
  --force                  create even if same alias exists (not recommended)
  --confirm-create
  --dry-run
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create", "--force"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.force = Boolean(args.force);
  args.subtypes = args.subtypes ? String(args.subtypes) : "DICE,INTEGRAL,NO_REWARD";
  args.namePrefix = args.namePrefix ? String(args.namePrefix) : "大富翁-虚拟奖品";
  args.aliasPrefix = args.aliasPrefix ? String(args.aliasPrefix) : "mwc_v";
  return args;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function buildPrizeName(subtype) {
  const map = { DICE: "骰子", INTEGRAL: "积分", NO_REWARD: "无奖励" };
  return `虚拟积分或资格-${map[subtype] || subtype}`;
}

function buildPrizePayload({ subtype, name, alias, picture }) {
  const base = {
    prizeType: "VIRTUAL",
    prizeSubType: subtype,
    prizeName: name,
    prizeAlias: alias,
    prizeUnit: "1",
    prizeNameI18: [],
    picture,
    prizeScale: 2,
    efficientDay: 1,
    couponEfficientDay: undefined,
  };
  if (subtype === "DICE") {
    return { ...base, prizeScale: 0, efficientDay: 0 };
  }
  if (subtype === "MULTIPLIER_COUPON") {
    return { ...base, prizeScale: 0, efficientDay: 0, multiplier: 2 };
  }
  if (subtype === "NO_REWARD") {
    return { ...base, prizeScale: 0, efficientDay: 0 };
  }
  return base;
}

async function uploadImgReplace({ baseUrl, authorization, filePath }) {
  if (!fs.existsSync(filePath)) throw new Error(`Prize image not found: ${filePath}`);
  const base = normalizeBaseUrl(baseUrl);
  const bytes = fs.readFileSync(filePath);
  const fileName = path.basename(filePath) || "default.webp";
  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: "image/webp" }));
  const response = await fetch(`${base}/prod-api/common/uploadImgReplace`, {
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

async function findByAlias(api, alias) {
  const list = await api.get(`/prod-api/activity/prize/list?pageNum=1&pageSize=1&alias=${encodeURIComponent(alias)}`);
  return firstRow(list);
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const subtypes = args.subtypes
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  if (!subtypes.length) throw new Error("--subtypes is empty");

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  const plan = {
    mode: "headless_api",
    prizeType: "VIRTUAL",
    subtypes,
    writes: { create: true },
  };
  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, plan });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建奖品。");

  assertAdminLoginConfig(config);
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  try {
    const uploaded = await uploadImgReplace({ baseUrl: config.baseUrl, authorization: api.authorization, filePath: config.imagePath });
    const ts = timestamp();
    const short = String(Date.now()).slice(-6);
    const created = [];
    for (const subtype of subtypes) {
      const alias = `${args.aliasPrefix}_${subtype}_${short}`.slice(0, 32);
      const name = `${args.namePrefix}_${buildPrizeName(subtype)}_${ts}`.slice(0, 60);
      if (!args.force) {
        const existing = await findByAlias(api, alias).catch(() => null);
        if (existing?.id) throw new Error(`Prize alias already exists: ${alias}`);
      }
      const payload = buildPrizePayload({ subtype, name, alias, picture: uploaded });
      const res = await api.post("/prod-api/activity/prize", payload);
      if (res.body?.code !== 200) throw new Error(`Create prize failed: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
      const verify = await findByAlias(api, alias);
      if (!verify?.id) throw new Error(`Created prize not found by alias: ${alias}`);
      created.push({ id: String(verify.id), name: verify.prizeName || name, alias: verify.prizeAlias || alias, prizeSubType: subtype });
    }
    printJson({
      ok: true,
      mode: "headless_api",
      finalUrl: `${config.baseUrl}/activity/prize`,
      uploadedImageUrl: uploaded,
      created,
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


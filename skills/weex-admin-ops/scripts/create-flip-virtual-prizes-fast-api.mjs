#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  # dry-run
  node skills/weex-admin-ops/scripts/create-flip-virtual-prizes-fast-api.mjs --dry-run

  # create
  node skills/weex-admin-ops/scripts/create-flip-virtual-prizes-fast-api.mjs --confirm-create

  # create + cleanup
  node skills/weex-admin-ops/scripts/create-flip-virtual-prizes-fast-api.mjs --confirm-create --cleanup --confirm-cleanup

Options:
  --dry-run
  --confirm-create
  --cleanup
  --confirm-cleanup
  --help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--confirm-create", "--cleanup", "--confirm-cleanup"] });
  args.dryRun = Boolean(args.dryRun);
  args.confirmCreate = Boolean(args.confirmCreate);
  args.cleanup = Boolean(args.cleanup);
  args.confirmCleanup = Boolean(args.confirmCleanup);
  return args;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function virtualSubTypeLabel(prizeSubType) {
  const map = {
    FLIP_CARD: "小丑牌-抽牌次数",
    FLIP_INTEGRAL: "小丑牌-积分加成",
  };
  return map[prizeSubType] || prizeSubType;
}

function buildPrizeName(subtype) {
  return `虚拟积分或资格-${virtualSubTypeLabel(subtype)}`;
}

async function uploadDefaultPrizeImage({ baseUrl, authorization, imagePath }) {
  const fileBytes = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath) || "default.webp";
  const file = new File([fileBytes], fileName, { type: "image/webp" });
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${baseUrl}/prod-api/common/uploadImgReplace`, {
    method: "POST",
    headers: { Authorization: authorization },
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`uploadImgReplace failed: HTTP ${response.status}`);
  if (Number(body?.code) !== 200) throw new Error(`uploadImgReplace not accepted: ${JSON.stringify({ code: body?.code, msg: body?.msg || body?.message })}`);
  if (!body?.data) throw new Error("uploadImgReplace missing data");
  return body.data;
}

async function findExistingByAlias(session, alias) {
  const q = new URLSearchParams({ pageNum: "1", pageSize: "1", prizeAlias: alias });
  const res = await session.get(`/prod-api/activity/prize/list?${q.toString()}`);
  const rows = Array.isArray(res.body?.rows) ? res.body.rows : [];
  return rows[0] || null;
}

function buildVirtualPrizePayload({ subtype, displayName, alias, picture }) {
  return {
    prizeType: "VIRTUAL",
    prizeSubType: subtype,
    prizeName: displayName,
    prizeAlias: alias,
    prizeUnit: "1",
    prizeNameI18: [],
    picture,
    prizeScale: 2,
    efficientDay: 1,
  };
}

async function createPrize(session, payload) {
  const res = await session.post("/prod-api/activity/prize", payload);
  if (Number(res.body?.code) !== 200) throw new Error(`create prize rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return true;
}

async function deletePrizeById(session, id) {
  const res = await session.delete(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  if (Number(res.body?.code) !== 200) throw new Error(`delete prize rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return true;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  const subtypes = ["FLIP_CARD", "FLIP_INTEGRAL"];
  const short = String(Date.now()).slice(-6);
  const planned = subtypes.map(subtype => ({
    subtype,
    displayName: buildPrizeName(subtype),
    alias: `VIRTUAL-${subtype}-${short}`.slice(0, 32),
  }));

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, planned });
    return 0;
  }
  if (!args.confirmCreate) throw new Error("需要用户确认：请加 --confirm-create 后才允许创建小丑牌虚拟奖品。");
  if (args.cleanup && !args.confirmCleanup) throw new Error("需要用户确认：cleanup 需要传 --confirm-cleanup（会删除创建的奖品）。");
  assertAdminLoginConfig(config);

  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const session = await createAdminApiSession({ config, requireApiLogin: true });
  const startedAt = Date.now();
  const created = [];
  try {
    const picture = await uploadDefaultPrizeImage({ baseUrl, authorization: session.authorization, imagePath: config.imagePath });
    for (const spec of planned) {
      const exists = await findExistingByAlias(session, spec.alias);
      if (exists?.id) {
        throw new Error(`prize alias already exists: ${spec.alias} (id=${exists.id})`);
      }
      const payload = buildVirtualPrizePayload({ subtype: spec.subtype, displayName: spec.displayName, alias: spec.alias, picture });
      await createPrize(session, payload);
      const row = await findExistingByAlias(session, spec.alias);
      if (!row?.id) throw new Error(`Created prize not found by alias: ${spec.alias}`);
      created.push({ id: String(row.id), alias: spec.alias, subtype: spec.subtype, name: row.prizeName || spec.displayName });
    }

    const cleanup = [];
    if (args.cleanup) {
      for (const item of created) {
        cleanup.push({ id: item.id, ok: await deletePrizeById(session, item.id).catch(() => false) });
      }
    }

    printJson({ ok: true, mode: "headless_api", finalUrl: `${config.baseUrl}/activity/prize`, planned, created, cleanup, durationMs: Date.now() - startedAt });
    return 0;
  } finally {
    await session.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, mode: "headless_api", error: error.message }, process.stderr);
  process.exitCode = 1;
}


#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node scripts/update-monopoly-prize-pictures-from-folder-api.mjs

Options:
  --dir <path>   Image folder path (default: /Users/gabriel/Downloads/大富翁配图h5/price)
  --dry-run      Print plan only; no API writes
  --help         Show help

Mapping (by file name):
  - USDT.webp      -> 1049 (币种-USDT)
  - WXT.webp       -> 1036 (虚拟积分或资格-积分)
  - 体验金-1.webp   -> 1037 (虚拟积分或资格-合约抵扣金)
  - 礼物.webp       -> 1033 (赠金-赠金)
  - 骰子.webp       -> 1040 (虚拟积分或资格-骰子)
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run"], strings: ["--dir"] });
  args.dryRun = Boolean(args.dryRun);
  args.dir = String(args.dir || "/Users/gabriel/Downloads/大富翁配图h5/price");
  return args;
}

const PLAN = [
  { prizeId: 1049, file: "USDT.webp" },
  { prizeId: 1036, file: "WXT.webp" },
  { prizeId: 1037, file: "体验金-1.webp" },
  { prizeId: 1033, file: "礼物.webp" },
  { prizeId: 1040, file: "骰子.webp" }
];

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function uploadImgReplace({ baseUrl, authorization, filePath }) {
  const fileBytes = fs.readFileSync(filePath);
  const fileName = path.basename(filePath) || "image.webp";
  const file = new File([fileBytes], fileName, { type: guessMimeType(filePath) });
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

async function getPrizeDetail(session, id) {
  const res = await session.get(`/prod-api/activity/prize/${id}`);
  if (res.status >= 400) throw new Error(`prize detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`prize detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body?.data ?? res.body;
}

async function updatePrize(session, payload) {
  const res = await session.put("/prod-api/activity/prize", payload);
  if (res.status >= 400) throw new Error(`prize update HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`prize update rejected: ${JSON.stringify({ code: res.body?.code, msg: res.body?.msg || res.body?.message })}`);
  return res.body;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  const plan = PLAN.map(item => ({
    ...item,
    filePath: path.join(args.dir, item.file),
    exists: fs.existsSync(path.join(args.dir, item.file))
  }));
  const missing = plan.filter(p => !p.exists).map(p => p.file);
  if (missing.length) {
    throw new Error(`image files missing in ${args.dir}: ${missing.join(", ")}`);
  }

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, dir: args.dir, plan: plan.map(p => ({ prizeId: p.prizeId, file: p.file, filePath: p.filePath })) });
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);
  assertAdminLoginConfig(config);
  const session = await createAdminApiSession({ config, requireApiLogin: true });

  try {
    const baseUrl = String(config.baseUrl || "").replace(/\/+$/, "");
    const authorization = session.authorization;
    if (!authorization) throw new Error("missing session.authorization");

    const updated = [];
    for (const item of plan) {
      const prize = await getPrizeDetail(session, item.prizeId);
      const pictureUrl = await uploadImgReplace({ baseUrl, authorization, filePath: item.filePath });
      await updatePrize(session, { ...prize, picture: pictureUrl });
      const after = await getPrizeDetail(session, item.prizeId);
      if (String(after?.picture || "") !== String(pictureUrl)) {
        throw new Error(`verify failed: picture not updated for prize ${item.prizeId}`);
      }
      updated.push({ prizeId: item.prizeId, prizeName: after?.prizeName, file: item.file, picture: pictureUrl });
    }

    printJson({ ok: true, updatedCount: updated.length, updated });
    return 0;
  } finally {
    await session.close?.().catch(() => {});
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  printJson({ ok: false, error: error.message }, process.stderr);
  process.exitCode = 1;
}

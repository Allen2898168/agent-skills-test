#!/usr/bin/env node
import { parseFlags, printJson } from "./lib/cli.mjs";
import { adminConfig, assertAdminLoginConfig, loadLocalEnv, pathsFrom } from "./lib/runtime.mjs";
import { createAdminApiSession } from "./lib/admin-api.mjs";

const { repoRoot } = pathsFrom(import.meta.url);

function usage() {
  return `Usage:
  node skills/weex-admin-ops/scripts/copy-prize-fast-api.mjs --prize-id 462
  node skills/weex-admin-ops/scripts/copy-prize-fast-api.mjs --prize-id 462 --cleanup

Options:
  --prize-id <id>     required
  --cleanup           delete copied prize after verification
  --dry-run           print planned action without writing
  --help              show help
`;
}

function parseArgs() {
  const args = parseFlags(process.argv.slice(2), { booleans: ["--dry-run", "--cleanup", "--help"] });
  args.dryRun = Boolean(args.dryRun);
  args.cleanup = Boolean(args.cleanup);
  if (args.help) return args;
  if (!args.prizeId) throw new Error("--prize-id is required");
  if (!/^\d+$/.test(String(args.prizeId))) throw new Error("--prize-id must be numeric");
  args.prizeId = Number(args.prizeId);
  return args;
}

async function detailById(api, id) {
  const res = await api.get(`/prod-api/activity/prize/${encodeURIComponent(String(id))}`);
  if (res.status >= 400) throw new Error(`prize detail HTTP ${res.status}`);
  if (Number(res.body?.code) !== 200) throw new Error(`prize detail failed: ${JSON.stringify({ id, code: res.body?.code, msg: res.body?.msg || res.body?.message || "" })}`);
  return res.body?.data ?? res.body;
}

async function run() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }

  loadLocalEnv(repoRoot);
  const config = adminConfig(repoRoot);

  if (args.dryRun) {
    printJson({ ok: true, dryRun: true, mode: "headless_api", action: "copy_prize_by_id", prizeId: args.prizeId, cleanup: args.cleanup });
    return 0;
  }

  assertAdminLoginConfig(config);
  const startedAt = Date.now();
  const api = await createAdminApiSession({ config, requireApiLogin: true });
  try {
    const before = await detailById(api, args.prizeId);
    const copy = await api.post("/prod-api/activity/prize/copy", { id: args.prizeId });
    if (copy.status >= 400) throw new Error(`copy HTTP ${copy.status}`);
    if (Number(copy.body?.code) !== 200) throw new Error(`copy failed: ${JSON.stringify({ code: copy.body?.code, msg: copy.body?.msg || copy.body?.message || "" })}`);
    const copiedId = copy.body?.data?.id ?? copy.body?.data?.prizeId ?? copy.body?.data?.activityPrizeId ?? null;
    if (!copiedId) {
      throw new Error("copy response missing copied id");
    }
    const after = await detailById(api, copiedId);

    let cleanupResult = null;
    if (args.cleanup) {
      const del = await api.delete(`/prod-api/activity/prize/${encodeURIComponent(String(copiedId))}`);
      cleanupResult = { status: del.status, code: del.body?.code ?? null, msg: del.body?.msg || del.body?.message || "" };
    }

    const ok = Boolean(after && String(after?.id || "") === String(copiedId));
    printJson({
      ok,
      mode: "headless_api",
      finalUrl: "/activity/prize",
      prizeId: args.prizeId,
      before: { id: before?.id ?? args.prizeId, prizeAlias: before?.prizeAlias || "", prizeName: before?.prizeName || "" },
      copied: { id: String(copiedId), prizeAlias: after?.prizeAlias || "", prizeName: after?.prizeName || "" },
      copyResult: { status: copy.status, code: copy.body?.code ?? null, msg: copy.body?.msg || copy.body?.message || "" },
      cleanup: cleanupResult,
      durationMs: Date.now() - startedAt,
    }, ok ? process.stdout : process.stderr);
    return ok ? 0 : 1;
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


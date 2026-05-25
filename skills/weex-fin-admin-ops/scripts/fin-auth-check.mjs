#!/usr/bin/env node
import { defaultCdpUrl, readFinAuth, postFin, assertBusinessOk, DEFAULT_BIZ_TYPE, closeCdpBrowser, openVisibleFinLoginPage, waitForFinPageClose } from "./business/finance-airdrop-reward/api.mjs";
import { loadFinEnv } from "./lib/env.mjs";

function parseArgs(argv) {
  const timeoutIndex = argv.indexOf("--timeout-ms");
  return {
    waitForClose: argv.includes("--wait-for-close"),
    timeoutMs: timeoutIndex >= 0 ? Number(argv[timeoutIndex + 1]) : null,
  };
}

function cdpBase(cdpUrl) {
  return String(cdpUrl || "").replace(/\/$/, "");
}

async function listCdpTargets(cdpUrl) {
  const response = await fetch(`${cdpBase(cdpUrl)}/json/list`);
  if (!response.ok) return [];
  return response.json();
}

function hasOpenFinTarget(targets) {
  return (targets || []).some(item => (
    item?.type === "page"
    && String(item?.url || "").includes("stg-admin-web-fin.weex.tech")
  ));
}

async function checkFinBase(cdpUrl, env) {
  const auth = await readFinAuth(cdpUrl, env);
  const response = await postFin(auth, `/admin/fin/asset/adjust/listSystemType/${DEFAULT_BIZ_TYPE}`);
  assertBusinessOk(response, "FIN base listSystemType");
  return {
    finalUrl: auth.url,
    title: auth.title,
    baseInterface: "listSystemType",
  };
}

async function main() {
  loadFinEnv();
  const args = parseArgs(process.argv.slice(2));
  const cdpUrl = defaultCdpUrl(process.env);

  try {
    const result = await checkFinBase(cdpUrl, process.env);
    console.log(JSON.stringify({ ok: true, loginRequired: false, ...result }, null, 2));
    return;
  } catch (error) {
    if (!args.waitForClose) {
      console.log(JSON.stringify({
        ok: false,
        loginRequired: true,
        cdpUrl,
        message: "Open the FIN Admin CDP Chrome page, log in, close the FIN page when done, then rerun the check.",
        error: error.message,
      }, null, 2));
      process.exitCode = 2;
      return;
    }
    await closeCdpBrowser(cdpUrl).catch(() => false);
    process.env.WEEX_FIN_CDP_HEADLESS = "false";
    process.env.WEEX_FIN_ALLOW_OPEN_TARGET = "true";
    const loginPage = await openVisibleFinLoginPage(cdpUrl, process.env);
    console.log(JSON.stringify({
      ok: false,
      loginRequired: true,
      recoveryPageOpened: true,
      cdpUrl,
      pageUrl: loginPage.url,
      message: "FIN Admin CDP Chrome page is open. Please log in and keep the FIN page open for a moment; this check will re-validate automatically and then exit.",
    }, null, 2));
  }

  const startedAt = Date.now();
  while (true) {
    const targets = await listCdpTargets(cdpUrl).catch(() => []);
    if (!hasOpenFinTarget(targets)) {
      await waitForFinPageClose(cdpUrl, 2000).catch(() => {});
      throw new Error("FIN login page was closed before auth recovery succeeded");
    }
    try {
      process.env.WEEX_FIN_CDP_HEADLESS = "true";
      delete process.env.WEEX_FIN_ALLOW_OPEN_TARGET;
      const result = await checkFinBase(cdpUrl, process.env);
      console.log(JSON.stringify({ ok: true, loginRequired: false, recheckedAfterClose: false, ...result }, null, 2));
      return;
    } catch {
      process.env.WEEX_FIN_CDP_HEADLESS = "false";
      process.env.WEEX_FIN_ALLOW_OPEN_TARGET = "true";
    }
    if (args.timeoutMs && Date.now() - startedAt > args.timeoutMs) {
      throw new Error("Timed out waiting for FIN auth recovery");
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, loginRequired: true, error: error.message }, null, 2));
  process.exitCode = 1;
});

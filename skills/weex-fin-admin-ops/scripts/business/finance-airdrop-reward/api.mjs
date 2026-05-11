import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_CDP_URL = "http://127.0.0.1:9222";
const FIN_API_BASE = "https://stg-admin-fin-app.weex.tech/api";
const FIN_HOST_MARKER = "stg-admin-web-fin.weex.tech";
const FIN_ORIGIN = `https://${FIN_HOST_MARKER}`;
const DEFAULT_FIN_PAGE_URL = "https://stg-admin-web-fin.weex.tech/zh-CN/spotProGrant/airdropRewardProd/";
const DEFAULT_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const DEFAULT_BIZ_TYPE = "125";
export const DEFAULT_CURRENCY = "USDT";
export const DEFAULT_SUB_BIZ_TYPE = "OTHER_ACTIVITIES";

export function maskUid(uid) {
  const value = String(uid || "");
  if (value.length <= 4) return value ? "***" : "";
  return `${"*".repeat(Math.max(3, value.length - 4))}${value.slice(-4)}`;
}

export function defaultCdpUrl(env) {
  return env.WEEX_FIN_CDP_URL || DEFAULT_CDP_URL;
}

function defaultFinPageUrl(env) {
  return env.WEEX_FIN_PAGE_URL || DEFAULT_FIN_PAGE_URL;
}

function defaultUserDataDir(env) {
  return env.WEEX_FIN_CDP_USER_DATA_DIR || path.join(os.homedir(), ".codex", "browser-profiles", "weex-fin-admin");
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function removeStaleChromeSingletons(userDataDir) {
  const lockPath = path.join(userDataDir, "SingletonLock");
  let lockTarget = "";
  try {
    lockTarget = fs.readlinkSync(lockPath);
  } catch {
    return;
  }
  const pid = Number(String(lockTarget).match(/-(\d+)$/)?.[1] || "");
  if (processExists(pid)) return;
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      fs.rmSync(path.join(userDataDir, name), { force: true });
    } catch {}
  }
}

function cdpPort(cdpUrl) {
  const parsed = new URL(cdpUrl);
  return parsed.port || (parsed.protocol === "https:" ? "443" : "80");
}

export function assertPositiveNumber(value, name) {
  if (!/^\d+(\.\d+)?$/.test(String(value || "")) || Number(value) <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

export function assertUid(value) {
  if (!/^\d{1,19}$/.test(String(value || ""))) {
    throw new Error("uid must be 1-19 digits");
  }
}

async function jsonGet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  return response.json();
}

async function jsonPut(url) {
  const response = await fetch(url, { method: "PUT" });
  if (!response.ok) throw new Error(`PUT ${url} failed with HTTP ${response.status}`);
  return response.json();
}

function cdpBase(cdpUrl) {
  return cdpUrl.replace(/\/$/, "");
}

async function waitForCdp(cdpUrl, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await jsonGet(`${cdpBase(cdpUrl)}/json/version`);
      return true;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error(`CDP endpoint is not available at ${cdpUrl}: ${lastError?.message || "timeout"}`);
}

async function isCdpAvailable(cdpUrl) {
  try {
    await jsonGet(`${cdpBase(cdpUrl)}/json/version`);
    return true;
  } catch {
    return false;
  }
}

function launchChromeForCdp(cdpUrl, env) {
  const executable = env.WEEX_FIN_CHROME_EXECUTABLE || DEFAULT_CHROME_EXECUTABLE;
  const userDataDir = defaultUserDataDir(env);
  removeStaleChromeSingletons(userDataDir);
  const chromeArgs = [
    `--remote-debugging-port=${cdpPort(cdpUrl)}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (env.WEEX_FIN_CDP_HEADLESS !== "false") {
    chromeArgs.push("--headless=new", "--disable-gpu");
  } else {
    chromeArgs.push("--new-window");
  }
  chromeArgs.push(defaultFinPageUrl(env));
  const command = process.platform === "darwin" && env.WEEX_FIN_CDP_HEADLESS === "false"
    ? "open"
    : executable;
  const args = process.platform === "darwin" && env.WEEX_FIN_CDP_HEADLESS === "false"
    ? ["-na", "Google Chrome", "--args", ...chromeArgs]
    : chromeArgs;
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function ensureCdpAvailable(cdpUrl, env) {
  if (await isCdpAvailable(cdpUrl)) return false;
  if (env.WEEX_FIN_CDP_AUTO_LAUNCH === "false") {
    throw new Error(`CDP endpoint is not available at ${cdpUrl}. Start Chrome with remote debugging or set WEEX_FIN_CDP_AUTO_LAUNCH=true.`);
  }
  launchChromeForCdp(cdpUrl, env);
  await waitForCdp(cdpUrl);
  return true;
}

async function cdpSend(webSocketUrl, method, params = {}) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP websocket connection failed")), { once: true });
  });
  try {
    socket.send(JSON.stringify({ id: 1, method, params }));
    return await new Promise((resolve, reject) => {
      socket.addEventListener("message", event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
      }, { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP websocket connection failed")), { once: true });
    });
  } finally {
    socket.close();
  }
}

export async function closeCdpBrowser(cdpUrl) {
  if (!await isCdpAvailable(cdpUrl)) return false;
  const version = await jsonGet(`${cdpBase(cdpUrl)}/json/version`);
  if (!version.webSocketDebuggerUrl) return false;
  await cdpSend(version.webSocketDebuggerUrl, "Browser.close");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!await isCdpAvailable(cdpUrl)) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return true;
}

async function openFinTarget(cdpUrl, env) {
  const url = encodeURIComponent(defaultFinPageUrl(env));
  return jsonPut(`${cdpBase(cdpUrl)}/json/new?${url}`);
}

export async function openVisibleFinLoginPage(cdpUrl, env = process.env, timeoutMs = 20000) {
  env.WEEX_FIN_CDP_HEADLESS = "false";
  env.WEEX_FIN_ALLOW_OPEN_TARGET = "true";
  if (await isCdpAvailable(cdpUrl)) {
    const version = await jsonGet(`${cdpBase(cdpUrl)}/json/version`).catch(() => null);
    if (String(version?.["User-Agent"] || "").includes("HeadlessChrome")) {
      await closeCdpBrowser(cdpUrl).catch(() => false);
    }
  }

  const launched = await ensureCdpAvailable(cdpUrl, env);
  let openedTarget = null;
  if (!launched) {
    openedTarget = await openFinTarget(cdpUrl, env);
  }

  const deadline = Date.now() + timeoutMs;
  let targets = [];
  while (Date.now() < deadline) {
    targets = await jsonGet(`${cdpBase(cdpUrl)}/json/list`);
    const target = targets.find(item =>
      item.type === "page"
      && item.url?.includes(FIN_HOST_MARKER)
      && (!openedTarget?.id || item.id === openedTarget.id)
    ) || targets.find(item => item.type === "page" && item.url?.includes(FIN_HOST_MARKER));
    if (target?.webSocketDebuggerUrl) {
      return {
        targetId: target.id,
        url: target.url,
        title: target.title,
        cdpUrl,
      };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const pageUrls = targets
    .filter(item => item.type === "page")
    .map(item => item.url || "about:blank")
    .slice(0, 5);
  throw new Error(`FIN login recovery did not open a FIN Admin CDP page target. Observed page targets: ${pageUrls.join(", ") || "<none>"}`);
}

export async function waitForFinPageClose(cdpUrl, timeoutMs = 0) {
  const started = Date.now();
  while (true) {
    const targets = await jsonGet(`${cdpBase(cdpUrl)}/json/list`).catch(() => []);
    const openFinTargets = targets.filter(item => item.type === "page" && item.url?.includes(FIN_HOST_MARKER));
    if (openFinTargets.length === 0) return true;
    if (timeoutMs && Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for FIN Admin page to close");
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function checkFinBase(auth) {
  const response = await postFin(auth, `/admin/fin/asset/adjust/listSystemType/${DEFAULT_BIZ_TYPE}`);
  assertBusinessOk(response, "FIN base listSystemType");
}

export async function ensureFinAuthReady(cdpUrl, env = process.env, options = {}) {
  try {
    const auth = await readFinAuth(cdpUrl, env);
    await checkFinBase(auth);
    return { auth, recovered: false, loginPage: null };
  } catch (firstError) {
    if (options.recover === false) throw firstError;
    await closeCdpBrowser(cdpUrl).catch(() => false);
    env.WEEX_FIN_CDP_HEADLESS = "false";
    env.WEEX_FIN_ALLOW_OPEN_TARGET = "true";
    const loginPage = await openVisibleFinLoginPage(cdpUrl, env, options.openTimeoutMs || 20000);
    if (typeof options.onRecoveryPage === "function") options.onRecoveryPage(loginPage);
    await waitForFinPageClose(cdpUrl, options.closeTimeoutMs || 0);
    env.WEEX_FIN_CDP_HEADLESS = "true";
    delete env.WEEX_FIN_ALLOW_OPEN_TARGET;
    const auth = await readFinAuth(cdpUrl, env);
    await checkFinBase(auth);
    return { auth, recovered: true, loginPage };
  }
}

async function listPageTargets(cdpUrl, env) {
  await ensureCdpAvailable(cdpUrl, env);
  return jsonGet(`${cdpBase(cdpUrl)}/json/list`);
}

async function findFinTarget(cdpUrl, env) {
  await ensureCdpAvailable(cdpUrl, env);
  let targets = await jsonGet(`${cdpBase(cdpUrl)}/json/list`);
  let target = targets.find(item => item.type === "page" && item.url?.includes(FIN_HOST_MARKER));
  if (!target) {
    if (env.WEEX_FIN_ALLOW_OPEN_TARGET !== "true") {
      throw new Error(`No existing FIN Admin CDP page target found at ${cdpUrl}; automatic FIN target opening is disabled.`);
    }
    await openFinTarget(cdpUrl, env);
    await new Promise(resolve => setTimeout(resolve, 1000));
    targets = await jsonGet(`${cdpBase(cdpUrl)}/json/list`);
    target = targets.find(item => item.type === "page" && item.url?.includes(FIN_HOST_MARKER));
  }
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`No FIN Admin CDP page target found at ${cdpUrl}. Keep Chrome running and log in to ${defaultFinPageUrl(env)} once.`);
  }
  return target;
}

async function cdpEvaluate(webSocketUrl, expression) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP websocket connection failed")), { once: true });
  });

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  function send(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  try {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description
        || result.exceptionDetails.exception?.value
        || result.exceptionDetails.text
        || "CDP Runtime.evaluate failed";
      throw new Error(String(detail).split("\n")[0]);
    }
    return result.result?.value;
  } finally {
    socket.close();
  }
}

export async function readFinAuth(cdpUrl, env = process.env) {
  const existingTarget = await findExistingFinTarget(cdpUrl);
  if (!existingTarget) {
    const profileAuth = readFinAuthFromProfile(env);
    if (profileAuth?.tokenPresent) return profileAuth;
  }
  const firstTarget = existingTarget || await findFinTarget(cdpUrl, env);
  const deadline = Date.now() + 45000;
  let state;
  do {
    const targets = (await listExistingPageTargets(cdpUrl, env))
      .filter(item => item.type === "page" && item.webSocketDebuggerUrl && item.url?.includes(FIN_HOST_MARKER));
    if (!targets.length && firstTarget) targets.push(firstTarget);
    for (const target of targets) {
      state = await cdpEvaluate(target.webSocketDebuggerUrl, `(() => {
        let storage;
        try {
          storage = localStorage;
        } catch (error) {
          return {
            url: location.href,
            title: document.title,
            tokenPresent: false,
            storageReadable: false,
            storageError: error.name || "StorageError",
          };
        }
        const config = JSON.parse(storage.getItem("admin-web-fin-system-config") || "{}");
        let fingerprint = "";
        try { fingerprint = JSON.parse(storage.getItem("tempFingerprint") || "{}").value || ""; } catch {}
        return {
          url: location.href,
          title: document.title,
          tokenPresent: !!storage.getItem("token"),
          token: storage.getItem("token") || "",
          backendLanguage: config.backend_language || "zh-CN",
          fingerprint,
          storageReadable: true,
        };
      })()`);
      if (state?.storageReadable && state?.url?.includes(FIN_HOST_MARKER) && state?.tokenPresent) return state;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  if (!state?.storageReadable) throw new Error(`Current FIN Admin CDP page storage is not readable at ${state?.url || "unknown URL"}. Close this page after login handling, then rerun the script.`);
  if (!state?.url?.includes(FIN_HOST_MARKER)) throw new Error(`Current FIN Admin CDP page did not finish loading FIN host. Current URL: ${state?.url || "unknown URL"}.`);
  if (!state?.tokenPresent) throw new Error("Current FIN Admin CDP page has no localStorage token. Log in once in the visible persistent CDP Chrome, close the FIN page when done, then rerun the script. Later runs should read auth from the persistent Chrome profile without reopening a FIN tab when possible.");
  return state;
}

async function findExistingFinTarget(cdpUrl) {
  if (!await isCdpAvailable(cdpUrl)) return null;
  const targets = await jsonGet(`${cdpBase(cdpUrl)}/json/list`);
  return targets.find(item => item.type === "page" && item.webSocketDebuggerUrl && item.url?.includes(FIN_HOST_MARKER)) || null;
}

async function listExistingPageTargets(cdpUrl, env) {
  if (await isCdpAvailable(cdpUrl)) return jsonGet(`${cdpBase(cdpUrl)}/json/list`);
  if (env.WEEX_FIN_CDP_AUTO_LAUNCH === "false") return [];
  return [];
}

function readFinAuthFromProfile(env = process.env) {
  const leveldbDir = path.join(defaultUserDataDir(env), "Default", "Local Storage", "leveldb");
  if (!fs.existsSync(leveldbDir)) return null;
  const entries = fs.readdirSync(leveldbDir)
    .filter(name => /\.(log|ldb)$/.test(name))
    .map(name => {
      const filePath = path.join(leveldbDir, name);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
  const values = {};
  for (const entry of entries) {
    const bytes = fs.readFileSync(entry.filePath);
    for (const key of ["admin-web-fin-system-config", "tempFingerprint"]) {
      const json = extractLatestJsonLocalStorageValue(bytes, key);
      if (json) values[key] = json;
    }
    const token = extractLatestTokenLocalStorageValue(bytes);
    if (token) values.token = token;
  }
  if (!values.token) return null;
  let config = {};
  let fingerprint = "";
  try { config = JSON.parse(values["admin-web-fin-system-config"] || "{}"); } catch {}
  try { fingerprint = JSON.parse(values.tempFingerprint || "{}").value || ""; } catch {}
  return {
    url: defaultFinPageUrl(env),
    title: "FIN Admin",
    tokenPresent: true,
    token: values.token,
    backendLanguage: config.backend_language || config.language || "zh-CN",
    fingerprint,
    storageReadable: true,
    authSource: "profile-local-storage",
  };
}

function markerForKey(key) {
  return Buffer.from(`_${FIN_ORIGIN}\x00\x01${key}`, "latin1");
}

function extractLatestJsonLocalStorageValue(bytes, key) {
  const marker = markerForKey(key);
  let offset = -1;
  let latest = "";
  while ((offset = bytes.indexOf(marker, offset + 1)) >= 0) {
    const text = bytes.subarray(offset + marker.length, Math.min(bytes.length, offset + marker.length + 4000)).toString("latin1");
    const json = firstJsonObject(text);
    if (json) latest = json;
  }
  return latest;
}

function extractLatestTokenLocalStorageValue(bytes) {
  const marker = markerForKey("token");
  let offset = -1;
  let latest = "";
  while ((offset = bytes.indexOf(marker, offset + 1)) >= 0) {
    const tail = bytes.subarray(offset + marker.length, Math.min(bytes.length, offset + marker.length + 512));
    const token = firstPrintableRun(tail, 40);
    if (token) latest = token;
  }
  return latest;
}

function firstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escape) {
      escape = false;
    } else if (char === "\\") {
      escape = true;
    } else if (char === "\"") {
      inString = !inString;
    } else if (!inString && char === "{") {
      depth += 1;
    } else if (!inString && char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

function firstPrintableRun(bytes, minLength) {
  let run = "";
  for (const byte of bytes) {
    if (byte >= 33 && byte <= 126) {
      run += String.fromCharCode(byte);
    } else if (run.length >= minLength) {
      return run;
    } else {
      run = "";
    }
  }
  return run.length >= minLength ? run : "";
}

function finHeaders(auth) {
  const headers = {
    "content-type": "application/json;charset=UTF-8",
    "U-TOKEN": auth.token,
    "Accept-Language": auth.backendLanguage || "zh-CN",
  };
  if (auth.fingerprint) headers.fingerprint = auth.fingerprint;
  return headers;
}

export async function postFin(auth, path, body = {}) {
  const response = await fetch(`${FIN_API_BASE}${path}`, {
    method: "POST",
    headers: finHeaders(auth),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 300) };
  }
  return {
    httpStatus: response.status,
    code: payload.code,
    msg: payload.message || payload.msg || "",
    data: payload.data,
  };
}

export function assertBusinessOk(response, stage) {
  if (response.httpStatus !== 200 || response.code !== 200) {
    throw new Error(`${stage} failed: HTTP ${response.httpStatus}, code ${response.code}, msg ${response.msg || ""}`);
  }
}

function chooseCurrency(detail, currencyName) {
  const coin = detail.supportCoins?.find(item => String(item.coinName).toUpperCase() === String(currencyName).toUpperCase());
  if (!coin) throw new Error(`Currency not supported by bizType ${DEFAULT_BIZ_TYPE}: ${currencyName}`);
  return { coinId: Number(coin.coinId), coinName: coin.coinName };
}

function chooseSubBiz(detail, subBizType) {
  const option = detail.subBizTypeList?.find(item => item.bizTypeCode === subBizType || item.bizTypeName === subBizType);
  if (!option) throw new Error(`Sub business type not supported: ${subBizType}`);
  return {
    subBizType: option.bizTypeCode,
    subBizTypeName: option.bizTypeName,
    systemUserId: option.opponentUserId ? String(option.opponentUserId) : "",
  };
}

function chooseAuditType(remarks, requested) {
  const sorted = [...(remarks || [])].sort((a, b) => String(a.showCode).localeCompare(String(b.showCode), undefined, { numeric: true }));
  const option = requested
    ? sorted.find(item => item.showCode === requested || item.showName === requested)
    : sorted[0];
  if (!option) throw new Error(`No enabled audit type matched: ${requested || "<first>"}`);
  return { value: option.showCode, label: option.showName };
}

export async function discoverFinGrantConfig(auth, args) {
  const [detailRes, remarkRes] = await Promise.all([
    postFin(auth, `/admin/fin/asset/adjust/listSystemType/${DEFAULT_BIZ_TYPE}`),
    postFin(auth, "/admin/fin/asset/remarkSubCategory/list", { status: 1 }),
  ]);
  assertBusinessOk(detailRes, "listSystemType");
  assertBusinessOk(remarkRes, "remarkSubCategory/list");
  return {
    detail: detailRes.data,
    currency: chooseCurrency(detailRes.data, args.currency || DEFAULT_CURRENCY),
    subBiz: chooseSubBiz(detailRes.data, args.subBizType || DEFAULT_SUB_BIZ_TYPE),
    auditType: chooseAuditType(remarkRes.data, args.auditType),
  };
}

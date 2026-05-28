import { loginToPrizePage, sleep } from "./browser.mjs";

export async function createAdminApiSession({ chromium, config, requireApiLogin = false } = {}) {
  const apiLogin = await tryLoginByApi(config).catch(() => ({ ok: false, reason: "exception" }));
  if (apiLogin?.ok && apiLogin.authorization) {
    const authHeader = apiLogin.authorization;
    return {
      mode: "headless_api_login",
      authorization: authHeader,
      close: async () => {},
      get: path => apiRequestNode(config.baseUrl, authHeader, "GET", path),
      post: (path, body) => apiRequestNode(config.baseUrl, authHeader, "POST", path, body),
      put: (path, body) => apiRequestNode(config.baseUrl, authHeader, "PUT", path, body),
      delete: path => apiRequestNode(config.baseUrl, authHeader, "DELETE", path),
    };
  }

  if (requireApiLogin) {
    throw new Error(`Admin API login failed: ${apiLogin?.reason || "unknown"}`);
  }
  if (!chromium) {
    throw new Error("createAdminApiSession requires chromium when API login is unavailable");
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let authHeader = "";
  page.on("request", request => {
    const url = request.url();
    if (url.includes("/prod-api/")) authHeader = request.headers().authorization || authHeader;
  });
  await loginToPrizePage(page, config);
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await page.locator("button:visible").filter({ hasText: "搜索" }).first().click().catch(() => {});
  await sleep(1000);
  if (!authHeader) throw new Error("Failed to capture admin Authorization header");
  return {
    page,
    authorization: authHeader,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
    get: path => apiRequest(page, authHeader, "GET", path),
    post: (path, body) => apiRequest(page, authHeader, "POST", path, body),
    put: (path, body) => apiRequest(page, authHeader, "PUT", path, body),
    delete: path => apiRequest(page, authHeader, "DELETE", path),
  };
}

async function apiRequest(page, authHeader, method, path, body = null) {
  return page.evaluate(async ({ authHeader, method, path, body }) => {
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body === null ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      ...(body === null ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, method, path, body });
}

async function apiRequestNode(baseUrl, authHeader, method, requestPath, body = null) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const url = String(requestPath || "").startsWith("http")
    ? String(requestPath)
    : `${base}${String(requestPath || "").startsWith("/") ? "" : "/"}${String(requestPath || "")}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      ...(body === null ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: response.status, body: parsed };
}

async function tryLoginByApi(config) {
  const base = String(config?.baseUrl || "").replace(/\/+$/, "");
  if (!base) return { ok: false, reason: "missing_base_url" };
  if (!config?.username || !config?.password || !config?.googleCode) return { ok: false, reason: "missing_credentials" };

  const captchaResponse = await fetch(`${base}/prod-api/captchaImage`, { method: "GET" }).catch(() => null);
  if (!captchaResponse) return { ok: false, reason: "captcha_fetch_failed" };
  const captchaBody = await captchaResponse.json().catch(() => null);
  if (captchaBody?.captchaEnabled === true) return { ok: false, reason: "captcha_enabled" };

  const loginResponse = await fetch(`${base}/prod-api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
      code: "",
      uuid: "",
      totp: config.googleCode,
    }),
  }).catch(() => null);
  if (!loginResponse) return { ok: false, reason: "login_fetch_failed" };
  const loginBody = await loginResponse.json().catch(() => null);
  const token = loginBody?.token || loginBody?.data?.token || "";
  if (!(Number(loginBody?.code || loginBody?.data?.code || 0) === 200 && token)) {
    return { ok: false, reason: "login_failed" };
  }
  const authorization = String(token).startsWith("Bearer ") ? String(token) : `Bearer ${token}`;
  return { ok: true, authorization };
}

export function stripCloneFields(value) {
  const cloned = JSON.parse(JSON.stringify(value || {}));
  for (const key of [
    "id",
    "activityId",
    "hisId",
    "status",
    "operator",
    "createTime",
    "updateTime",
    "onLineUsed",
    "createdBy",
    "updatedBy",
  ]) {
    if (key in cloned) delete cloned[key];
  }
  return cloned;
}

export function buildSuffix() {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export function firstRow(response) {
  return response?.body?.rows?.[0] || response?.body?.data?.[0] || null;
}

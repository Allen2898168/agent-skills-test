import { resolveAdminRestorePath, shouldRestoreAdminSession } from "./admin-session.mjs";

export async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
}

async function loginToPath(page, config, path) {
  let lastLoginResponse = null;
  const captchaState = { observed: false, enabled: null };
  const captchaResponse = page.waitForResponse(async response => {
    if (!response.url().includes("/prod-api/captchaImage")) return false;
    captchaState.observed = true;
    try {
      const body = await response.json();
      captchaState.enabled = body?.captchaEnabled === true;
    } catch {
      captchaState.enabled = null;
    }
    return true;
  }, { timeout: 8000 }).catch(() => {});
  await page.goto(`${config.baseUrl}/login?redirect=${encodeURIComponent(path)}`, { waitUntil: "domcontentloaded" });
  await captchaResponse;
  await page.locator('input[placeholder="账号"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  await page.locator('input[placeholder="密码"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  await page.locator('input[placeholder="谷歌验证码"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  if (captchaState.enabled === false) {
    await waitForOrdinaryCaptchaHidden(page, 12000).catch(() => {});
  }
  if (!(await page.locator('input[placeholder="账号"]').count())) return;
  const ordinaryCaptchaVisible = await hasVisibleOrdinaryCaptcha(page);
  if (captchaState.enabled === true && ordinaryCaptchaVisible) {
    throw new Error("Ordinary captcha is enabled and visible. This login flow needs ordinary captcha handling before filling the Google code.");
  }
  await page.locator('input[placeholder="账号"]').fill(config.username);
  await page.locator('input[placeholder="密码"]').fill(config.password);
  await page.locator('input[placeholder="谷歌验证码"]').fill(config.googleCode);
  let loginResponse = page.waitForResponse(response => (
    response.url().includes("/prod-api/login") && response.request().method() === "POST"
  ), { timeout: 12000 }).catch(() => null);
  await clickLoginButton(page);
  lastLoginResponse = await loginResponse;
  if (!lastLoginResponse) {
    loginResponse = page.waitForResponse(response => (
      response.url().includes("/prod-api/login") && response.request().method() === "POST"
    ), { timeout: 12000 }).catch(() => null);
    await clickLoginButton(page);
    lastLoginResponse = await loginResponse;
  }
  if (lastLoginResponse) {
    const promoted = await promoteLoginTokenToCookie(page, lastLoginResponse, path);
    if (promoted) return;
  }
  await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 18000 }).catch(() => {});
  await sleep(3000);
  if (page.url().includes("/login")) {
    const promoted = await promoteLoginTokenToCookie(page, lastLoginResponse, path);
    if (promoted) return;
    const retried = await retryLoginOnce(page, config, path, lastLoginResponse);
    if (!retried.ok) throw new Error(retried.error);
    return;
  }
  if (page.url().includes("/user/profile")) throw new Error(`Redirected to profile page: ${page.url()}`);
}

export async function ensureAdminSession(page, config, path) {
  const dialogText = await page.locator(".el-message-box:visible, .el-message-box__wrapper:visible").last().innerText({ timeout: 1200 }).catch(() => "");
  if (!shouldRestoreAdminSession({ currentUrl: page.url(), dialogText })) return false;
  await loginToPath(page, config, path);
  return true;
}

export async function ensureAdminSessionForCurrentPage(page, config, fallbackPath = "/") {
  const restorePath = resolveAdminRestorePath(page.url(), fallbackPath);
  return ensureAdminSession(page, config, restorePath);
}

async function waitForOrdinaryCaptchaHidden(page, timeout) {
  await page.waitForFunction(() => ![...document.querySelectorAll("input")]
    .some(input => {
      const rect = input.getBoundingClientRect();
      return input.getAttribute("placeholder") === "验证码" && rect.width > 0 && rect.height > 0;
    }), null, { timeout });
}

async function hasVisibleOrdinaryCaptcha(page) {
  return page.evaluate(() => [...document.querySelectorAll("input")]
    .some(input => {
      const rect = input.getBoundingClientRect();
      return input.getAttribute("placeholder") === "验证码" && rect.width > 0 && rect.height > 0;
    })).catch(() => false);
}

async function clickLoginButton(page) {
  const clicked = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const button = [...document.querySelectorAll("button")]
      .filter(visible)
      .find(item => (item.innerText || "").includes("登"));
    if (!button) return false;
    button.click();
    return true;
  }).catch(() => false);
  if (!clicked) await page.locator('button:has-text("登")').first().click({ force: true });
}

async function retryLoginOnce(page, config, path, previousResponse) {
  const previousBody = redactSensitive(await safeJson(previousResponse));
  const previousText = await bodyText(page);
  await page.goto(`${config.baseUrl}/login?redirect=${encodeURIComponent(path)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[placeholder="账号"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  await page.locator('input[placeholder="密码"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  await page.locator('input[placeholder="谷歌验证码"]').waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  await page.locator('input[placeholder="账号"]').fill(config.username);
  await page.locator('input[placeholder="密码"]').fill(config.password);
  await page.locator('input[placeholder="谷歌验证码"]').fill(config.googleCode);
  const loginResponse = page.waitForResponse(response => (
    response.url().includes("/prod-api/login") && response.request().method() === "POST"
  ), { timeout: 12000 }).catch(() => null);
  await clickLoginButton(page);
  const retriedResponse = await loginResponse;
  await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 18000 }).catch(() => {});
  await sleep(3000);
  if (page.url().includes("/login")) {
    const promoted = await promoteLoginTokenToCookie(page, retriedResponse, path);
    if (promoted) return { ok: true };
    const retriedBody = redactSensitive(await safeJson(retriedResponse));
    const currentText = await bodyText(page);
    return {
      ok: false,
      error: `Login did not leave login page after retry: ${JSON.stringify({
        previousBody,
        retriedBody,
        previousText: String(previousText).slice(0, 200),
        currentText: String(currentText).slice(0, 200),
      })}`,
    };
  }
  if (page.url().includes("/user/profile")) {
    return { ok: false, error: `Redirected to profile page after retry: ${page.url()}` };
  }
  return { ok: true };
}

async function safeJson(response) {
  if (!response) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function redactSensitive(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => {
    if (/token|cookie|authorization|password|pwd|code/i.test(key)) return [key, "<redacted>"];
    if (entryValue && typeof entryValue === "object") return [key, redactSensitive(entryValue)];
    return [key, entryValue];
  }));
}

async function promoteLoginTokenToCookie(page, response, path) {
  const body = await safeJson(response);
  const token = body?.token || body?.data?.token || "";
  const code = Number(body?.code || body?.data?.code || 0);
  if (!(code === 200 && token)) return false;
  const currentUrl = new URL(page.url());
  await page.context().addCookies([{
    name: "Admin-Token",
    value: String(token),
    domain: currentUrl.hostname,
    path: "/",
    httpOnly: false,
    secure: currentUrl.protocol === "https:",
    sameSite: "Lax",
  }]);
  await page.evaluate(value => {
    try {
      const raw = String(value);
      const bearer = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
      for (const key of ["token", "Token", "Admin-Token", "admin-token", "authorization", "Authorization"]) {
        const normalizedKey = String(key).toLowerCase();
        const storedValue = normalizedKey.includes("authorization") ? bearer : raw;
        window.localStorage?.setItem?.(key, storedValue);
        window.sessionStorage?.setItem?.(key, storedValue);
      }
    } catch {}
  }, String(token)).catch(() => {});
  await page.goto(`${currentUrl.origin}${path}`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  return !page.url().includes("/login");
}

export async function loginToPrizePage(page, config) {
  await loginToPath(page, config, "/activity/prize");
}

export async function loginToTaskPage(page, config) {
  await loginToPath(page, config, "/activity/task");
}

export async function loginToRegisterPage(page, config) {
  await loginToPath(page, config, "/activity/register");
}

export async function loginToGuidePage(page, config) {
  await loginToPath(page, config, "/activity/guide");
}

export function watchPrizeResponses(page, responses) {
  page.on("response", response => {
    const url = response.url();
    if (url.includes("/prod-api/activity/prize") || url.includes("/prod-api/common/uploadImgReplace")) {
      responses.push({
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        method: response.request().method(),
        status: response.status(),
      });
    }
  });
}

export function watchTaskResponses(page, responses) {
  page.on("response", response => {
    const url = response.url();
    if (url.includes("/prod-api/activity/task")) {
      responses.push({
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        method: response.request().method(),
        status: response.status(),
      });
    }
  });
}

export function watchRegisterResponses(page, responses) {
  page.on("response", response => {
    const url = response.url();
    if (url.includes("/prod-api/activity/apply")) {
      responses.push({
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        method: response.request().method(),
        status: response.status(),
      });
    }
  });
}

export function watchGuideResponses(page, responses) {
  page.on("response", async response => {
    const url = response.url();
    if (url.includes("/prod-api/activity/guideTemplate")) {
      const entry = {
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        method: response.request().method(),
        status: response.status(),
      };
      try {
        const body = await response.json();
        entry.code = body?.code;
        entry.msg = body?.msg;
      } catch {}
      responses.push(entry);
    }
  });
}

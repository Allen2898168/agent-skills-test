export async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
}

async function loginToPath(page, config, path) {
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
  if (!(await loginResponse)) {
    loginResponse = page.waitForResponse(response => (
      response.url().includes("/prod-api/login") && response.request().method() === "POST"
    ), { timeout: 12000 }).catch(() => null);
    await clickLoginButton(page);
    await loginResponse;
  }
  await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 18000 }).catch(() => {});
  await sleep(3000);
  if (page.url().includes("/login")) throw new Error("Login did not leave login page");
  if (page.url().includes("/user/profile")) throw new Error(`Redirected to profile page: ${page.url()}`);
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

export async function loginToPrizePage(page, config) {
  await loginToPath(page, config, "/activity/prize");
}

export async function loginToTaskPage(page, config) {
  await loginToPath(page, config, "/activity/task");
}

export async function loginToRegisterPage(page, config) {
  await loginToPath(page, config, "/activity/register");
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

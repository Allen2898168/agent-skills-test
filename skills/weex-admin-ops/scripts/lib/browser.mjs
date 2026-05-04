export async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function bodyText(page) {
  return page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
}

export async function loginToPrizePage(page, config) {
  await page.goto(`${config.baseUrl}/login?redirect=%2Factivity%2Fprize`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  if (!(await page.locator('input[placeholder="账号"]').count())) return;
  await page.locator('input[placeholder="账号"]').fill(config.username);
  await page.locator('input[placeholder="密码"]').fill(config.password);
  await page.locator('input[placeholder="谷歌验证码"]').fill(config.googleCode);
  const captcha = page.locator('input[placeholder="验证码"]').first();
  if (await captcha.count()) await captcha.fill(config.googleCode);
  await page.locator('button:has-text("登")').first().click();
  await sleep(3000);
  if (page.url().includes("/login")) throw new Error("Login did not leave login page");
  if (page.url().includes("/user/profile")) throw new Error(`Redirected to profile page: ${page.url()}`);
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

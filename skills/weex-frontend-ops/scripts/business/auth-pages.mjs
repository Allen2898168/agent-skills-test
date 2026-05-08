import fs from 'node:fs';
import path from 'node:path';

export function accountUrlFor(targetUrl) {
  return process.env.WEEX_FRONTEND_ACCOUNT_URL || new URL('/zh-CN/account', targetUrl).href;
}

export async function openLoginStatePage(page, targetUrl) {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const body = await page.evaluate(() => document.body.innerText || document.body.textContent || '');
  if (/登录\s*邮箱\/手机号|还没有账户|请输入邮箱|Log\s*in|Sign\s*up/i.test(body) && page.url().includes('/login')) {
    await page.goto(accountUrlFor(targetUrl), {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(8000);
  }
}

export async function captureAuthEvidence(page, screenshotPath, failedResponses, { saveScreenshot = false } = {}) {
  if (saveScreenshot) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  const state = await page.evaluate(() => {
    const body = document.body.innerText || document.body.textContent || '';
    const hasText = (text) => body.includes(text);
    return {
      title: document.title,
      url: location.href,
      cookieNames: document.cookie.split(';').map((item) => item.trim().split('=')[0]).filter(Boolean),
      assertions: {
        accountOverviewVisible: hasText('账号总览'),
        accountSecurityVisible: hasText('账户安全'),
        loginFormAbsent: !/还没有账户|请输入邮箱|登录\s*邮箱\/手机号|Log\s*in|Sign\s*up/i.test(body)
      }
    };
  });
  return {
    screenshot: saveScreenshot ? screenshotPath : null,
    title: state.title,
    url: state.url,
    viewport: 'desktop 1440x1000',
    tokenCookiePresent: state.cookieNames.includes('WEEX_TOKEN_COOKIE_STAGING'),
    assertions: state.assertions,
    failedResponses: failedResponses.slice(-20)
  };
}

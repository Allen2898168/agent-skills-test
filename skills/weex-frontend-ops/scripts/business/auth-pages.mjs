import fs from 'node:fs';
import path from 'node:path';

export function homeUrlFor(targetUrl) {
  return process.env.WEEX_FRONTEND_HOME_URL || new URL('/zh-CN', targetUrl).href;
}

export function accountUrlFor(targetUrl) {
  return process.env.WEEX_FRONTEND_ACCOUNT_URL || new URL('/zh-CN/account', targetUrl).href;
}

async function gotoWithRetries(page, url, options, { attempts = 3, delayMs = 1500 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(url, options);
      return;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      const retryable = [
        'net::ERR_NAME_NOT_RESOLVED',
        'net::ERR_CONNECTION_TIMED_OUT',
        'net::ERR_TIMED_OUT',
        'net::ERR_NETWORK_CHANGED',
        'Navigation timeout',
        'page.goto: Timeout',
        'Timeout',
      ].some((token) => message.includes(token));
      if (!retryable || attempt >= attempts) throw error;
      await page.waitForTimeout(delayMs);
    }
  }
  throw lastError || new Error(`Failed to navigate: ${url}`);
}

export async function openLoginStatePage(page, targetUrl) {
  const homeUrl = homeUrlFor(targetUrl);
  const accountUrl = accountUrlFor(targetUrl);
  await gotoWithRetries(page, accountUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);

  const body = await page.evaluate(() => document.body.innerText || document.body.textContent || '');
  if (/登录\s*邮箱\/手机号|还没有账户|请输入邮箱|Log\s*in|Sign\s*up/i.test(body)) {
    await gotoWithRetries(page, homeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);
    await gotoWithRetries(page, accountUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
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

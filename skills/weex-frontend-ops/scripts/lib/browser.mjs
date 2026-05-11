import { requireProjectDependency } from './dependencies.mjs';

const { chromium } = requireProjectDependency('playwright');

export async function launchBrowser({ visible = false, args = [], executablePath, disableWebSecurity = false } = {}) {
  const launchArgs = [...args];
  if (disableWebSecurity) {
    launchArgs.push('--disable-web-security', '--ignore-certificate-errors');
  }
  const configuredExecutable = executablePath || process.env.WEEX_FRONTEND_CHROME_EXECUTABLE;
  const launchOptions = {
    headless: !visible,
    args: launchArgs
  };
  if (configuredExecutable) {
    launchOptions.executablePath = configuredExecutable;
  } else {
    launchOptions.channel = process.env.WEEX_FRONTEND_BROWSER_CHANNEL || 'chrome';
  }
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  const failedResponses = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() });
    }
  });
  return { browser, context, page, failedResponses };
}

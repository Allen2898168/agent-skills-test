import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

function requirePlaywright() {
  try {
    return require('playwright');
  } catch (firstError) {
    const fallback = '/Users/gabriel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
    if (fs.existsSync(fallback)) return require(fallback);
    const nodePath = process.env.NODE_PATH || '';
    for (const root of nodePath.split(path.delimiter).filter(Boolean)) {
      const candidate = path.join(root, 'playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw firstError;
  }
}

const { chromium } = requirePlaywright();

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

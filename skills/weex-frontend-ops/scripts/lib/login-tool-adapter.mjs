import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encryptFrontendPassword } from './weex-password.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const bundledLoginToolDir = path.resolve(currentDir, '..', '..', 'vendor', 'loginTool');

function candidateLoginToolDirs() {
  return [
    process.env.WEEX_FRONTEND_LOGIN_TOOL_DIR,
    bundledLoginToolDir
  ].filter(Boolean);
}

export function resolveLoginToolDir() {
  for (const dir of candidateLoginToolDirs()) {
    const loginModule = path.join(dir, 'lib', 'weex-login.mjs');
    const cookieModule = path.join(dir, 'lib', 'weex-auth-cookie.mjs');
    if (fs.existsSync(loginModule) && fs.existsSync(cookieModule)) {
      return { dir, loginModule, cookieModule };
    }
  }
  throw new Error(`loginTool not found. Expected bundled copy at ${bundledLoginToolDir}, or set WEEX_FRONTEND_LOGIN_TOOL_DIR to a checkout containing lib/weex-login.mjs and lib/weex-auth-cookie.mjs.`);
}

export async function buildFrontendAuthCookie({ username, password, targetUrl, timeoutMs = 60000 }) {
  if (!username) {
    throw new Error('Frontend account username is required. Configure skills/weex-frontend-ops/.env.local or provide WEEX_FRONTEND_USERNAME.');
  }
  const { loginModule, cookieModule } = resolveLoginToolDir();
  const [{ loginWithWeexAccountDebug }, { buildWeexTokenCookie }] = await Promise.all([
    import(pathToFileURL(loginModule).href),
    import(pathToFileURL(cookieModule).href)
  ]);
  const encryptedPassword = encryptFrontendPassword(password);
  const login = await loginWithWeexAccountDebug(
    { username, password: encryptedPassword },
    { timeoutMs }
  );
  return buildWeexTokenCookie(login.tokens, { targetUrl, httpOnly: false });
}

export async function loginFrontendWithTokens({
  username,
  password,
  gatewayBaseUrl = process.env.WEEX_FRONTEND_LOGIN_GATEWAY_BASE_URL || 'https://stg-gateway.weex.tech',
  timeoutMs = 60000
}) {
  if (!username) {
    throw new Error('Frontend account username is required. Configure skills/weex-frontend-ops/.env.local or provide WEEX_FRONTEND_USERNAME.');
  }
  const { loginModule } = resolveLoginToolDir();
  const { loginWithWeexAccountDebug } = await import(pathToFileURL(loginModule).href);
  const encryptedPassword = encryptFrontendPassword(password);
  const login = await loginWithWeexAccountDebug(
    { username, password: encryptedPassword },
    { gatewayBaseUrl, timeoutMs }
  );
  return {
    gatewayBaseUrl: login.gatewayBaseUrl,
    tokens: login.tokens
  };
}

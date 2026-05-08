import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { encryptFrontendPassword } from './weex-password.mjs';

function candidateLoginToolDirs() {
  return [
    process.env.WEEX_FRONTEND_LOGIN_TOOL_DIR,
    process.env.P2P_LOGIN_TOOL_DIR,
    '/Users/gabriel/Downloads/weexpr/loginTool'
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
  throw new Error('loginTool not found. Set WEEX_FRONTEND_LOGIN_TOOL_DIR to a local loginTool checkout containing lib/weex-login.mjs and lib/weex-auth-cookie.mjs.');
}

export async function buildFrontendAuthCookie({ username, password, targetUrl, timeoutMs = 60000 }) {
  if (!username) {
    throw new Error('Frontend account username is required. Configure .env.local or provide WEEX_FRONTEND_USERNAME.');
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

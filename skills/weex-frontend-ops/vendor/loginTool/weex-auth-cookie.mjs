function requiredUrl(targetUrl) {
  const value = targetUrl == null ? '' : String(targetUrl).trim();
  if (!value) throw new Error('targetUrl 不能为空');
  return value;
}

function isIpHost(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

export function inferCookieDomain(targetUrl) {
  const url = new URL(requiredUrl(targetUrl));
  const hostname = url.hostname;

  if (!hostname || hostname === 'localhost' || isIpHost(hostname)) {
    return hostname;
  }

  if (hostname === 'weex.tech' || hostname.endsWith('.weex.tech')) {
    return '.weex.tech';
  }

  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return `.${parts.slice(-2).join('.')}`;
}

export function buildWeexTokenCookie(tokens, options = {}) {
  const cookieName = options.cookieName || process.env.WEEX_COOKIE_NAME || 'WEEX_TOKEN_COOKIE_STAGING';
  const domain = options.domain || process.env.WEEX_COOKIE_DOMAIN || inferCookieDomain(options.targetUrl);
  const pathValue = options.path || '/';
  const sameSite = options.sameSite || 'Lax';
  const secure = options.secure ?? (options.targetUrl ? new URL(options.targetUrl).protocol === 'https:' : true);
  const httpOnly = options.httpOnly ?? false;
  const expires = options.expires ?? Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60;

  const raw =
    `"bt_uid":"${tokens.userId}",` +
    `"bt_ccToken":"${tokens.accessToken}",` +
    `"bt_ccToken_expire":${tokens.accessTokenExpire},` +
    `"bt_rToken":"${tokens.rtoken}",` +
    `"refresh_token":"${tokens.refreshToken}",` +
    `"refresh_token_expire":${tokens.refreshTokenExpire}`;
  const encoded = encodeURIComponent(raw).replace(/%3A/g, ':');
  const value = `{${encoded}}`;

  return {
    name: cookieName,
    value,
    domain,
    path: pathValue,
    sameSite,
    secure,
    httpOnly,
    expires,
  };
}

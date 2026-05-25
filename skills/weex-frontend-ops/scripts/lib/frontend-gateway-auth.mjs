export function isFrontendGatewayUrl(url) {
  try {
    const { hostname } = new URL(String(url || ""));
    return /^stg-gateway\d*\.weex\.tech$/i.test(hostname);
  } catch {
    return false;
  }
}

export function buildFrontendGatewayHeaders(existingHeaders = {}, accessToken, options = {}) {
  const referer = String(options.referer || "https://stg-www.weex.tech/zh-CN/account");
  const origin = String(options.origin || new URL(referer).origin);
  return {
    ...existingHeaders,
    ...(accessToken ? { "U-Token": String(accessToken) } : {}),
    language: options.language || "zh_CN",
    locale: options.locale || "zh_CN",
    origin,
    referer,
  };
}

export async function installFrontendGatewayAuth(context, accessToken, options = {}) {
  if (!context || !accessToken) return false;
  await context.route(url => isFrontendGatewayUrl(url), async route => {
    await route.continue({
      headers: buildFrontendGatewayHeaders(route.request().headers(), accessToken, options),
    });
  });
  return true;
}

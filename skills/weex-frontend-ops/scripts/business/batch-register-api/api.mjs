export function requirePassword() {
  const password = process.env.WEEX_FRONTEND_COMMON_PASSWORD || process.env.WEEX_FRONTEND_PASSWORD || '';
  if (!password || /^<.*>$/.test(password.trim())) {
    throw new Error('Missing frontend common password. Set WEEX_FRONTEND_COMMON_PASSWORD in skills/weex-frontend-ops/.env.local or WEEX_FRONTEND_* runtime environment.');
  }
  return password;
}

export function gatewayBaseUrl() {
  return process.env.WEEX_FRONTEND_GATEWAY_BASE_URL || 'https://stg-gateway.weex.tech';
}

export async function postJson(pathname, data) {
  const response = await fetch(`${gatewayBaseUrl()}${pathname}`, {
    method: 'POST',
    headers: registerHeaders(),
    body: JSON.stringify(data)
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { httpStatus: response.status, code: body.code, msg: body.msg || body.message || '', data: body.data };
}

function registerHeaders() {
  return {
    appversion: '1.1.0',
    language: 'zh_CN',
    locale: 'zh_CN',
    terminalcode: process.env.WEEX_FRONTEND_TERMINAL_CODE || 'a6bc76f111afa48381a623692ed037d1',
    terminaltype: '1',
    vs: process.env.WEEX_FRONTEND_VS || 'C5h7F5A8m18x099cKPY27gFjxc0MB6uO',
    'x-timestamp': String(Date.now()),
    'content-type': 'application/json;charset=UTF-8',
    'x-sig': process.env.WEEX_FRONTEND_X_SIG || 'b67d692f29e5e274e7d684e335207f5e',
    accept: 'application/json, text/plain, */*',
    'qa-test': 'true',
    test: 'true',
    origin: 'https://stg-www.weex.tech',
    referer: 'https://stg-www.weex.tech/zh-CN/register'
  };
}

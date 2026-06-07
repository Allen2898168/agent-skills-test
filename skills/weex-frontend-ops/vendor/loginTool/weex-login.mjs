import { postJson } from './http.mjs';

function numberOrThrow(value, field) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`字段 ${field} 非数字: ${String(value)}`);
  }
  return numberValue;
}

function stringOrThrow(value, field) {
  const stringValue = value == null ? '' : String(value);
  if (!stringValue) {
    throw new Error(`字段 ${field} 为空`);
  }
  return stringValue;
}

function pickFirst(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key];
  }
  return undefined;
}

export async function loginWithWeexAccountDebug(account, options = {}) {
  const gatewayBaseUrl = options.gatewayBaseUrl || process.env.WEEX_GATEWAY_BASE_URL || 'https://stg-gateway.weex.tech';

  const loginUrl = `${gatewayBaseUrl}/v1/user/login/new`;
  const loginPayload = {
    loginName: account.username,
    pwd: account.password,
    channelName: options.channelName || 'geetest',
    languageType: options.languageType ?? 1,
    authResult: { result: true },
  };

  const defaultLoginHeaders = {
    appversion: '1.1.0',
    language: 'zh_CN',
    locale: 'zh_CN',
    terminalcode: 'a6bc76f111afa48381a623692ed037d1',
    terminaltype: '1',
    vs: 'C5h7F5A8m18x099cKPY27gFjxc0MB6uO',
    'x-timestamp': '1767816938865',
    'content-type': 'application/json;charset=UTF-8',
    'x-sig': 'b67d692f29e5e274e7d684e335207f5e',
    accept: 'application/json, text/plain, */*',
    'qa-test': 'true',
    test: 'true',
  };

  const loginResponse = await postJson(loginUrl, loginPayload, {
    headers: {
      ...defaultLoginHeaders,
      ...(options.buildLoginNewHeaders ? options.buildLoginNewHeaders() : {}),
    },
    timeoutMs: options.timeoutMs,
  });

  const loginData = loginResponse.data;
  const loginCode = pickFirst(loginData, ['code']);
  const loginMessage = pickFirst(loginData, ['msg', 'message']);
  const initialAccessToken =
    pickFirst(loginData?.data, ['accessToken']) ??
    pickFirst(loginData, ['accessToken']);

  if (loginCode != null && String(loginCode) !== '00000') {
    const error = new Error(`login/new 业务失败 code=${String(loginCode)} msg=${String(loginMessage || '')}`);
    error.stage = 'login/new';
    error.response = loginResponse;
    throw error;
  }

  const accessToken = stringOrThrow(initialAccessToken, 'login/new.data.accessToken');

  const verifyUrl = `${gatewayBaseUrl}/v1/user/login/verify-login`;
  const verifyCode = options.verifyCode || process.env.WEEX_VERIFY_CODE || '888888';
  const emailCode = options.emailCode || process.env.WEEX_EMAIL_CODE || '888888';
  const verifyKey =
    options.verifyKey ||
    process.env.WEEX_VERIFY_KEY ||
    'dtZlM2/QKkUkLOUbJHoGgG47VTML1cSLaykL3oWF/Nx7eNn+Uot9Njuy7GfrR9S7w8/iIBfHP7KejR9b+1vg2+Mlwp67lS6QlIg5goN9izI=';
  const emailCodeKey =
    options.emailCodeKey ||
    process.env.WEEX_EMAIL_CODE_KEY ||
    verifyKey;
  const terminalCode =
    options.terminalCode ||
    process.env.WEEX_TERMINAL_CODE ||
    '018ab4ec08e67c547e1cc5e3864c3bf9';

  const verifyPayload = {
    accessToken,
    verifyCode,
    verifyKey,
    verifyType: 3,
    emailCode,
    emailCodeKey,
    terminalCode,
    languageType: options.languageType ?? 1,
  };

  const defaultVerifyHeaders = {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    appversion: '1.1.0',
    'content-type': 'application/json;charset=UTF-8',
    terminalcode: 'a6bc76f111afa48381a623692ed037d1',
    'u-token': accessToken,
    vs: 'z5Q7nu3835cWVJ9lsP887sz8EgM4H6US',
    'x-sig': 'b8786dd55bb593ed6872b9ad927db79d',
    'x-timestamp': '1767816944735',
    'qa-test': 'true',
    test: 'true',
  };

  const verifyResponse = await postJson(verifyUrl, verifyPayload, {
    headers: {
      ...defaultVerifyHeaders,
      ...(options.buildVerifyLoginHeaders ? options.buildVerifyLoginHeaders(accessToken) : {}),
    },
    timeoutMs: options.timeoutMs,
  });

  const verifyData = verifyResponse.data;
  const verifyCodeValue = pickFirst(verifyData, ['code']);
  const verifyMessage = pickFirst(verifyData, ['msg', 'message']);

  if (verifyCodeValue != null && String(verifyCodeValue) !== '00000') {
    const error = new Error(`verify-login 业务失败 code=${String(verifyCodeValue)} msg=${String(verifyMessage || '')}`);
    error.stage = 'verify-login';
    error.response = verifyResponse;
    throw error;
  }

  const data = verifyData?.data || verifyData;
  const tokens = {
    accessToken: stringOrThrow(pickFirst(data, ['accessToken']), 'verify-login.data.accessToken'),
    accessTokenExpire: numberOrThrow(pickFirst(data, ['accessTokenExpire', 'accessToken_expire']), 'verify-login.data.accessTokenExpire'),
    rtoken: stringOrThrow(pickFirst(data, ['rtoken', 'rToken', 'bt_rToken']), 'verify-login.data.rtoken'),
    refreshToken: stringOrThrow(pickFirst(data, ['refreshToken', 'refresh_token']), 'verify-login.data.refreshToken'),
    refreshTokenExpire: numberOrThrow(pickFirst(data, ['refreshTokenExpire', 'refresh_token_expire']), 'verify-login.data.refreshTokenExpire'),
    userId: stringOrThrow(
      pickFirst(data?.userInfo, ['userId', 'uid']) ?? pickFirst(data, ['userId', 'uid']),
      'verify-login.data.userInfo.userId',
    ),
  };

  return {
    gatewayBaseUrl,
    loginUrl,
    verifyUrl,
    loginPayload,
    verifyPayload,
    loginResponse,
    verifyResponse,
    tokens,
  };
}

export async function postJson(url, data, options = {}) {
  const headers = options.headers || {};
  const timeoutMs = options.timeoutMs;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs
    ? setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: controller?.signal,
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: parsed,
    };
  } catch (error) {
    const message = error?.message || String(error);
    throw new Error(`fetch 请求异常: ${message}\nurl=${url}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

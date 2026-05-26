import { loginToPrizePage, sleep } from "./browser.mjs";

export async function createAdminApiSession({ chromium, config }) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: config.chromePath,
    args: ["--window-size=1440,1000"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  let authHeader = "";
  page.on("request", request => {
    const url = request.url();
    if (url.includes("/prod-api/")) authHeader = request.headers().authorization || authHeader;
  });
  await loginToPrizePage(page, config);
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await page.locator("button:visible").filter({ hasText: "搜索" }).first().click().catch(() => {});
  await sleep(1000);
  if (!authHeader) throw new Error("Failed to capture admin Authorization header");
  return {
    page,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
    get: path => apiRequest(page, authHeader, "GET", path),
    post: (path, body) => apiRequest(page, authHeader, "POST", path, body),
    put: (path, body) => apiRequest(page, authHeader, "PUT", path, body),
    delete: path => apiRequest(page, authHeader, "DELETE", path),
  };
}

async function apiRequest(page, authHeader, method, path, body = null) {
  return page.evaluate(async ({ authHeader, method, path, body }) => {
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body === null ? {} : { "Content-Type": "application/json" }),
      },
      credentials: "include",
      ...(body === null ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { authHeader, method, path, body });
}

export function stripCloneFields(value) {
  const cloned = JSON.parse(JSON.stringify(value || {}));
  for (const key of [
    "id",
    "activityId",
    "hisId",
    "status",
    "operator",
    "createTime",
    "updateTime",
    "onLineUsed",
    "createdBy",
    "updatedBy",
  ]) {
    if (key in cloned) delete cloned[key];
  }
  return cloned;
}

export function buildSuffix() {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export function firstRow(response) {
  return response?.body?.rows?.[0] || response?.body?.data?.[0] || null;
}

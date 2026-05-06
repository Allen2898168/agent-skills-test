import { sleep } from "../../lib/browser.mjs";
import { clickButton, fillInputByPlaceholder } from "../../lib/element-ui.mjs";

export async function deleteRegisterTemplatesByOperator(page, config, options) {
  const operator = options.operator || "auto";
  const pageSize = Number(options.pageSize || 200);
  const headers = await captureRegisterListHeaders(page, config, operator);
  const before = await listByOperator(page, config, headers, operator, pageSize);
  const candidates = before.rows.filter(row => row.operator === operator);
  const skipped = before.rows.filter(row => row.operator !== operator);
  if (options.dryRun) {
    return {
      dryRun: true,
      operator,
      beforeTotal: before.total,
      targetCount: candidates.length,
      skipped,
      candidates,
    };
  }
  if (!options.confirmDelete) {
    throw new Error("Bulk delete requires --confirm-delete after dry-run review.");
  }
  const deleted = [];
  const failed = [];
  for (const target of candidates) {
    const response = await apiFetch(page, config, headers, `/prod-api/activity/apply/${target.id}`, { method: "DELETE" });
    const ok = response.status === 200 && response.body?.code === 200;
    if (ok) deleted.push({ ...target, status: response.status, code: response.body.code });
    else failed.push({ ...target, status: response.status, body: response.body });
    await sleep(Number(options.deleteDelayMs || 120));
  }
  const after = await listByOperator(page, config, headers, operator, pageSize);
  return {
    dryRun: false,
    operator,
    beforeTotal: before.total,
    targetCount: candidates.length,
    deletedCount: deleted.length,
    failed,
    skipped,
    remainingExact: after.rows.filter(row => row.operator === operator),
    remainingFuzzy: after.rows,
    deletedIds: deleted.map(item => item.id),
  };
}

async function captureRegisterListHeaders(page, config, operator) {
  let headers = null;
  page.on("request", request => {
    if (request.url().includes("/prod-api/activity/apply/list")) headers = request.headers();
  });
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await fillInputByPlaceholder(page, "最近编辑人", operator);
  const responsePromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/apply/list") && response.request().method() === "GET"
  ), { timeout: 12000 });
  await clickButton(page, "搜索");
  const response = await responsePromise;
  const body = await response.json().catch(() => null);
  if (response.status() !== 200 || body?.code !== 200) {
    throw new Error(`Operator search failed: HTTP ${response.status()} body=${JSON.stringify(body)}`);
  }
  if (!headers?.authorization) throw new Error("Missing authorization header from registration list request.");
  return {
    authorization: headers.authorization,
    deviceid: headers.deviceid || "",
  };
}

async function listByOperator(page, config, headers, operator, pageSize) {
  const query = new URLSearchParams({ operator, pageNum: "1", pageSize: String(pageSize) });
  const response = await apiFetch(page, config, headers, `/prod-api/activity/apply/list?${query.toString()}`);
  if (response.status !== 200 || response.body?.code !== 200) {
    throw new Error(`List by operator failed: HTTP ${response.status} body=${JSON.stringify(response.body)}`);
  }
  const rows = response.body.rows || response.body.data?.rows || [];
  return {
    total: response.body.total ?? response.body.data?.total ?? rows.length,
    rows: rows.map(row => ({
      id: row.id,
      name: row.name,
      operator: row.operator,
      updateTime: row.updateTime,
    })),
  };
}

async function apiFetch(page, config, headers, path, init = {}) {
  return await page.evaluate(async ({ baseUrl, path, init, headers }) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: headers.authorization,
        deviceId: headers.deviceid,
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    return { status: response.status, body };
  }, { baseUrl: config.baseUrl, path, init, headers });
}

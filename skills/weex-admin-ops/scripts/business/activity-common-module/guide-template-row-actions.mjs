import { sleep } from "../../lib/browser.mjs";
import {
  clickButton,
  clickRowActionByText,
  confirmMessageBox,
  fillLabel,
  tableRows,
} from "../../lib/element-ui.mjs";
import {
  createGuideTemplates,
  createGuideTemplatesWithUi,
  openGuidePageAndCaptureAuth,
  searchGuideTemplate,
} from "./guide-template-create.mjs";

export async function verifyGuideTemplateRowActions(page, config, plan, options = {}) {
  const authHeader = await openGuidePageAndCaptureAuth(page, config);
  const created = options.visible
    ? await createGuideTemplatesWithUi(page, config, plan)
    : await createGuideTemplates(page, config, plan);
  const results = [];
  for (const record of created) results.push(await verifyOneGuideTemplateRowActions(page, config, authHeader, record));
  return { created, results };
}

async function verifyOneGuideTemplateRowActions(page, config, authHeader, record) {
  if (!record.ok) throw new Error(`Temporary guide template setup failed: ${record.name}`);
  const originalName = record.name;
  const copiedName = `复制从 ${originalName}`;
  const result = { originalName, copiedName, steps: [] };

  const originalRow = await searchGuideTemplateInUi(page, config, originalName);
  result.id = originalRow[0];
  result.steps.push({ step: "search_original", row: originalRow });

  const viewResponsePromise = waitGuideTemplate(page, "GET", result.id).catch(() => null);
  await clickRowActionByText(page, originalName, "查看");
  const viewResponse = await viewResponsePromise;
  const viewBody = await responseJson(viewResponse);
  const viewDialog = await visibleDialogState(page);
  if (!viewResponse || viewResponse.status() !== 200 || viewBody?.code !== 200 || viewBody?.data?.templateName !== originalName || !viewDialog.values.includes(originalName)) {
    throw new Error(`View failed for ${result.id}: HTTP ${viewResponse?.status()} body=${JSON.stringify(viewBody)} dialog=${JSON.stringify(viewDialog)}`);
  }
  result.steps.push({ step: "view", status: viewResponse.status(), responseCode: viewBody.code, dialogValues: viewDialog.values.slice(0, 6) });
  await closeTopDialog(page);

  await clickRowActionByText(page, originalName, "修改");
  await selectCurrentDialogOption(page, "活动类型", "交易竞速赛");
  const putResponsePromise = waitGuideTemplate(page, "PUT").catch(() => null);
  await clickButton(page, "确认", ".el-dialog", true);
  const putResponse = await putResponsePromise;
  await sleep(1200);
  const putBody = await responseJson(putResponse);
  if (!putResponse || putResponse.status() >= 400 || putBody?.code !== 200) {
    throw new Error(`Modify failed for ${result.id}: HTTP ${putResponse?.status()} body=${JSON.stringify(putBody)}`);
  }
  const detailAfterModify = await detailGuideTemplate(page, authHeader, result.id);
  if (detailAfterModify?.data?.activityType !== "RACE_COMPETITION") {
    throw new Error(`Modify detail mismatch: ${detailAfterModify?.data?.activityType}`);
  }
  const modifiedRow = await searchGuideTemplateInUi(page, config, originalName);
  result.steps.push({
    step: "modify",
    status: putResponse.status(),
    responseCode: putBody.code,
    activityType: detailAfterModify.data.activityType,
    row: modifiedRow,
  });

  const copyResponsePromise = waitGuideTemplate(page, "POST", "/copy").catch(() => null);
  await clickRowActionByText(page, originalName, "复制");
  const copyResponse = await copyResponsePromise;
  await sleep(1500);
  const copyBody = await responseJson(copyResponse);
  if (!copyResponse || copyResponse.status() >= 400 || copyBody?.code !== 200) {
    throw new Error(`Copy failed for ${result.id}: HTTP ${copyResponse?.status()} body=${JSON.stringify(copyBody)}`);
  }
  const copiedSearch = await searchGuideTemplate(page, authHeader, copiedName);
  const copied = copiedSearch.rows.find(row => row.templateName === copiedName);
  if (!copied) throw new Error(`Copied row not found: ${copiedName}`);
  result.copiedId = copied.id;
  result.steps.push({ step: "copy", status: copyResponse.status(), responseCode: copyBody.code, copiedId: copied.id, copiedName });

  const copiedDelete = await deleteGuideTemplateInUi(page, config, copiedName, copied.id);
  result.steps.push({ step: "delete_copy", ...copiedDelete });
  const originalDelete = await deleteGuideTemplateInUi(page, config, originalName, result.id);
  result.steps.push({ step: "delete_original", ...originalDelete });

  return result;
}

async function searchGuideTemplateInUi(page, config, name) {
  await page.goto(`${config.baseUrl}/activity/guide`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await fillLabel(page, "模版名称", name);
  const listResponse = page.waitForResponse(response => response.url().includes("/prod-api/activity/guideTemplate/list") && response.request().method() === "GET", { timeout: 12000 }).catch(() => null);
  await clickButton(page, "搜索");
  await listResponse;
  await sleep(900);
  const row = (await tableRows(page)).find(cells => cells.some(cell => cell === name || cell.includes(name)));
  if (!row) throw new Error(`Guide template row not found: ${name}`);
  return row;
}

async function deleteGuideTemplateInUi(page, config, name, id) {
  await searchGuideTemplateInUi(page, config, name);
  await clickRowActionByText(page, name, "删除");
  const deleteResponsePromise = waitGuideTemplate(page, "DELETE", id).catch(() => null);
  const confirmText = await confirmMessageBox(page, "确认删除该活动吗");
  const deleteResponse = await deleteResponsePromise;
  await sleep(1200);
  const deleteBody = await responseJson(deleteResponse);
  if (!deleteResponse || deleteResponse.status() >= 400 || deleteBody?.code !== 200) {
    throw new Error(`Delete failed for ${id}: HTTP ${deleteResponse?.status()} body=${JSON.stringify(deleteBody)}`);
  }
  await fillLabel(page, "模版名称", name);
  const listResponse = page.waitForResponse(response => response.url().includes("/prod-api/activity/guideTemplate/list") && response.request().method() === "GET", { timeout: 12000 }).catch(() => null);
  await clickButton(page, "搜索");
  await listResponse;
  await sleep(900);
  const rows = await tableRows(page);
  const remainingExact = rows.find(row => row.some(cell => cell === name));
  if (remainingExact) throw new Error(`Deleted row still present: ${name}`);
  return {
    id,
    status: deleteResponse.status(),
    responseCode: deleteBody.code,
    confirmText: confirmText.replace(/\s+/g, " ").slice(0, 160),
    remainingExact: null,
  };
}

async function selectCurrentDialogOption(page, label, option) {
  const selected = await page.evaluate(({ label }) => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const dialog = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1);
    if (!dialog) return false;
    const item = [...dialog.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(element => norm(element.querySelector(".el-form-item__label")?.innerText).includes(norm(label)));
    const select = item?.querySelector(".el-select");
    if (!select) return false;
    select.click();
    return true;
  }, { label });
  if (!selected) throw new Error(`Select not found in current dialog: ${label}`);
  await sleep(400);
  await page.locator(".el-select-dropdown:visible .el-select-dropdown__item", { hasText: option }).last().click();
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(500);
}

async function visibleDialogState(page) {
  return page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const dialog = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1);
    if (!dialog) return { text: "", values: [] };
    return {
      text: dialog.innerText || "",
      values: [...dialog.querySelectorAll("input, textarea")].map(input => input.value || input.getAttribute("value") || "").filter(Boolean),
    };
  });
}

async function closeTopDialog(page) {
  const closed = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const dialog = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1);
    const button = dialog?.querySelector(".el-dialog__headerbtn");
    if (!button) return false;
    button.click();
    return true;
  });
  if (!closed) await page.keyboard.press("Escape");
  await sleep(700);
}

async function detailGuideTemplate(page, authHeader, id) {
  return page.evaluate(async ({ authHeader, id }) => {
    const response = await fetch(`/prod-api/activity/guideTemplate/${id}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return response.json();
  }, { authHeader, id });
}

function waitGuideTemplate(page, method, marker = "") {
  return page.waitForResponse(response => {
    if (!response.url().includes("/prod-api/activity/guideTemplate")) return false;
    if (marker && !response.url().includes(String(marker))) return false;
    return response.request().method() === method;
  }, { timeout: 15000 });
}

async function responseJson(response) {
  try { return await response?.json(); } catch { return null; }
}

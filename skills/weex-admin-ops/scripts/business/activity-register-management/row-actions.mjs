import { sleep } from "../../lib/browser.mjs";
import {
  clickButton,
  clickButtonInDialog,
  clickRowActionByText,
  closeDialogByText,
  confirmMessageBox,
  fillInputByPlaceholder,
  fillLabelInDialog,
  labelValueInDialog,
  tableRows,
  visibleRowIndexByText,
} from "../../lib/element-ui.mjs";
import { createRegisterTemplates } from "./create.mjs";

export async function verifyRegisterTemplateRowActions(page, config, plan) {
  const created = await createRegisterTemplates(page, config, plan);
  const results = [];
  for (const record of created) results.push(await verifyOneTemplateRowActions(page, config, record));
  return { created, results };
}

async function verifyOneTemplateRowActions(page, config, record) {
  const originalName = record.name;
  const modifiedName = `${originalName}_已修改`;
  const result = { originalName, modifiedName, steps: [] };
  const originalRow = await searchRegisterTemplate(page, config, originalName);
  result.id = originalRow[0];
  result.steps.push({ step: "search_original", row: originalRow });

  const detailResponsePromise = waitApply(page, "GET", result.id).catch(() => null);
  await clickRowActionByText(page, originalName, "查看");
  const detailResponse = await detailResponsePromise;
  let detailBody = null;
  try { detailBody = await detailResponse?.json(); } catch {}
  if (!detailResponse || detailResponse.status() !== 200 || detailBody?.code !== 200) {
    throw new Error(`View detail failed for ${result.id}: HTTP ${detailResponse?.status()} body=${JSON.stringify(detailBody)}`);
  }
  const viewName = await labelValueInDialog(page, "用户报名管理（查看）", "用户管理模板名称");
  if (detailBody?.data?.name !== originalName || viewName !== originalName) {
    throw new Error(`View detail name mismatch: body=${detailBody?.data?.name}; dialog=${viewName}; expected=${originalName}`);
  }
  result.steps.push({ step: "view", status: detailResponse.status(), responseCode: detailBody.code, title: "用户报名管理（查看）" });
  await closeDialogByText(page, "用户报名管理（查看）");

  await clickRowActionByText(page, originalName, "修改");
  const editName = await labelValueInDialog(page, "用户报名管理（编辑）", "用户管理模板名称");
  if (editName !== originalName) throw new Error(`Edit prefill name mismatch: ${editName}`);
  await fillLabelInDialog(page, "用户报名管理（编辑）", "用户管理模板名称", modifiedName);
  const putResponsePromise = waitApply(page, "PUT").catch(() => null);
  await clickButtonInDialog(page, "用户报名管理（编辑）", "确认");
  const putResponse = await putResponsePromise;
  await sleep(1000);
  let putBody = null;
  try { putBody = await putResponse?.json(); } catch {}
  if (!putResponse || putResponse.status() >= 400 || putBody?.code !== 200) {
    throw new Error(`Modify failed for ${result.id}: HTTP ${putResponse?.status()} body=${JSON.stringify(putBody)}`);
  }
  const modifiedRow = await searchRegisterTemplate(page, config, modifiedName);
  result.steps.push({ step: "modify", status: putResponse.status(), responseCode: putBody.code, row: modifiedRow });

  await clickRowActionByText(page, modifiedName, "删除");
  const deleteResponsePromise = waitApply(page, "DELETE", result.id).catch(() => null);
  const confirmText = await confirmMessageBox(page, modifiedName);
  const deleteResponse = await deleteResponsePromise;
  await sleep(1000);
  let deleteBody = null;
  try { deleteBody = await deleteResponse?.json(); } catch {}
  if (!deleteResponse || deleteResponse.status() >= 400 || deleteBody?.code !== 200) {
    throw new Error(`Delete failed for ${result.id}: HTTP ${deleteResponse?.status()} body=${JSON.stringify(deleteBody)}`);
  }
  await fillInputByPlaceholder(page, "用户管理模板名称", modifiedName);
  const listResponse = page.waitForResponse(response => response.url().includes("/prod-api/activity/apply/list") && response.request().method() === "GET", { timeout: 10000 }).catch(() => null);
  await clickButton(page, "搜索");
  await listResponse;
  await sleep(800);
  const rowAbsentAfterSearch = await visibleRowIndexByText(page, modifiedName) < 0;
  if (!rowAbsentAfterSearch) throw new Error(`Deleted row still visible after search: ${modifiedName}`);
  result.steps.push({
    step: "delete",
    status: deleteResponse.status(),
    responseCode: deleteBody.code,
    confirmText: confirmText.replace(/\s+/g, " ").slice(0, 160),
    rowAbsentAfterSearch,
  });
  return result;
}

async function searchRegisterTemplate(page, config, name) {
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await fillInputByPlaceholder(page, "用户管理模板名称", name);
  const listResponse = page.waitForResponse(response => response.url().includes("/prod-api/activity/apply/list") && response.request().method() === "GET", { timeout: 10000 }).catch(() => null);
  await clickButton(page, "搜索");
  await listResponse;
  await sleep(800);
  const row = (await tableRows(page)).find(cells => cells.some(cell => cell.includes(name)));
  if (!row) throw new Error(`Register template row not found: ${name}`);
  return row;
}

function waitApply(page, method, id = "") {
  return page.waitForResponse(response => {
    if (!response.url().includes("/prod-api/activity/apply")) return false;
    if (id && !response.url().includes(`/prod-api/activity/apply/${id}`)) return false;
    return response.request().method() === method;
  }, { timeout: 12000 });
}

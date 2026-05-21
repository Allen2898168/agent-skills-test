import { sleep } from "../../lib/browser.mjs";
import {
  clickButton,
  clickRowActionByText,
  confirmMessageBox,
  fillLabel,
  formItem,
  tableRows,
  visibleRowIndexByText,
} from "../../lib/element-ui.mjs";
import { dialog } from "../../lib/element-ui/common.mjs";
import { createPrizes } from "./create.mjs";
import { copyPrizeById, searchPrizeByAlias, searchPrizeById, rowToPrize } from "./copy.mjs";

export async function verifyPrizeRowActions(page, config, plan) {
  const created = await createPrizes(page, config, plan);
  const results = [];
  for (const record of created) results.push(await verifyOnePrizeRowActions(page, config, record));
  return { created, results };
}

async function verifyOnePrizeRowActions(page, config, record) {
  const original = await searchPrizeById(page, config, record.id);
  const modifiedName = `${original.name}_已修改`;
  const result = {
    originalId: original.id,
    originalName: original.name,
    originalAlias: original.alias,
    modifiedName,
    copiedId: "",
    steps: [],
  };

  const viewResponsePromise = waitPrize(page, "GET", original.id).catch(() => null);
  await clickRowActionByText(page, original.id, "查看");
  const viewResponse = await viewResponsePromise;
  const viewedName = await readDialogField(page, "奖品名称");
  const viewedAlias = await readDialogField(page, "奖品别名");
  const viewBody = await readResponseJson(viewResponse);
  if (!viewResponse || viewResponse.status() !== 200 || viewBody?.code !== 200) {
    throw new Error(`Prize view failed for ${original.id}: HTTP ${viewResponse?.status()} body=${JSON.stringify(viewBody)}`);
  }
  if (viewedName !== original.name || viewedAlias !== original.alias) {
    throw new Error(`Prize view mismatch for ${original.id}: ${JSON.stringify({ viewedName, viewedAlias, expectedName: original.name, expectedAlias: original.alias })}`);
  }
  result.steps.push({ step: "view", status: viewResponse.status(), responseCode: viewBody.code, viewedName, viewedAlias });
  await closeTopDialog(page);

  const editResponsePromise = waitPrize(page, "GET", original.id).catch(() => null);
  await clickRowActionByText(page, original.id, "修改");
  const editResponse = await editResponsePromise;
  const editBody = await readResponseJson(editResponse);
  if (!editResponse || editResponse.status() !== 200 || editBody?.code !== 200) {
    throw new Error(`Prize edit detail failed for ${original.id}: HTTP ${editResponse?.status()} body=${JSON.stringify(editBody)}`);
  }
  const editName = await readDialogField(page, "奖品名称");
  if (editName !== original.name) throw new Error(`Prize edit prefill mismatch for ${original.id}: ${editName}`);
  await fillLabel(page, "奖品名称", modifiedName);
  await fillModifyRequiredFields(page, record);
  const putResponsePromise = waitPrize(page, "PUT").catch(() => null);
  await clickButton(page, "确认", ".el-dialog");
  const putResponse = await putResponsePromise;
  const putBody = await readResponseJson(putResponse);
  if (!putResponse || putResponse.status() >= 400 || putBody?.code !== 200) {
    throw new Error(`Prize modify failed for ${original.id}: HTTP ${putResponse?.status()} body=${JSON.stringify(putBody)}`);
  }
  const modifiedRow = await searchPrizeByAlias(page, config, original.alias);
  const modified = modifiedRow.map(rowToPrize).find(item => item.id === original.id);
  if (!modified || modified.name !== modifiedName) {
    throw new Error(`Modified prize row not found for ${original.id}: ${JSON.stringify(modifiedRow)}`);
  }
  result.steps.push({ step: "modify", status: putResponse.status(), responseCode: putBody.code, row: modified.row });

  const copyResult = await copyPrizeById(page, config, original.id);
  result.copiedId = copyResult.copied.id;
  if (!copyResult.confirmText.includes("复制")) {
    throw new Error(`Prize copy confirm text mismatch for ${original.id}: ${copyResult.confirmText}`);
  }
  result.steps.push({ step: "copy", confirmText: copyResult.confirmText.replace(/\s+/g, " ").slice(0, 160), copied: copyResult.copied });

  const deleteResponsePromise = waitPrize(page, "DELETE", copyResult.copied.id).catch(() => null);
  await clickRowActionByText(page, copyResult.copied.id, "删除");
  const confirmText = await confirmMessageBox(page);
  const deleteResponse = await deleteResponsePromise;
  const deleteBody = await readResponseJson(deleteResponse);
  if (!deleteResponse || deleteResponse.status() >= 400 || deleteBody?.code !== 200) {
    throw new Error(`Prize delete failed for ${copyResult.copied.id}: HTTP ${deleteResponse?.status()} body=${JSON.stringify(deleteBody)}`);
  }
  const rowAbsentAfterSearch = await isPrizeAbsentById(page, config, copyResult.copied.id);
  if (!rowAbsentAfterSearch) throw new Error(`Deleted copied prize still visible: ${copyResult.copied.id}`);
  result.steps.push({
    step: "delete",
    status: deleteResponse.status(),
    responseCode: deleteBody.code,
    confirmText: confirmText.replace(/\s+/g, " ").slice(0, 160),
    deletedId: copyResult.copied.id,
    rowAbsentAfterSearch,
  });

  await cleanupPrizeById(page, config, original.id);
  return result;
}

async function fillModifyRequiredFields(page, record) {
  if (record?.category === "赠金") {
    const ratioFilled = await fillLabel(page, "抵扣比例", "1", false);
    if (!ratioFilled) await fillLabel(page, "抵扣比例(%)", "1", false);
  }
}

async function cleanupPrizeById(page, config, prizeId) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  const present = !(await isPrizeAbsentById(page, config, prizeId));
  if (!present) return;
  const deleteResponsePromise = waitPrize(page, "DELETE", prizeId).catch(() => null);
  await clickRowActionByText(page, prizeId, "删除");
  await confirmMessageBox(page);
  await deleteResponsePromise;
  await sleep(600);
}

async function isPrizeAbsentById(page, config, prizeId) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  await page.locator('input[placeholder="请输入奖品ID"]').first().fill(String(prizeId));
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(1500);
  return await visibleRowIndexByText(page, String(prizeId)) < 0;
}

async function readDialogField(page, label) {
  const item = await formItem(page, label);
  return item.evaluate(root => {
    const input = root.querySelector("input:not([type='file']), textarea");
    if (input) return input.value || input.getAttribute("value") || "";
    return (root.innerText || "").trim();
  });
}

async function closeTopDialog(page) {
  const d = await dialog(page);
  const closed = await d.evaluate(root => {
    const button = root.querySelector(".el-dialog__headerbtn");
    if (!button) return false;
    button.click();
    return true;
  });
  if (!closed) await page.keyboard.press("Escape");
  await sleep(400);
}

async function readResponseJson(response) {
  try {
    return await response?.json();
  } catch {
    return null;
  }
}

function waitPrize(page, method, id = "") {
  return page.waitForResponse(response => {
    if (!response.url().includes("/prod-api/activity/prize")) return false;
    if (id && !response.url().includes(`/prod-api/activity/prize/${id}`)) return false;
    return response.request().method() === method;
  }, { timeout: 12000 });
}

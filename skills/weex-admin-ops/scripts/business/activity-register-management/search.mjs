import { sleep } from "../../lib/browser.mjs";
import { clickButton, fillInputByPlaceholder, selectOpenOption, tableRows } from "../../lib/element-ui.mjs";

export async function runRegisterTemplateSearchChecks(page, config, options = {}) {
  const namePrefix = String(options.namePrefix || "自动化报名模板").trim();
  const target = await discoverRegisterTemplateTarget(page, config, namePrefix);
  const byName = await verifyRegisterTemplateNameSearch(page, config, target);
  const byId = await verifyRegisterTemplateIdSearch(page, config, target);
  return { target, searchChecks: { byName, byId } };
}

export async function discoverRegisterTemplateTarget(page, config, namePrefix) {
  await openRegisterList(page, config);
  const listResponse = waitRegisterList(page).catch(() => null);
  await fillInputByPlaceholder(page, "用户管理模板名称", namePrefix);
  await clickButton(page, "搜索");
  const response = await listResponse;
  await sleep(900);
  const rows = (await tableRows(page))
    .map(rowToRegisterTemplate)
    .filter(item => item.name.includes(namePrefix));
  if (!rows.length) {
    throw new Error(`Register template search target not found by prefix: ${namePrefix}`);
  }
  return {
    ...rows[0],
    query: namePrefix,
    requestUrl: response?.url?.() || "",
  };
}

export function rowToRegisterTemplate(row) {
  return {
    id: String(row?.[0] || "").trim(),
    name: String(row?.[1] || "").trim(),
    platformScope: String(row?.[2] || "").trim(),
    updatedAt: String(row?.[3] || "").trim(),
    editor: String(row?.[4] || "").trim(),
    row,
  };
}

async function verifyRegisterTemplateNameSearch(page, config, target) {
  await openRegisterList(page, config);
  const listResponse = waitRegisterList(page).catch(() => null);
  await fillInputByPlaceholder(page, "用户管理模板名称", target.name);
  await clickButton(page, "搜索");
  const response = await listResponse;
  await sleep(900);
  const rows = (await tableRows(page)).map(rowToRegisterTemplate);
  const matched = rows.some(item => item.id === target.id && item.name === target.name);
  const allMatched = rows.length > 0 && rows.every(item => item.name.includes(target.name));
  return {
    ok: matched && allMatched,
    recordType: "register_template_search",
    searchBy: "name",
    templateId: target.id,
    templateName: target.name,
    searchedValue: target.name,
    requestUrl: response?.url?.() || "",
    rowCount: rows.length,
    matchedTemplateIds: rows.map(item => item.id),
  };
}

async function verifyRegisterTemplateIdSearch(page, config, target) {
  await openRegisterList(page, config);
  const selectedLabel = await selectRegisterTemplateId(page, target.id);
  const listResponse = waitRegisterList(page).catch(() => null);
  await clickButton(page, "搜索");
  const response = await listResponse;
  await sleep(900);
  const rows = (await tableRows(page)).map(rowToRegisterTemplate);
  const matched = rows.some(item => item.id === target.id && item.name === target.name);
  const allMatched = rows.length > 0 && rows.every(item => item.id === target.id);
  return {
    ok: matched && allMatched,
    recordType: "register_template_search",
    searchBy: "id",
    templateId: target.id,
    templateName: target.name,
    searchedValue: target.id,
    selectedLabel,
    requestUrl: response?.url?.() || "",
    rowCount: rows.length,
    matchedTemplateIds: rows.map(item => item.id),
  };
}

async function selectRegisterTemplateId(page, templateId) {
  const selectRoot = page.locator('input[placeholder="输入id或模板名称"]').first().locator("xpath=ancestor::div[contains(@class,'el-select')]").first();
  await selectRoot.waitFor({ state: "visible", timeout: 12000 });
  await selectRoot.scrollIntoViewIfNeeded();
  await selectRoot.click({ force: true });
  const editableInput = selectRoot.locator("input.el-select__input").first();
  await editableInput.waitFor({ state: "visible", timeout: 12000 });
  await editableInput.click({ force: true });
  await editableInput.fill(String(templateId));
  await sleep(1000);
  return selectOpenOption(page, `【${templateId}】`, true, true);
}

async function waitRegisterList(page) {
  return page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/apply/list")
    && response.request().method() === "GET"
  ), { timeout: 12000 });
}

async function openRegisterList(page, config) {
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.locator('button:has-text("新增")').first().waitFor({ state: "visible", timeout: 15000 });
}

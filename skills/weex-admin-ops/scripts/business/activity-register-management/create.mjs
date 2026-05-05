import { sleep } from "../../lib/browser.mjs";

export async function createRegisterTemplates(page, config, plan) {
  const created = [];
  for (const spec of plan) created.push(await createOneTemplate(page, config, spec));
  return created;
}

async function createOneTemplate(page, config, spec) {
  await openRegisterPage(page, config);
  await clickVisibleButton(page, "新增");
  await page.locator(".el-dialog:visible").last().waitFor({ timeout: 12000 });
  await sleep(500);
  await fillDialogLabel(page, "用户管理模板名称", spec.name);
  await clickDialogChoice(page, "平台用户参与范围", spec.platformScope, "radio");
  await clearDialogCheckboxes(page, "限制用户参与范围");
  await clickDialogChoice(page, "限制用户参与范围", spec.restrictScope, "checkbox");
  await clearDialogCheckboxes(page, "限制用户权限");
  for (const permission of spec.permissions || []) {
    await clickDialogChoice(page, "限制用户权限", permission, "checkbox");
  }
  await clearDialogCheckboxes(page, "用户报名方式");
  await clickDialogChoice(page, "用户报名方式", spec.signupModeLabel, "checkbox");
  if (spec.minTeam) await fillDialogLabel(page, "最小团队人数", spec.minTeam);
  if (spec.peopleLimit) await fillDialogLabel(page, "报名人数限制", spec.peopleLimit);

  const postPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/apply") && response.request().method() === "POST"
  ), { timeout: 15000 }).catch(() => null);
  await clickVisibleButton(page, "确认", ".el-dialog");
  const response = await postPromise;
  await sleep(1000);
  const errors = await visibleDialogErrors(page);
  if (!response) throw new Error(`Create register template did not send POST: ${spec.name}; errors=${JSON.stringify(errors)}`);
  let body = null;
  try { body = await response.json(); } catch {}
  if (response.status() >= 400 || (body?.code && body.code !== 200)) {
    throw new Error(`Create register template failed: ${spec.name}; HTTP ${response.status()}; body=${JSON.stringify(body)}; errors=${JSON.stringify(errors)}`);
  }
  await page.locator(".el-dialog:visible").last().waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  const verification = await searchRegisterTemplate(page, config, spec.name);
  if (!verification.found) throw new Error(`Register template created but search did not find row: ${spec.name}`);
  return {
    name: spec.name,
    signupMode: spec.signupModeLabel,
    platformScope: spec.platformScope,
    restrictScope: spec.restrictScope,
    permissions: spec.permissions,
    minTeam: spec.minTeam,
    status: response.status(),
    responseCode: body?.code,
    responseMsg: body?.msg,
    row: verification.row,
  };
}

async function openRegisterPage(page, config) {
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.locator('button:has-text("新增")').first().waitFor({ state: "visible", timeout: 15000 });
}

async function searchRegisterTemplate(page, config, name) {
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const listPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/apply/list") && response.request().method() === "GET"
  ), { timeout: 12000 }).catch(() => null);
  await page.evaluate(value => {
    const input = visibleElements(document.querySelectorAll('input:not([readonly])'))
      .find(item => (item.getAttribute("placeholder") || "").includes("用户管理模板名称"));
    if (!input) throw new Error("Search input not found: 用户管理模板名称");
    setNativeValue(input, value);
    const button = visibleElements(document.querySelectorAll("button")).find(item => (item.innerText || "").includes("搜索"));
    if (!button) throw new Error("Search button not found");
    button.click();
  }, name);
  await listPromise;
  await sleep(800);
  return page.evaluate(value => {
    const rows = [...document.querySelectorAll(".el-table__body-wrapper tbody tr")]
      .map(tr => [...tr.querySelectorAll("td")].map(td => td.innerText.trim()));
    const row = rows.find(cells => cells.some(cell => cell.includes(value)));
    return { found: Boolean(row), row };
  }, name);
}

async function fillDialogLabel(page, label, value) {
  const filled = await page.evaluate(({ label, value }) => {
    const item = findDialogFormItem(label);
    const input = visibleElements(item.querySelectorAll('input:not([readonly]):not([type="file"]), textarea'))[0];
    if (!input) return false;
    setNativeValue(input, value);
    return true;
  }, { label, value });
  if (!filled) throw new Error(`Dialog input not found: ${label}`);
  await sleep(200);
}

async function clickDialogChoice(page, label, choice, type) {
  const clicked = await page.evaluate(({ label, choice, type }) => {
    const item = findDialogFormItem(label);
    const selector = type === "radio" ? ".el-radio" : ".el-checkbox";
    const target = visibleElements(item.querySelectorAll(selector))
      .find(item => normalize(item.innerText) === normalize(choice) || normalize(item.innerText).includes(normalize(choice)));
    if (!target) return false;
    if (!target.classList.contains("is-checked")) target.click();
    return true;
  }, { label, choice, type });
  if (!clicked) throw new Error(`Dialog choice not found: ${label}/${choice}`);
  await sleep(250);
}

async function clearDialogCheckboxes(page, label) {
  await page.evaluate(label => {
    const item = findDialogFormItem(label);
    for (const checkbox of visibleElements(item.querySelectorAll(".el-checkbox.is-checked"))) checkbox.click();
  }, label).catch(() => {});
  await sleep(200);
}

async function clickVisibleButton(page, text, scopeSelector = null) {
  const clicked = await page.evaluate(({ text, scopeSelector }) => {
    const root = scopeSelector ? visibleElements(document.querySelectorAll(scopeSelector)).at(-1) : document;
    const button = visibleElements(root.querySelectorAll("button")).find(item => (item.innerText || "").includes(text));
    if (!button) return false;
    button.click();
    return true;
  }, { text, scopeSelector });
  if (!clicked) throw new Error(`Button not found: ${text}`);
}

async function visibleDialogErrors(page) {
  return page.evaluate(() => {
    const root = visibleElements(document.querySelectorAll(".el-dialog")).at(-1);
    if (!root) return [];
    return [...root.querySelectorAll(".el-form-item")]
      .map(item => ({
        label: item.querySelector(".el-form-item__label")?.innerText.trim(),
        error: item.querySelector(".el-form-item__error")?.innerText.trim(),
      }))
      .filter(item => item.error);
  }).catch(() => []);
}

function domHelpers() {
  window.visibleElements = elements => [...elements].filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  window.normalize = text => (text || "").replace(/\s/g, "");
  window.findDialogFormItem = label => {
    const root = window.visibleElements(document.querySelectorAll(".el-dialog")).at(-1);
    const item = window.visibleElements(root.querySelectorAll(".el-form-item"))
      .find(candidate => window.normalize(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(window.normalize(label)));
    if (!item) throw new Error(`Form item not found: ${label}`);
    return item;
  };
  window.setNativeValue = (input, value) => {
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
}

export async function installRegisterDomHelpers(page) {
  await page.addInitScript(domHelpers);
  await page.evaluate(domHelpers).catch(() => {});
}

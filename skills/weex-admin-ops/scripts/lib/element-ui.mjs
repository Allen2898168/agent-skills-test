import { sleep } from "./browser.mjs";

export async function dialog(page) {
  const d = page.locator(".el-dialog:visible").last();
  await d.waitFor({ timeout: 10000 });
  return d;
}

export async function selectPlaceholder(page, placeholder, option) {
  const d = await dialog(page);
  const input = d.locator(`input[placeholder*="${placeholder}"]`).first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await sleep(500);
  await page.evaluate(selectVisibleOption, option);
  await sleep(700);
}

export async function formItem(page, label) {
  const handle = await page.evaluateHandle(labelText => {
    const norm = s => (s || "").replace(/\s/g, "");
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs[dialogs.length - 1] || document;
    const items = [...root.querySelectorAll(".el-form-item")].filter(visible);
    return items.find(it => norm(it.querySelector(".el-form-item__label")?.innerText).includes(norm(labelText))) || null;
  }, label);
  const element = handle.asElement();
  if (!element) throw new Error(`Form item not found: ${label}`);
  return element;
}

export async function fillLabel(page, label, value, required = true) {
  try {
    const item = await formItem(page, label);
    await item.scrollIntoViewIfNeeded();
    const input = await item.$('input:not([type="file"]):not([readonly]), textarea');
    if (!input) throw new Error(`Input not found: ${label}`);
    await input.fill(String(value));
    await sleep(100);
    return true;
  } catch (error) {
    if (required) throw error;
    return false;
  }
}

export async function selectFirstByLabel(page, label, required = true, blur = false) {
  try {
    const item = await formItem(page, label);
    await item.scrollIntoViewIfNeeded();
    const input = await item.$("input");
    if (!input) throw new Error(`Select input not found: ${label}`);
    await input.click();
    await sleep(800);
    const selected = await page.evaluate(selectFirstVisibleOption);
    if (!selected) throw new Error(`No option found: ${label}`);
    await sleep(500);
    if (blur) {
      const d = await dialog(page);
      await d.click({ position: { x: 40, y: 40 } });
      await sleep(700);
    }
    return selected;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

export async function setEnglish(page, enName) {
  const d = await dialog(page);
  if (!(await d.locator(".el-switch").count())) return false;
  const sw = d.locator(".el-switch").first();
  const cls = await sw.getAttribute("class");
  if (!cls.includes("is-checked")) await sw.click();
  await sleep(700);
  const en = d.locator('input[placeholder="英语"]').first();
  if (await en.count()) {
    await en.fill(enName);
    return true;
  }
  return false;
}

export async function uploadFileInFormItem(page, label, filePath) {
  const item = await formItem(page, label);
  await item.scrollIntoViewIfNeeded();
  const uploadPromise = page.waitForResponse(r => r.url().includes("/prod-api/common/uploadImgReplace"), { timeout: 12000 }).catch(() => null);
  let inputs = await item.$$('input[type="file"]');
  if (!inputs.length) inputs = await page.locator('.el-dialog:visible .el-upload input[type="file"]').elementHandles();
  if (!inputs.length) throw new Error(`${label} file input not found`);
  await inputs[inputs.length - 1].setInputFiles(filePath);
  const response = await uploadPromise;
  await sleep(1200);
  if (!response) throw new Error("Image upload response not observed");
  if (response.status() >= 400) throw new Error(`Image upload HTTP ${response.status()}`);
  return response.status();
}

export async function visibleFormErrors(page) {
  return page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs[dialogs.length - 1] || document;
    return [...root.querySelectorAll(".el-form-item")]
      .map(it => ({
        label: it.querySelector(".el-form-item__label")?.innerText.trim(),
        error: it.querySelector(".el-form-item__error")?.innerText.trim(),
      }))
      .filter(x => x.error);
  });
}

export async function tableRows(page) {
  return page.evaluate(() => [...document.querySelectorAll(".el-table__body-wrapper tbody tr")]
    .map(tr => [...tr.querySelectorAll("td")].map(td => td.innerText.trim())));
}

function selectVisibleOption(optionText) {
  const items = [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height;
    });
  const item = items.find(el => (el.innerText || "").trim() === optionText || (el.innerText || "").includes(optionText));
  if (!item) throw new Error(`Option not found: ${optionText}; options=${items.map(i => i.innerText.trim()).join("|")}`);
  item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  item.click();
}

function selectFirstVisibleOption() {
  const items = [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item:not(.is-disabled)')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      const text = (el.innerText || "").trim();
      return r.width && r.height && text && !/暂无数据|加载中/.test(text);
    });
  const item = items[0];
  if (!item) return null;
  const text = item.innerText.trim();
  item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  item.click();
  return text;
}

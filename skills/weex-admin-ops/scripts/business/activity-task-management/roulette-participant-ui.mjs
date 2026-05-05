import { sleep } from "../../lib/browser.mjs";
import { dialog, tableRows } from "../../lib/element-ui.mjs";

export async function fillEnglishIfVisible(page, task) {
  await fillEnglishByLabel(page, "任务名称", task.enName);
  await fillEnglishByLabel(page, "任务内容", task.enContent);
  await fillEnglishByLabel(page, "任务标签", task.enTag);
}

async function fillEnglishByLabel(page, label, value) {
  const item = await formItemHandle(page, label);
  await item.scrollIntoViewIfNeeded();
  const enabled = await item.evaluate(root => {
    const sw = root.querySelector(".el-switch");
    if (!sw) return false;
    if (!sw.className.includes("is-checked")) sw.click();
    return true;
  });
  if (!enabled) throw new Error(`Multilingual switch not found: ${label}`);
  await sleep(700);
  const filled = await item.evaluate((root, nextValue) => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const field = [...root.querySelectorAll('input[placeholder="英语"], textarea[placeholder="英语"]')].find(visible);
    if (!field) return false;
    const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(field, nextValue);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, value);
  if (!filled) throw new Error(`Visible English input not found: ${label}`);
}

export async function selectCountry(page, task) {
  const item = await formItemHandle(page, "指定国家或地区");
  await item.scrollIntoViewIfNeeded();
  await item.$eval(".el-select", el => el.click());
  await sleep(800);
  const selected = task.country
    ? await selectVisibleOption(page, task.country)
    : await selectFirstVisibleOption(page);
  const d = await dialog(page);
  await d.click({ position: { x: 40, y: 40 } });
  await sleep(700);
  const tagCount = await item.$$eval(".el-tag", tags => tags.filter(tag => tag.offsetParent).length);
  if (!tagCount) throw new Error("Country selected but no visible tag was bound");
  return selected;
}

export async function fillRewardRange(page, min, max) {
  const item = await formItemHandle(page, "正常奖励");
  const inputs = await item.$$('input:not([readonly]):not([type="file"])');
  if (inputs[0]) await inputs[0].fill(String(min));
  if (inputs[1] && max !== "") await inputs[1].fill(String(max));
}

export async function searchTaskByName(page, config, name) {
  await page.goto(`${config.baseUrl}/activity/task`, { waitUntil: "domcontentloaded" });
  await sleep(1300);
  const input = page.locator('input[placeholder*="任务别名"]').first();
  await input.fill(name);
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(2200);
  const row = (await tableRows(page)).find(cells => cells.join("\n").includes(name));
  if (!row) throw new Error(`Created task row not found by name: ${name}`);
  return row;
}

export function firstNumericCell(row) {
  return row.find(cell => /^\d+$/.test(cell)) || "";
}

async function formItemHandle(page, label) {
  const handle = await page.evaluateHandle(labelText => {
    const norm = value => (value || "").replace(/\s/g, "");
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs[dialogs.length - 1] || document;
    return [...root.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(item => norm(item.querySelector(".el-form-item__label")?.innerText).includes(norm(labelText))) || null;
  }, label);
  const element = handle.asElement();
  if (!element) throw new Error(`Form item not found: ${label}`);
  return element;
}

async function selectVisibleOption(page, option) {
  return page.evaluate(text => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height;
    };
    const item = [...document.querySelectorAll(".el-select-dropdown__item")]
      .filter(visible)
      .find(el => (el.innerText || "").trim() === text || (el.innerText || "").includes(text));
    if (!item) throw new Error(`Option not found: ${text}`);
    item.click();
    return item.innerText.trim();
  }, option);
}

async function selectFirstVisibleOption(page) {
  return page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height;
    };
    const item = [...document.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")]
      .filter(el => visible(el) && (el.innerText || "").trim())[0];
    if (!item) throw new Error("No visible option found");
    item.click();
    return item.innerText.trim();
  });
}

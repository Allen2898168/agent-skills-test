import { sleep } from "../browser.mjs";
import { dialog, formItem } from "./common.mjs";

export async function selectPlaceholder(page, placeholder, option) {
  const d = await dialog(page);
  const input = d.locator(`input[placeholder*="${placeholder}"]`).first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await sleep(500);
  await page.evaluate(selectVisibleOption, option);
  await sleep(700);
}

export async function selectFirstByLabel(page, label, required = true, blur = false) {
  try {
    await openSelectByLabel(page, label);
    const selected = await page.evaluate(selectFirstVisibleOption);
    if (!selected) throw new Error(`No option found: ${label}`);
    await sleep(500);
    if (blur) await closeOpenDropdown(page);
    return selected;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

export async function selectOptionByLabel(page, label, option, required = true, blur = false) {
  try {
    await openSelectByLabel(page, label);
    const selected = await page.evaluate(selectVisibleOption, option);
    await sleep(500);
    if (blur) await closeOpenDropdown(page);
    return selected;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

export async function selectOpenOption(page, option, required = true, blur = false) {
  try {
    const selected = await page.evaluate(selectVisibleOption, option);
    await sleep(500);
    if (blur) await closeOpenDropdown(page);
    return selected;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

export async function selectFirstOpenOption(page, required = true, blur = false) {
  try {
    const selected = await page.evaluate(selectFirstVisibleOption);
    if (!selected) throw new Error("No visible option found");
    await sleep(500);
    if (blur) await closeOpenDropdown(page);
    return selected;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

export async function closeOpenDropdown(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs.at(-1) || document.body;
    root.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window, clientX: 40, clientY: 40 }));
    root.click();
  }).catch(() => {});
  await sleep(700);
}

async function openSelectByLabel(page, label) {
  const item = await formItem(page, label);
  await item.scrollIntoViewIfNeeded();
  const opened = await item.evaluate(root => {
    const select = root.querySelector(".el-select");
    if (!select) return false;
    select.click();
    return true;
  });
  if (!opened) throw new Error(`Select input not found: ${label}`);
  await sleep(800);
}

function selectVisibleOption(optionText) {
  const dropdown = [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"])')]
    .filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height;
    })
    .at(-1);
  if (!dropdown) throw new Error(`No visible select dropdown for option: ${optionText}`);
  const items = [...dropdown.querySelectorAll(".el-select-dropdown__item")]
    .filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height;
    });
  const item = items.find(element => (element.innerText || "").trim() === optionText || (element.innerText || "").includes(optionText));
  if (!item) throw new Error(`Option not found: ${optionText}; options=${items.map(i => i.innerText.trim()).join("|")}`);
  item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  item.click();
  return item.innerText.trim();
}

function selectFirstVisibleOption() {
  const dropdown = [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"])')]
    .filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height;
    })
    .at(-1);
  if (!dropdown) return null;
  const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")]
    .filter(element => {
      const rect = element.getBoundingClientRect();
      const text = (element.innerText || "").trim();
      return rect.width && rect.height && text && !/暂无数据|加载中/.test(text);
    });
  const item = items[0];
  if (!item) return null;
  const text = item.innerText.trim();
  item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  item.click();
  return text;
}

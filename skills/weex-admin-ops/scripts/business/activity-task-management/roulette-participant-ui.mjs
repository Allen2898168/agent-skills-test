import { sleep } from "../../lib/browser.mjs";
import { formItem, selectFirstOpenOption, selectOpenOption, tableRows } from "../../lib/element-ui.mjs";

export async function fillEnglishIfVisible(page, task) {
  await fillEnglishByLabel(page, "任务名称", task.enName);
  await fillEnglishByLabel(page, "任务内容", task.enContent);
  await fillEnglishByLabel(page, "任务标签", task.enTag);
}

async function fillEnglishByLabel(page, label, value) {
  const item = await formItem(page, label);
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
  const item = await formItem(page, "指定国家或地区");
  await item.scrollIntoViewIfNeeded();
  await item.$eval(".el-select", el => el.click());
  await sleep(800);
  const selected = task.country
    ? await selectOpenOption(page, task.country, true, true)
    : await selectFirstOpenOption(page, true, true);
  const tagCount = await item.$$eval(".el-tag", tags => tags.filter(tag => tag.offsetParent).length);
  if (!tagCount) throw new Error("Country selected but no visible tag was bound");
  return selected;
}

export async function fillRewardRange(page, min, max) {
  const item = await formItem(page, "正常奖励");
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

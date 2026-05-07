#!/usr/bin/env node
import fs from "node:fs";
import { loginToPrizePage } from "./lib/browser.mjs";
import { timestamp } from "./lib/cli.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";

const { repoRoot } = pathsFrom(import.meta.url);
loadLocalEnv(repoRoot);
const config = adminConfig(repoRoot);
assertAdminConfig(config);
if (!fs.existsSync(config.imagePath)) throw new Error(`image missing: ${config.imagePath}`);

const { chromium } = loadPlaywright();
const stamp = timestamp();
const title = `严格UI转盘抽奖草稿${stamp}`;
const alias = `strict-ui-lottery-${stamp}`;
const evidence = { uploads: 0 };
const variedMode = process.env.LOTTERY_VARIANT === "varied";
const weightConfigMode = process.env.LOTTERY_WEIGHT_CONFIG === "vip";
const enableBeginnerTask = variedMode || process.env.LOTTERY_ENABLE_BEGINNER_TASK === "1";
const prizeAmounts = variedMode ? ["1", "2", "3", "4", "5", "6", "7", "8"] : Array(8).fill("1");
const prizeStocks = variedMode ? ["80", "90", "100", "110", "120", "130", "140", "150"] : Array(8).fill("100");
const prizeWeights = variedMode ? ["5", "8", "10", "12", "13", "15", "17", "20"] : Array(8).fill("12.5");
const redSignWeights = variedMode ? ["4", "6", "8", "10", "12", "14", "18", "28"] : Array(8).fill("12.5");
const whiteSignWeights = variedMode ? ["3", "7", "9", "11", "13", "15", "19", "23"] : Array(8).fill("12.5");
const lotteryWeightConfigWeights = ["5", "8", "10", "12", "13", "15", "17", "20"];

const browser = await chromium.launch({
  headless: false,
  executablePath: config.chromePath,
  slowMo: 120,
  args: ["--window-size=1440,1000"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let authHeader = "";
page.on("response", response => {
  if (response.url().includes("/prod-api/common/upload")) evidence.uploads += 1;
});
page.on("request", request => {
  if (request.url().includes("/prod-api/activity/config/list")) authHeader = request.headers().authorization || authHeader;
});

const wait = ms => page.waitForTimeout(ms);
async function formItem(label, nth = 0) {
  return page
    .locator(`xpath=(//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.), "${label}")]])`)
    .nth(nth);
}

async function visibleOptionBox(text = null, index = 0) {
  return page.evaluate(({ text, index }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
    if (!dropdown) return null;
    const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
    const item = text ? items.find(option => option.innerText.trim().includes(text)) : items[index];
    if (!item) return null;
    const rect = item.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: item.innerText.trim() };
  }, { text, index });
}

async function clickOption(option) {
  await page.mouse.click(option.x, option.y);
  await wait(250);
}

async function clickRadio(label, option, nth = 0) {
  const box = await page.evaluate(({ label, option, nth }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const items = [...document.querySelectorAll(".el-form-item")]
      .filter(visible)
      .filter(item => item.querySelector(".el-form-item__label")?.innerText?.trim().includes(label));
    const item = items[nth];
    if (!item) return { missing: true };
    item.scrollIntoView({ block: "center", inline: "nearest" });
    const radio = [...item.querySelectorAll(".el-radio")]
      .filter(visible)
      .find(element => element.innerText.trim() === option);
    if (!radio) return { missing: true };
    if (radio.getAttribute("aria-checked") === "true") return { checked: true };
    if (radio.classList.contains("is-disabled")) return { checked: radio.classList.contains("is-checked"), disabled: true };
    const rect = radio.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, { label, option, nth });
  if (box?.missing) throw new Error(`radio missing: ${label} ${option}`);
  if (box?.checked) return;
  if (box?.disabled) return;
  await page.mouse.click(box.x, box.y);
  await wait(250);
}

async function ensurePreApplySupport() {
  await clickRadio("是否支持预报名", "支持");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await formItem("预报名模版").then(locator => locator.count()).catch(() => 0)) return;
    await page.evaluate(() => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const item = [...document.querySelectorAll(".el-form-item")]
        .filter(visible)
        .find(element => element.querySelector(".el-form-item__label")?.innerText?.trim().includes("是否支持预报名"));
      item?.scrollIntoView({ block: "center", inline: "nearest" });
      const radio = [...(item?.querySelectorAll(".el-radio") || [])]
        .filter(visible)
        .find(element => element.innerText.trim().includes("支持") && !element.innerText.trim().includes("不支持"));
      radio?.click();
    });
    await wait(800);
  }
  if (!(await formItem("预报名模版").then(locator => locator.count()).catch(() => 0))) {
    throw new Error("pre apply fields did not expand");
  }
}

async function fillControl(locator, value) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.waitFor({ state: "visible", timeout: 7000 }).catch(() => {});
  await locator.fill(String(value), { timeout: 7000 }).catch(async () => {
    await locator.click({ force: true, timeout: 7000 });
    await page.keyboard.type(String(value), { delay: 8 });
  });
  await wait(120);
}

async function fillLabel(label, value, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  await fillControl(item.locator("input:not([type=radio]):not([type=checkbox]), textarea").first(), value);
}

async function fillRich(label, value, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  const editor = item.locator(".ql-editor").first();
  await editor.click({ force: true, timeout: 7000 });
  await editor.evaluate((element, text) => {
    element.innerHTML = "";
    element.textContent = text;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
  await wait(120);
}

async function selectLabel(label, text = null, nth = 0, index = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  const select = item.locator(".el-select").first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const box = await select.boundingBox();
    if (!box) throw new Error(`select missing: ${label}`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await wait(450);
    let option = await visibleOptionBox(text, index);
    if (!option && text) option = await visibleOptionBox(null, index);
    if (option) {
      await clickOption(option);
      await page.keyboard.press("Escape").catch(() => {});
      return option.label;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await wait(200);
  }
  throw new Error(`option missing: ${label}`);
}

async function uploadLabel(label, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  await item.locator("input[type=file]").first().setInputFiles(config.imagePath);
  await wait(650);
}

async function clickButton(text, nth = 0) {
  const button = page.locator("button:visible").filter({ hasText: text }).nth(nth);
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click({ timeout: 8000 });
  await wait(450);
}

async function scrollText(text) {
  await page.locator(`text=${text}`).first().scrollIntoViewIfNeeded().catch(() => {});
  await wait(300);
}

async function openLotteryViaMenu() {
  await loginToPrizePage(page, config);
  await wait(1000);
  if (!(await page.locator("text=转盘抽奖").first().isVisible().catch(() => false))) {
    await page.locator("text=活动列表").first().click();
  }
  await wait(400);
  await page.locator("text=转盘抽奖").first().click();
  await page.waitForURL(/\/activities\/lottery/, { timeout: 15000 }).catch(() => {});
  await wait(1200);
}

async function clickPrize(rowIndex) {
  const tableLocator = page.locator(".el-table").filter({ hasText: "奖品池ID" }).first();
  const rowLocator = tableLocator.locator(".el-table__body-wrapper tbody tr").nth(rowIndex);
  const selectLocator = rowLocator.locator(".el-select").nth(1);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await rowLocator.scrollIntoViewIfNeeded().catch(() => {});
    await selectLocator.click({ force: true, timeout: 5000 }).catch(async () => {
      const box = await page.evaluate(index => {
        const visible = element => !!element && element.getClientRects().length
          && getComputedStyle(element).display !== "none"
          && getComputedStyle(element).visibility !== "hidden";
        const table = [...document.querySelectorAll(".el-table")]
          .filter(visible)
          .find(element => /奖品池ID|奖品名称/.test(element.innerText));
        if (!table) return null;
        const row = [...table.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible)[index];
        if (!row) return null;
        row.scrollIntoView({ block: "center", inline: "nearest" });
        const select = [...row.querySelectorAll(".el-select")].filter(visible)[1];
        if (!select) return null;
        const rect = select.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }, rowIndex);
      if (box) await page.mouse.click(box.x, box.y);
    });
    await wait(450);
    const options = page.locator(".el-select-dropdown:visible .el-select-dropdown__item:not(.is-disabled)");
    if (await options.count()) {
      await options.first().click({ force: true });
      await wait(180);
      await page.keyboard.press("Escape").catch(() => {});
      await wait(120);
      return;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await wait(180);
  }
  throw new Error(`prize dropdown missing row ${rowIndex + 1}`);
}

async function prizeTableBox() {
  return page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    return Boolean(table);
  });
}

async function setPrizeScroll(left) {
  await page.evaluate(value => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    table?.querySelector(".el-table__body-wrapper")?.scrollTo({ left: value });
    table?.querySelector(".el-table__header-wrapper")?.scrollTo({ left: value });
  }, left);
  await wait(250);
}

async function fillPrizeCell(rowIndex, cellIndex, value) {
  const input = await page.evaluateHandle(({ rowIndex, cellIndex }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[rowIndex];
    const cell = [...(row?.querySelectorAll("td") || [])].filter(visible)[cellIndex];
    const input = [...(cell?.querySelectorAll("input:not([type=checkbox])") || [])].filter(visible)[0];
    if (!input) return null;
    input.scrollIntoView({ block: "center", inline: "center" });
    return input;
  }, { rowIndex, cellIndex });
  const element = input.asElement();
  if (!element) throw new Error(`prize input missing row ${rowIndex + 1} cell ${cellIndex}`);
  await element.fill(String(value), { timeout: 5000 });
  await wait(80);
}

async function uploadPrizeImage(rowIndex) {
  const input = await page.evaluateHandle(index => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[index];
    return row?.querySelector("input[type=file]") || null;
  }, rowIndex);
  const element = input.asElement();
  if (!element) throw new Error(`prize image input missing row ${rowIndex + 1}`);
  await element.setInputFiles(config.imagePath);
  await wait(180);
}

async function selectPrizeMark(rowIndex, text) {
  const box = await page.evaluate(index => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[index];
    const input = row?.querySelector('input[placeholder="请选择奖品标记"]');
    if (!input) return null;
    input.scrollIntoView({ block: "center", inline: "center" });
    const rect = input.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, rowIndex);
  if (!box) throw new Error(`prize mark select missing row ${rowIndex + 1}`);
  await page.mouse.click(box.x, box.y);
  await wait(250);
  const option = await visibleOptionBox(text, 0);
  if (!option) throw new Error(`prize mark option missing: ${text}`);
  await clickOption(option);
}

async function fillPrizeRows() {
  await scrollText("抽奖奖品配置");
  if (!(await prizeTableBox())) throw new Error("prize table missing");
  for (let index = 0; index < 8; index += 1) {
    await clickPrize(index);
    await fillPrizeCell(index, 4, prizeAmounts[index]);
    await fillPrizeCell(index, 5, prizeStocks[index]);
    await uploadPrizeImage(index);
  }
  await setPrizeScroll(1000);
  const marks = ["大奖", "中奖", "小奖", "中奖", "小奖", "中奖", "小奖", "中奖"];
  for (let index = 0; index < 8; index += 1) {
    await fillPrizeCell(index, 7, prizeWeights[index]);
    await selectPrizeMark(index, marks[index]);
  }
  await setPrizeScroll(0);
}

async function fillTableWeightsByMarker(marker, values = Array(8).fill("12.5")) {
  await scrollText(marker);
  const table = page.locator(".el-table").filter({ hasText: marker }).first();
  const rowCount = await table.locator(".el-table__body-wrapper tbody tr").count();
  for (let index = 0; index < rowCount; index += 1) {
    await fillControl(table.locator(".el-table__body-wrapper tbody tr").nth(index).locator("input:not([type=checkbox])").last(), values[index] || "0");
  }
}

async function clickWeightConfigCheckbox(text) {
  const clicked = await page.evaluate(labelText => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dialog = [...document.querySelectorAll(".el-dialog__wrapper")].filter(visible).pop();
    const checkbox = [...(dialog?.querySelectorAll(".el-checkbox") || [])]
      .filter(visible)
      .find(element => element.innerText.trim() === labelText);
    if (!checkbox) return false;
    if (!checkbox.classList.contains("is-checked")) checkbox.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`weight config checkbox missing: ${text}`);
  await wait(250);
}

async function selectWeightConfigVipLevels() {
  for (let index = 0; index < 2; index += 1) {
    const box = await page.evaluate(selectIndex => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const dialog = [...document.querySelectorAll(".el-dialog__wrapper")].filter(visible).pop();
      const table = [...(dialog?.querySelectorAll(".el-table") || [])]
        .filter(visible)
        .find(element => /VIP等级/.test(element.innerText));
      const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[0];
      const selects = [...(row?.querySelectorAll(".el-select") || [])].filter(visible);
      const select = selects[selectIndex];
      if (!select) return null;
      select.scrollIntoView({ block: "center", inline: "center" });
      const rect = select.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, index);
    if (!box) throw new Error(`VIP level select missing: ${index + 1}`);
    await page.mouse.click(box.x, box.y);
    await wait(350);
    const option = await visibleOptionBox(null, 0);
    if (!option) throw new Error(`VIP level option missing: ${index + 1}`);
    await clickOption(option);
  }
}

async function fillWeightConfigPrizeWeights(values = lotteryWeightConfigWeights) {
  for (let index = 0; index < 8; index += 1) {
    const input = await page.evaluateHandle(inputIndex => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const dialog = [...document.querySelectorAll(".el-dialog__wrapper")].filter(visible).pop();
      const table = [...(dialog?.querySelectorAll(".el-table") || [])]
        .filter(visible)
        .find(element => /VIP等级/.test(element.innerText));
      const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[0];
      const cells = [...(row?.querySelectorAll("td") || [])].filter(visible);
      const weightCell = cells.find(cell => cell.querySelectorAll("input:not([disabled])").length >= 8) || cells[4];
      return [...(weightCell?.querySelectorAll("input:not([type=checkbox])") || [])].filter(visible)[inputIndex] || null;
    }, index);
    const element = input.asElement();
    if (!element) throw new Error(`weight config prize weight missing ${index + 1}`);
    await element.fill(values[index], { timeout: 5000 });
    await wait(70);
  }
}

async function fillLotteryWeightConfig() {
  await scrollText("抽奖权重配置");
  await page.locator("text=未配置").first().click({ force: true });
  await wait(800);
  await clickWeightConfigCheckbox("VIP");
  await page.locator(".el-dialog__wrapper:visible button:visible").filter({ hasText: "添加" }).first().click();
  await wait(800);
  await selectWeightConfigVipLevels();
  await fillWeightConfigPrizeWeights();
  await page.locator(".el-dialog__wrapper:visible button:visible").filter({ hasText: "隐藏" }).first().click();
  await wait(800);
}

async function fillShareInfo() {
  await scrollText("配置分享信息");
  for (let index = 1; index <= 8; index += 1) {
    await page.locator(".el-tabs__item").filter({ hasText: `奖品(${index})` }).last().click({ force: true });
    await wait(350);
    const pane = page.locator(".el-tab-pane:visible").filter({ hasText: "奖品名称" }).first();
    await pane.locator("input[type=file]").first().setInputFiles(config.imagePath);
    await wait(450);
    await fillControl(pane.locator(".el-form-item").filter({ hasText: "分享文案" }).locator("input,textarea").first(), `奖品${index} 分享文案`);
    await fillControl(pane.locator(".el-form-item").filter({ hasText: "奖品名称" }).locator("input,textarea").first(), `奖品${index}`);
  }
}

async function fillDailyLimit() {
  await scrollText("奖品每日限制配置");
  const row = page.locator(".el-table").filter({ hasText: "奖励开始后+N" }).first().locator(".el-table__body-wrapper tbody tr").first();
  await fillControl(row.locator("input").nth(0), "1");
  await fillControl(row.locator("input").nth(1), "1");
  await fillControl(row.locator("input").nth(2), "100");
}

async function fillProbability() {
  await fillLabel("累计抽奖次数", "5");
  await clickButton("添加");
  await wait(800);
  const rowCount = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /累计抽奖次数N/.test(element.innerText));
    return [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible).length;
  });
  for (let index = 0; index < Math.min(rowCount, 8); index += 1) {
    const input = await page.evaluateHandle(rowIndex => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")]
        .filter(visible)
        .find(element => /累计抽奖次数N/.test(element.innerText));
      const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[rowIndex];
      const cell = [...(row?.querySelectorAll("td") || [])].filter(visible)[2];
      return cell?.querySelector("input:not([type=radio]):not([type=checkbox])") || null;
    }, index);
    const element = input.asElement();
    if (!element) throw new Error(`probability weight input missing row ${index + 1}`);
    await element.fill(prizeWeights[index] || "0", { timeout: 5000 });
    await wait(80);
  }
}

async function enableBeginnerContractTask() {
  await scrollText("活动任务信息");
  const clicked = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const target = [...document.querySelectorAll(".el-switch")]
      .filter(visible)
      .find(element => element.innerText.includes("启用新手活动合约任务"));
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "nearest" });
    if (!target.classList.contains("is-checked")) target.click();
    return true;
  });
  if (!clicked) throw new Error("beginner task switch missing");
  await wait(800);
  const table = page.locator(".el-table").filter({ hasText: "排序系数" }).last();
  const rowCount = await table.locator(".el-table__body-wrapper tbody tr").count();
  for (let index = 0; index < rowCount; index += 1) {
    await fillControl(table.locator(".el-table__body-wrapper tbody tr").nth(index).locator("input:not([type=checkbox])").last(), String(index + 1)).catch(() => {});
  }
}

async function fillTask() {
  await scrollText("活动任务信息");
  await selectLabel("活动任务", null, 0, 0).catch(async () => {
    const select = page.locator("xpath=(//*[contains(normalize-space(.),'活动任务信息')]/following::div[contains(@class,'el-select')])[1]");
    const box = await select.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await wait(450);
      const option = await visibleOptionBox(null, 0);
      if (option) await clickOption(option);
    }
  });
  await page.locator("xpath=(//*[contains(normalize-space(.),'活动任务信息')]/following::*[contains(@class,'el-icon-plus')])[1]").click({ force: true }).catch(() => {});
  await wait(700);
  await fillControl(page.locator(".el-table").filter({ hasText: "排序系数" }).last().locator(".el-table__body-wrapper tbody tr").first().locator("input").last(), "1").catch(() => {});
  if (enableBeginnerTask) await enableBeginnerContractTask();
}

async function fillI18n() {
  await scrollText("多语言");
  await page.locator("xpath=(//*[contains(normalize-space(.),'多语言')]/following::label[contains(@class,'el-checkbox')][contains(.,'英语')])[1]").click({ force: true }).catch(() => {});
  await wait(600);
  await fillLabel("活动标题", `EN ${title}`, 1).catch(() => {});
  await fillLabel("活动副标题", "EN subtitle", 1).catch(() => {});
  for (const label of ["WEB头图上传", "H5头图上传", "web分享图上传", "H5分享图片上传"]) {
    await uploadLabel(label, 1).catch(() => {});
  }
  await fillLabel("分享活动文案", "EN share copy", 1).catch(() => {});
  await fillLabel("代理分享文案", "EN agent copy", 1).catch(() => {});
  await fillRich("活动规则", "EN activity rules.", 1).catch(() => {});
}

async function fillFaq() {
  await scrollText("常见问题");
  await page.locator("xpath=(//*[contains(normalize-space(.),'常见问题')]/following::label[contains(@class,'el-checkbox')][contains(.,'英语')])[1]").click({ force: true }).catch(() => {});
  await wait(650);
  const faqCard = page.locator(".el-card").filter({ hasText: "常见问题" }).first();
  await fillControl(faqCard.locator('input[placeholder="请输入标题"]').first(), "FAQ title");
  await fillControl(faqCard.locator(".ql-editor").first(), "FAQ content");
}

async function fillCalendar() {
  await scrollText("活动日历");
  await clickRadio("同步到活动日历", "同步");
  await wait(700);
  await selectLabel("所属一级筛选标签", null, 0, 0).catch(() => {});
  await selectLabel("所属二级筛选标签", null, 0, 0).catch(() => {});
  await uploadLabel("配图", 0).catch(() => {});
  await uploadLabel("小图标", 0).catch(() => {});
  await selectLabel("所属分区", null, 0, 0).catch(() => {});
  await page.locator("button").filter({ hasText: "新增" }).last().click().catch(() => {});
  await wait(600);
}

try {
  console.log(JSON.stringify({ step: "start", title, alias }));
  await openLotteryViaMenu();
  await clickButton("新增");
  await page.waitForURL(/\/activities\/lottery\/add/, { timeout: 15000 });
  await wait(3000);

  console.log(JSON.stringify({ step: "basic" }));
  await clickRadio("配置类型", "正式活动");
  await fillLabel("负责人", config.username || "auto");
  await selectLabel("类别配置", "通用");
  await selectLabel("流程引导配置", null, 0, 0);
  await clickRadio("是否为平台活动", "否");
  await fillLabel("活动标题", title, 0);
  await fillLabel("活动副标题", "严格 UI 复杂配置副标题", 0);
  await fillLabel("活动开始时间", "2026-06-10 00:00:00");
  await fillLabel("活动结束时间", "2026-06-30 23:59:59");
  await selectLabel("用户报名模版", null, 0, 0);
  for (const label of ["WEB头图上传", "H5头图上传", "web分享图上传", "H5分享图片上传", "社媒活动预览图上传"]) await uploadLabel(label, 0);
  await fillLabel("分享活动文案", "严格 UI 分享活动文案", 0);
  await fillLabel("代理分享文案", "严格 UI 代理分享文案", 0);
  await fillRich("活动规则", "严格 UI 活动规则：完成转盘抽奖复杂配置验证。", 0);
  await fillLabel("活动别名配置", alias);
  await ensurePreApplySupport();
  await selectLabel("预报名模版", null, 0, 0);
  await fillLabel("预报名开始时间", "2026-06-01 00:00:00");
  await fillLabel("预报名结束时间", "2026-06-09 23:59:59");
  await clickRadio("是否显示活动日历入口", "是");
  await selectLabel("抽奖样式", "圆形转盘").catch(() => {});

  console.log(JSON.stringify({ step: "prizes" }));
  await fillPrizeRows();
  console.log(JSON.stringify({ step: "prizes_done", count: 8 }));
  if (weightConfigMode) {
    console.log(JSON.stringify({ step: "lottery_weight_config" }));
    await fillLotteryWeightConfig();
  }
  console.log(JSON.stringify({ step: "color_tags" }));
  await fillTableWeightsByMarker("红签", redSignWeights);
  await fillTableWeightsByMarker("白签", whiteSignWeights);
  console.log(JSON.stringify({ step: "share" }));
  await fillShareInfo();
  console.log(JSON.stringify({ step: "daily" }));
  await fillDailyLimit();
  console.log(JSON.stringify({ step: "probability" }));
  await fillProbability();
  console.log(JSON.stringify({ step: "task" }));
  await fillTask();
  console.log(JSON.stringify({ step: "i18n" }));
  await fillI18n();
  console.log(JSON.stringify({ step: "faq" }));
  await fillFaq();
  console.log(JSON.stringify({ step: "calendar" }));
  await fillCalendar();

  console.log(JSON.stringify({ step: "submit" }));
  const createPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config") && response.request().method() === "POST"
  ), { timeout: 25000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight));
  await wait(700);
  const submitBox = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const buttons = [...document.querySelectorAll("button")]
      .filter(button => visible(button) && button.innerText.trim() === "新增")
      .map(button => {
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, bottom: rect.bottom };
      })
      .sort((a, b) => b.bottom - a.bottom);
    return buttons[0] || null;
  });
  if (!submitBox) throw new Error("submit button not found");
  await page.mouse.click(submitBox.x, submitBox.y);
  const createResponse = await createPromise;
  let createBody = null;
  if (createResponse) {
    try { createBody = await createResponse.json(); } catch {}
  }
  await wait(2500);
  const errors = await page.evaluate(() => {
    const formErrors = [...document.querySelectorAll(".el-form-item.is-error")].map(item => ({
      label: item.querySelector(".el-form-item__label")?.innerText?.trim() || "",
      error: item.querySelector(".el-form-item__error")?.innerText?.trim() || "",
      text: item.innerText.trim().slice(0, 120),
    }));
    const messages = [...document.querySelectorAll(".el-message,.el-message-box,.el-notification")]
      .map(element => element.innerText.trim())
      .filter(Boolean);
    return { formErrors: formErrors.slice(0, 80), messages: messages.slice(0, 20) };
  });
  await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
  await wait(1800);
  const aliasItem = await formItem("活动别名");
  await fillControl(aliasItem.locator("input").first(), alias);
  await page.locator("button:visible").filter({ hasText: "查询" }).first().click();
  await wait(1500);
  let verify = null;
  if (authHeader) {
    verify = await page.evaluate(async ({ activityAlias, authHeader }) => {
      const response = await fetch(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(activityAlias)}`, {
        headers: { Authorization: authHeader },
        credentials: "include",
      });
      return response.json();
    }, { activityAlias: alias, authHeader });
  }
  console.log(JSON.stringify({
    ok: createBody?.code === 200 || verify?.total === 1,
    title,
    alias,
    finalUrl: page.url(),
    createStatus: createResponse?.status?.(),
    createBody,
    errors,
    verifyTotal: verify?.total,
    verifyFirst: verify?.rows?.[0] || verify?.data?.[0],
    uploads: evidence.uploads,
  }, null, 2));
  await wait(5000);
  if (!(createBody?.code === 200 || verify?.total === 1)) process.exitCode = 1;
} catch (error) {
  const errors = await page.evaluate(() => {
    const formErrors = [...document.querySelectorAll(".el-form-item.is-error")].map(item => ({
      label: item.querySelector(".el-form-item__label")?.innerText?.trim() || "",
      error: item.querySelector(".el-form-item__error")?.innerText?.trim() || "",
      text: item.innerText.trim().slice(0, 120),
    }));
    const messages = [...document.querySelectorAll(".el-message,.el-message-box,.el-notification")]
      .map(element => element.innerText.trim())
      .filter(Boolean);
    return { formErrors: formErrors.slice(0, 80), messages: messages.slice(0, 20) };
  }).catch(() => []);
  console.error(JSON.stringify({ ok: false, error: error.message, url: page.url(), title, alias, errors, uploads: evidence.uploads }, null, 2));
  await wait(5000).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}

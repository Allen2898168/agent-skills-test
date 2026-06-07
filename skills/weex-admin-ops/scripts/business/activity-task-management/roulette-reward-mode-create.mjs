import { bodyText, sleep } from "../../lib/browser.mjs";
import {
  clickVisibleDialogText as clickDialogText,
  dialog,
  fillLabel,
  selectFirstByLabel,
  selectFirstOpenOption,
  selectOpenOption,
  selectOptionByLabel,
  selectPlaceholder,
  visibleFormErrors,
} from "../../lib/element-ui.mjs";
import { fillEnglishIfVisible, fillRewardRange, firstNumericCell, searchTaskByName } from "./roulette-participant-ui.mjs";
import { rowToTask } from "./search.mjs";

export async function createRouletteRewardModeTasks(page, config, plan) {
  const created = [];
  for (const task of plan) created.push(await createOneRewardModeTask(page, config, task));
  return created;
}

async function createOneRewardModeTask(page, config, task) {
  await page.goto(`${config.baseUrl}/activity/task`, { waitUntil: "domcontentloaded" });
  await sleep(1400);
  await page.locator('button:has-text("新增")').first().click();
  await dialog(page);
  await selectPlaceholder(page, "活动类型", "转盘抽奖");
  await fillBaseText(page, task);
  await clickDialogText(page, "报名的所有用户");
  await fillCommonTaskConfig(page, task);
  await fillRewardMode(page, task);
  const submit = await submitTask(page, task.name);
  const row = await searchTaskByName(page, config, task.name);
  const parsedRow = rowToTask(row);
  return {
    id: firstNumericCell(row),
    name: task.name,
    tag: task.tag,
    remark: task.remark,
    scope: "报名的所有用户",
    taskCondition: task.taskCondition,
    rewardMode: task.rewardMode,
    rewardMin: task.rewardMin,
    rewardMax: task.rewardMax,
    submit,
    updatedAt: parsedRow.updatedAt || "",
    row,
  };
}

async function fillBaseText(page, task) {
  await fillLabel(page, "任务名称", task.name);
  await fillLabel(page, "任务内容", task.content);
  await fillLabel(page, "任务标签", task.tag);
  await fillLabel(page, "任务备注", task.remark);
  await fillEnglishIfVisible(page, task);
}

async function fillCommonTaskConfig(page, task) {
  await clickDialogText(page, "不审核KYC");
  await ensureTaskCombo(page);
  await selectOptionByLabel(page, "任务条件1", task.taskCondition);
  await clickDialogText(page, "报名活动后");
  await clickDialogText(page, "仅1次，直至结束");
  await clickDialogText(page, task.rewardMode);
  await fillLabel(page, "每日领奖人数上限", task.dailyLimit);
  await fillLabel(page, "总领奖人数上限", task.totalLimit);
}

async function fillRewardMode(page, task) {
  if (task.rewardMode === "限时奖励不同") {
    await fillLimitedRewardMode(page, task);
    return;
  }
  if (task.rewardMode === "正常奖励+权益奖励") {
    await fillRightsRewardMode(page, task);
    return;
  }
  throw new Error(`Unsupported reward mode plan: ${task.rewardMode}`);
}

async function fillLimitedRewardMode(page, task) {
  await selectFirstByLabel(page, "限时奖励");
  await fillFirstEditableInputByLabel(page, "限时奖励", task.rewardValue);
  await clickDialogText(page, task.limitedStartTime);
  await fillLabel(page, "奖励变化倒计时", task.rewardCountdown);
  await selectExactOptionByLabel(page, "奖励变化", task.rewardChange);
  await fillEditableInputByPlaceholder(page, "请输入奖励变化值", task.rewardChangeValue);
}

async function fillRightsRewardMode(page, task) {
  await selectFirstByLabel(page, "正常奖励");
  await fillRewardRange(page, task.rewardMin, task.rewardMax);
  await selectOptionByLabel(page, "权益奖励类型", task.rightsType);
  await selectOptionByPlaceholder(page, "请选择权益奖励子类型", task.rightsSubtype);
  await selectOptionByPlaceholder(page, "请选择VIP奖励名称", "__first__");
}

async function ensureTaskCombo(page) {
  if (await optionalClickDialogText(page, "单一任务条件")) return;
  const selectedByLabel = await selectFirstByLabel(page, "任务组合", false, true).catch(() => null);
  if (selectedByLabel) return;
  const selectedByPlaceholder = await selectTaskComboByPlaceholder(page);
  if (selectedByPlaceholder) return;
}

async function selectTaskComboByPlaceholder(page) {
  const opened = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const input = [...document.querySelectorAll('input[placeholder*="请选择任务"]')]
      .filter(visible)
      .at(-1);
    if (!input) return false;
    const select = input.closest(".el-select") || input;
    select.click();
    return true;
  }).catch(() => false);
  if (!opened) return null;
  await sleep(500);
  return selectFirstOpenOption(page, false, true);
}

async function optionalClickDialogText(page, text) {
  try {
    await clickDialogText(page, text);
    return true;
  } catch {
    return false;
  }
}

async function selectExactOptionByLabel(page, label, option) {
  const opened = await page.evaluate(targetLabel => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1) || document;
    const item = [...root.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(candidate => norm(candidate.querySelector(".el-form-item__label")?.innerText || "") === norm(targetLabel));
    const select = item?.querySelector(".el-select");
    if (!select) return false;
    select.click();
    return true;
  }, label).catch(() => false);
  if (!opened) throw new Error(`Exact label select not found: ${label}`);
  await sleep(500);
  const selected = await selectOpenOption(page, option, false, true);
  if (!selected) throw new Error(`Exact label option not found: ${label} -> ${option}`);
  return selected;
}

async function fillFirstEditableInputByLabel(page, label, value) {
  const filled = await page.evaluate(({ label, value }) => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1) || document;
    const item = [...root.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(candidate => norm(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(norm(label)));
    const input = [...(item?.querySelectorAll('input:not([readonly]):not([type="radio"]):not([type="checkbox"]), textarea') || [])]
      .filter(visible)[0];
    if (!input) return false;
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { label, value: String(value) });
  if (!filled) throw new Error(`Editable input not found for label: ${label}`);
  await sleep(150);
}

async function fillLastEditableInputByLabel(page, label, value) {
  const filled = await page.evaluate(({ label, value }) => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1) || document;
    const item = [...root.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(candidate => norm(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(norm(label)));
    const inputs = [...(item?.querySelectorAll('input:not([readonly]):not([type="radio"]):not([type="checkbox"]), textarea') || [])]
      .filter(visible);
    const input = inputs.at(-1);
    if (!input) return false;
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { label, value: String(value) });
  if (!filled) throw new Error(`Trailing editable input not found for label: ${label}`);
  await sleep(150);
}

async function fillEditableInputByPlaceholder(page, placeholder, value) {
  const filled = await page.evaluate(({ placeholder, value }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const input = [...document.querySelectorAll("input, textarea")]
      .filter(visible)
      .find(element => (element.getAttribute("placeholder") || "") === placeholder);
    if (!input) return false;
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { placeholder, value: String(value) });
  if (!filled) throw new Error(`Editable input not found for placeholder: ${placeholder}`);
  await sleep(150);
}

async function selectNthOptionByLabel(page, label, selectIndex, option) {
  const opened = await page.evaluate(({ label, selectIndex }) => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1) || document;
    const item = [...root.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(candidate => norm(candidate.querySelector(".el-form-item__label")?.innerText || "") === norm(label));
    const target = [...(item?.querySelectorAll(".el-select") || [])].filter(visible)[selectIndex];
    if (!target) return false;
    target.click();
    return true;
  }, { label, selectIndex }).catch(() => false);
  if (!opened) throw new Error(`Select not found for label/index: ${label}#${selectIndex}`);
  await sleep(500);
  if (option === "__first__") {
    const selected = await selectFirstOpenOption(page, false, true);
    if (!selected) throw new Error(`First option not found for label/index: ${label}#${selectIndex}`);
    return selected;
  }
  const selected = await selectOpenOption(page, option, false, true);
  if (!selected) throw new Error(`Option not found for label/index: ${label}#${selectIndex} -> ${option}`);
  return selected;
}

async function selectOptionByPlaceholder(page, placeholder, option) {
  const opened = await page.evaluate(targetPlaceholder => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const input = [...document.querySelectorAll("input")]
      .filter(visible)
      .find(element => (element.getAttribute("placeholder") || "") === targetPlaceholder);
    if (!input) return false;
    const select = input.closest(".el-select") || input;
    select.click();
    return true;
  }, placeholder).catch(() => false);
  if (!opened) throw new Error(`Select not found for placeholder: ${placeholder}`);
  await sleep(500);
  if (option === "__first__") {
    const selected = await selectFirstOpenOption(page, false, true);
    if (!selected) throw new Error(`First option not found for placeholder: ${placeholder}`);
    return selected;
  }
  const selected = await selectOpenOption(page, option, false, true);
  if (!selected) throw new Error(`Option not found for placeholder: ${placeholder} -> ${option}`);
  return selected;
}

async function submitTask(page, name) {
  const submitPromise = page.waitForResponse(
    r => r.url().includes("/prod-api/activity/task") && r.request().method() === "POST",
    { timeout: 15000 },
  ).catch(() => null);
  const d = await dialog(page);
  await d.locator('button:has-text("确认")').last().click();
  const response = await submitPromise;
  await sleep(2200);
  const errors = await visibleFormErrors(page);
  const text = await bodyText(page);
  if (errors.length || !response) {
    throw new Error(`Submit not accepted for ${name}: ${JSON.stringify({ status: response?.status() || null, errors, text: text.slice(0, 500) })}`);
  }
  const body = await response.json().catch(() => ({}));
  if (response.status() >= 400 || body.code !== 200) throw new Error(`Submit failed: ${JSON.stringify({ status: response.status(), body })}`);
  return { status: response.status(), body };
}

import { bodyText, sleep } from "../../lib/browser.mjs";
import {
  clickVisibleDialogText as clickDialogText,
  dialog,
  fillLabel,
  selectFirstByLabel,
  selectFirstOpenOption,
  selectOptionByLabel,
  selectPlaceholder,
  visibleFormErrors,
} from "../../lib/element-ui.mjs";
import { fillEnglishIfVisible, fillRewardRange, firstNumericCell, searchTaskByName } from "./roulette-participant-ui.mjs";
import { rowToTask } from "./search.mjs";

export async function createRouletteConditionTasks(page, config, plan) {
  const created = [];
  for (const task of plan) {
    try {
      created.push(await createOneConditionTask(page, config, task));
    } catch (error) {
      if (!task.allowFailure) throw error;
      created.push({
        name: task.name,
        tag: task.tag,
        remark: task.remark,
        scope: "报名的所有用户",
        taskCondition: task.taskCondition,
        rewardMode: task.rewardMode,
        rewardMin: task.rewardMin,
        rewardMax: task.rewardMax,
        blocked: true,
        error: error.message,
      });
    }
  }
  return created;
}

async function createOneConditionTask(page, config, task) {
  await page.goto(`${config.baseUrl}/activity/task`, { waitUntil: "domcontentloaded" });
  await sleep(1400);
  await page.locator('button:has-text("新增")').first().click();
  await dialog(page);
  await selectPlaceholder(page, "活动类型", "转盘抽奖");
  await fillBaseText(page, task);
  await clickDialogText(page, "报名的所有用户");
  await fillConditionTaskConfig(page, task);
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

async function fillConditionTaskConfig(page, task) {
  await clickDialogText(page, "不审核KYC");
  await ensureTaskCombo(page);
  await selectOptionByLabel(page, "任务条件1", task.taskCondition);
  await fillTaskConditionExtra(page, task);
  await clickDialogText(page, task.judgeStart || "报名活动后");
  await clickDialogText(page, task.updateMode || "仅1次，直至结束");
  await clickDialogText(page, task.rewardMode || "单一奖励");
  await selectFirstByLabel(page, task.rewardType || "正常奖励");
  await fillRewardRange(page, task.rewardMin, task.rewardMax);
  await fillConditionLateBindings(page, task);
  await fillLabel(page, "每日领奖人数上限", task.dailyLimit);
  await fillLabel(page, "总领奖人数上限", task.totalLimit);
}

async function fillTaskConditionExtra(page, task) {
  if (task.taskCondition === "KOL绑定") return;
  if (task.compareValue) {
    await selectFirstOptionByExactPlaceholder(page, "请选择比较类型");
    await fillEditableInputByPlaceholder(page, "请输入数值", task.compareValue);
  }
  if (task.taskCondition === "合约交易量") {
    await clickDialogText(page, "全部币对");
    await clickDialogText(page, "有手续费订单");
    await selectFirstByLabel(page, "下单方式", false, true).catch(() => null);
    return;
  }
  if (task.taskCondition === "现货交易量") {
    await clickDialogText(page, "全部币对");
    await clickDialogText(page, task.firstTrade || "否");
    return;
  }
  if (task.taskCondition === "充值任务") {
    await clickDialogText(page, task.firstRecharge || "否");
    await fillSingleInputByLabel(page, "资金沉淀天数", task.freezeDays || "1");
  }
}

async function fillConditionLateBindings(page, task) {
  if (task.taskCondition !== "现货交易量") return;
  const clicked = await optionalClickDialogText(page, "有手续费订单");
  if (clicked) return;
  await bindSpotVolumeCountType(page, ["FEE"]);
}

async function optionalClickDialogText(page, text) {
  try {
    await clickDialogText(page, text);
    return true;
  } catch {
    return false;
  }
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

async function selectFirstOptionByExactPlaceholder(page, placeholder) {
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
  const selected = await selectFirstOpenOption(page, false, true);
  if (!selected) throw new Error(`First option not found for placeholder: ${placeholder}`);
  return selected;
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

async function fillSingleInputByLabel(page, label, value) {
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

async function waitForDialogText(page, text) {
  await page.waitForFunction(targetText => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1) || document;
    return (root.innerText || "").includes(targetText);
  }, text, { timeout: 5000 });
}

async function bindSpotVolumeCountType(page, values) {
  const changed = await page.evaluate(nextValues => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const root = [...document.querySelectorAll(".el-dialog")].filter(visible).at(-1) || document;
    let count = 0;
    for (const form of [...root.querySelectorAll(".el-form")].filter(visible)) {
      const vm = form.__vue__;
      const model = vm?.model || vm?._props?.model || vm?.$attrs?.model;
      if (!model || typeof model !== "object") continue;
      model.volumeCountType = [...nextValues];
      count += 1;
      if (Array.isArray(model.requirement) && model.requirement[0] && typeof model.requirement[0] === "object") {
        model.requirement[0].volumeCountType = [...nextValues];
        count += 1;
      }
    }
    root.dispatchEvent(new Event("input", { bubbles: true }));
    root.dispatchEvent(new Event("change", { bubbles: true }));
    return count;
  }, values);
  if (!changed) throw new Error("Spot volumeCountType model was not bound");
  await sleep(200);
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

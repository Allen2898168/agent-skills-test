import { bodyText, sleep } from "../../lib/browser.mjs";
import { clickVisibleDialogText as clickDialogText, dialog, fillLabel, selectFirstByLabel, selectOptionByLabel, selectPlaceholder, visibleFormErrors } from "../../lib/element-ui.mjs";
import { fillEnglishIfVisible, fillRewardRange, firstNumericCell, searchTaskByName, selectCountry } from "./roulette-participant-ui.mjs";

export async function createRouletteParticipantTasks(page, config, plan) {
  const created = [];
  for (const task of plan) created.push(await createOneTask(page, config, task));
  return created;
}

async function createOneTask(page, config, task) {
  await page.goto(`${config.baseUrl}/activity/task`, { waitUntil: "domcontentloaded" });
  await sleep(1400);
  await page.locator('button:has-text("新增")').first().click();
  await dialog(page);
  await selectPlaceholder(page, "活动类型", "转盘抽奖");
  await fillBaseText(page, task);
  await clickDialogText(page, task.scopeLabel);
  const selected = await fillScopeExtra(page, task);
  await fillDefaultTaskConfig(page, task);
  const submit = await submitTask(page, task.name);
  const row = await searchTaskByName(page, config, task.name);
  return { id: firstNumericCell(row), name: task.name, scope: task.scopeLabel, selected, submit, row };
}

async function fillBaseText(page, task) {
  await fillLabel(page, "任务名称", task.name);
  await fillLabel(page, "任务内容", task.content);
  await fillLabel(page, "任务标签", task.tag);
  await fillLabel(page, "任务备注", task.remark);
  await fillEnglishIfVisible(page, task);
}

async function fillScopeExtra(page, task) {
  const selected = {};
  if (task.scope === "agent") await fillLabel(page, "指定代理", task.uid);
  if (task.scope === "user") await fillLabel(page, "指定用户UID", task.uid);
  if (task.scope === "country") selected.country = await selectCountry(page, task);
  if (task.scope === "vip") {
    selected.vipStart = await selectPlaceholder(page, "起始等级", "VIP 0").then(() => "VIP 0");
    selected.vipEnd = await selectPlaceholder(page, "结束等级", "VIP 0").then(() => "VIP 0");
    await clickDialogText(page, task.vipWhitelist);
    selected.vipWhitelist = task.vipWhitelist;
  }
  if (task.scope === "newuser") selected.newUser = await selectFirstByLabel(page, "新用户");
  if (task.scope === "olduser") selected.oldUser = await selectFirstByLabel(page, "老用户");
  return selected;
}

async function fillDefaultTaskConfig(page, task) {
  await clickDialogText(page, "不审核KYC");
  if (!(await optionalClickDialogText(page, "单一任务条件"))) await selectFirstByLabel(page, "任务组合");
  await selectOptionByLabel(page, "任务条件1", "KOL绑定");
  await clickDialogText(page, "报名活动后");
  await clickDialogText(page, "仅1次，直至结束");
  await clickDialogText(page, "单一奖励");
  await selectFirstByLabel(page, "正常奖励");
  await fillRewardRange(page, task.rewardMin, task.rewardMax);
  await fillLabel(page, "每日领奖人数上限", task.dailyLimit);
  await fillLabel(page, "总领奖人数上限", task.totalLimit);
}

async function optionalClickDialogText(page, text) {
  try {
    await clickDialogText(page, text);
    return true;
  } catch {
    return false;
  }
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

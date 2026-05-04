import { bodyText, sleep } from "../../lib/browser.mjs";
import {
  dialog,
  fillLabel,
  selectFirstByLabel,
  selectPlaceholder,
  setEnglish,
  tableRows,
  uploadFileInFormItem,
  visibleFormErrors,
} from "../../lib/element-ui.mjs";

export async function createPrizes(page, config, plan) {
  const created = [];
  for (const reward of plan) created.push(await createPrize(page, config, reward));
  return created;
}

async function createPrize(page, config, reward) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1400);
  await page.locator('button:has-text("新增")').first().click();
  await dialog(page);
  await selectPlaceholder(page, "奖品分类", reward.category);
  await selectPlaceholder(page, "奖品子类型", reward.subtype);
  await fillLabel(page, "奖品名称", reward.name);
  await setEnglish(page, reward.enName);
  await fillLabel(page, "奖品别名", reward.alias);
  const selected = await fillPrizeFields(page, reward);
  const uploadStatus = await uploadFileInFormItem(page, "奖品图片", config.imagePath);
  const submitStatus = await submitPrize(page, reward.alias);
  const row = await searchByAlias(page, config, reward.alias);
  return { id: row[0], category: row[1], subtype: row[2], name: row[3], alias: row[4], selected, uploadStatus, submitStatus, row };
}

async function fillPrizeFields(page, reward) {
  if (reward.category === "赠金") {
    await fillLabel(page, "领取后有效期", reward.receiveDays);
    await fillLabel(page, "发放有效期", reward.issueDays);
    await fillLabel(page, "奖品单位", reward.unit);
    await fillLabel(page, "奖品展示精度", reward.precision);
    await fillLabel(page, "抵扣比例", reward.discountRatio);
    return {};
  }
  if (reward.category === "币种" || reward.category === "实物") {
    await fillCommonValidity(page, reward);
    return {};
  }
  return fillVirtualPrizeFields(page, reward);
}

async function fillVirtualPrizeFields(page, reward) {
  const selected = {};
  if (reward.subtype === "抽奖次数") selected.color = reward.color || await selectFirstByLabel(page, "颜色签");
  if (reward.subtype === "合约抵扣金") {
    await fillLabel(page, "领取后有效期", reward.receiveDays);
    await fillLabel(page, "发放有效期", reward.issueDays);
  } else if (reward.subtype === "仓位空投") {
    await fillPositionAirdrop(page, reward, selected);
    return selected;
  } else {
    await fillLabel(page, "有效时间", reward.validDays, false);
  }
  await fillLabel(page, "奖品单位", reward.unit, false);
  await fillLabel(page, "奖品展示精度", reward.precision, false);
  return selected;
}

async function fillCommonValidity(page, reward) {
  await fillLabel(page, "有效时间", reward.validDays);
  await fillLabel(page, "奖品单位", reward.unit);
  await fillLabel(page, "奖品展示精度", reward.precision);
}

async function fillPositionAirdrop(page, reward, selected) {
  await fillLabel(page, "开仓后有效期", reward.validDays);
  await fillLabel(page, "发放有效期", reward.issueDays);
  selected.coin = reward.coin || await selectFirstByLabel(page, "币种");
  selected.tradePair = reward.tradePair || await selectFirstByLabel(page, "交易对", true, true);
  selected.marginMode = reward.marginMode || await selectFirstByLabel(page, "保证金模式");
  await fillLabel(page, "杠杆倍数", reward.leverage);
  await fillLabel(page, "数量", reward.quantity);
}

async function submitPrize(page, alias) {
  const d = await dialog(page);
  const submitPromise = page.waitForResponse(
    r => r.url().includes("/prod-api/activity/prize") && r.request().method() === "POST",
    { timeout: 12000 },
  ).catch(() => null);
  await d.locator('button:has-text("确认")').last().click();
  const submit = await submitPromise;
  await sleep(2200);
  const errors = await visibleFormErrors(page);
  const text = await bodyText(page);
  if (errors.length || !submit) {
    throw new Error(`Submit not accepted for ${alias}: ${JSON.stringify({ submitStatus: submit?.status() || null, errors, text: text.slice(0, 400) })}`);
  }
  if (submit.status() >= 400) throw new Error(`Submit HTTP ${submit.status()}`);
  return submit.status();
}

async function searchByAlias(page, config, alias) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1300);
  const aliasHandle = await page.evaluateHandle(() => {
    const item = [...document.querySelectorAll(".el-form-item")]
      .find(it => (it.querySelector(".el-form-item__label")?.innerText || "").includes("奖品别名"));
    return item?.querySelector("input") || null;
  });
  const aliasInput = aliasHandle.asElement();
  if (!aliasInput) throw new Error("Alias search input not found");
  await aliasInput.fill(alias);
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(2200);
  const row = (await tableRows(page)).find(r => r.join("\n").includes(alias));
  if (!row) throw new Error(`Created row not found by alias: ${alias}`);
  return row;
}

import { sleep } from "../../lib/browser.mjs";
import { clickRowActionByText, fillLabel, tableRows } from "../../lib/element-ui.mjs";

export async function copyPrizeById(page, config, prizeId) {
  const original = await searchPrizeById(page, config, prizeId);
  await clickRowActionById(page, prizeId, "复制");
  const confirmText = await confirmMessageBox(page);
  await sleep(1200);
  const copied = await findCopiedPrize(page, config, original);
  return { original, copied, confirmText };
}

export async function searchPrizeById(page, config, prizeId) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1300);
  await page.locator('input[placeholder="请输入奖品ID"]').first().fill(String(prizeId));
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(1800);
  const row = (await tableRows(page)).find(item => item[0] === String(prizeId) || item.join("\n").includes(String(prizeId)));
  if (!row) throw new Error(`Prize not found by ID: ${prizeId}`);
  return rowToPrize(row);
}

export async function searchPrizeByAlias(page, config, alias) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1300);
  await fillLabel(page, "奖品别名", alias);
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(1800);
  return tableRows(page);
}

async function clickRowActionById(page, prizeId, action) {
  await clickRowActionByText(page, prizeId, action);
}

async function confirmMessageBox(page) {
  const box = page.locator(".el-message-box:visible").last();
  await box.waitFor({ timeout: 8000 });
  const text = await box.innerText().catch(() => "");
  await box.locator('button:has-text("确定"), button:has-text("确认")').last().click();
  await sleep(2200);
  return text;
}

async function findCopiedPrize(page, config, original) {
  const rows = original.alias ? await searchPrizeByAlias(page, config, original.alias) : [];
  const copied = rows.find(row => row[0] !== original.id && row.join("\n").includes("复制从"));
  if (!copied) throw new Error(`Copied prize not found for source ID ${original.id}`);
  return rowToPrize(copied);
}

export function rowToPrize(row) {
  return {
    id: row[0],
    category: row[1],
    subtype: row[2],
    name: row[3],
    alias: row[4],
    unit: row[5],
    precision: row[6],
    row,
  };
}

import { sleep } from "../../lib/browser.mjs";
import { fillInputByPlaceholder, fillLabel, selectOpenOption, tableRows } from "../../lib/element-ui.mjs";
import { searchPrizeByAlias, searchPrizeById, rowToPrize } from "./copy.mjs";

export async function runPrizeSearchChecks(page, config, created) {
  const byIdTarget = created.find(item => item?.id) || null;
  const byCategorySubtypeTarget = created.find(item => item?.category && item?.subtype) || null;
  const byNameTarget = created.find(item => item?.name) || null;
  const byAliasTarget = created.find(item => item?.alias) || null;

  const byId = byIdTarget ? await verifyPrizeIdSearch(page, config, byIdTarget) : { ok: false, reason: "missing_target" };
  const byCategorySubtype = byCategorySubtypeTarget
    ? await verifyPrizeCategorySubtypeSearch(page, config, byCategorySubtypeTarget)
    : { ok: false, reason: "missing_target" };
  const byName = byNameTarget ? await verifyPrizeNameSearch(page, config, byNameTarget) : { ok: false, reason: "missing_target" };
  const byAlias = byAliasTarget ? await verifyPrizeAliasSearch(page, config, byAliasTarget) : { ok: false, reason: "missing_target" };

  return { byId, byCategorySubtype, byName, byAlias };
}

async function verifyPrizeIdSearch(page, config, target) {
  const row = await searchPrizeById(page, config, target.id);
  const matched = row.id === String(target.id);
  return {
    ok: matched,
    searchedPrizeId: String(target.id),
    returnedRow: row.row,
  };
}

async function verifyPrizeCategorySubtypeSearch(page, config, target) {
  await openPrizeList(page, config);
  await selectSearchOption(page, "请选择奖品分类", target.category);
  await selectSearchOption(page, "请选择奖品子类别", target.subtype);
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(1800);
  const rows = await tableRows(page);
  const prizes = rows.map(rowToPrize);
  const allMatched = prizes.length > 0 && prizes.every(item => item.category === target.category && item.subtype === target.subtype);
  const targetMatched = prizes.some(item => item.id === String(target.id));
  return {
    ok: allMatched && targetMatched,
    category: target.category,
    subtype: target.subtype,
    rowCount: prizes.length,
    matchedPrizeIds: prizes.map(item => item.id),
  };
}

async function verifyPrizeNameSearch(page, config, target) {
  const keyword = buildNameKeyword(target.name);
  await openPrizeList(page, config);
  await fillInputByPlaceholder(page, "请输入奖品名称", keyword);
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(1800);
  const rows = await tableRows(page);
  const prizes = rows.map(rowToPrize);
  const allMatched = prizes.length > 0 && prizes.every(item => item.name.includes(keyword));
  const targetMatched = prizes.some(item => item.id === String(target.id));
  return {
    ok: allMatched && targetMatched,
    keyword,
    rowCount: prizes.length,
    matchedPrizeIds: prizes.map(item => item.id),
  };
}

async function verifyPrizeAliasSearch(page, config, target) {
  const keyword = buildAliasKeyword(target.alias);
  await openPrizeList(page, config);
  await fillLabel(page, "奖品别名", keyword);
  await page.locator('button:has-text("搜索")').first().click();
  await sleep(1800);
  const rows = (await tableRows(page)).map(rowToPrize);
  const allMatched = rows.length > 0 && rows.every(item => item.alias.includes(keyword));
  const targetMatched = rows.some(item => item.id === String(target.id));
  const aliasRows = await searchPrizeByAlias(page, config, target.alias);
  const exactMatched = aliasRows.map(rowToPrize).some(item => item.id === String(target.id));
  return {
    ok: allMatched && targetMatched && exactMatched,
    keyword,
    rowCount: rows.length,
    matchedPrizeIds: rows.map(item => item.id),
    exactMatched,
  };
}

function buildNameKeyword(name) {
  return String(name || "").split("_")[0].trim();
}

function buildAliasKeyword(alias) {
  return String(alias || "").replace(/\d+$/, "").replace(/_+$/, "");
}

async function openPrizeList(page, config) {
  await page.goto(`${config.baseUrl}/activity/prize`, { waitUntil: "domcontentloaded" });
  await sleep(1300);
}

async function selectSearchOption(page, placeholder, option) {
  const input = page.locator(`input[placeholder="${placeholder}"]`).first();
  await input.scrollIntoViewIfNeeded();
  await input.click();
  await sleep(500);
  await selectOpenOption(page, option, true, true);
}

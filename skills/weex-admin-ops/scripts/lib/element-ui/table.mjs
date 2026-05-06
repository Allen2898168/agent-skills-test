import { sleep } from "../browser.mjs";

export async function tableRows(page) {
  return page.evaluate(() => [...document.querySelectorAll(".el-table__body-wrapper tbody tr")]
    .map(row => [...row.querySelectorAll("td")].map(cell => cell.innerText.trim())));
}

export async function visibleRowIndexByText(page, text) {
  return page.evaluate(value => [...document.querySelectorAll(".el-table__body-wrapper tbody tr")]
    .findIndex(row => row.innerText.includes(String(value))), String(text));
}

export async function clickRowActionByText(page, rowText, action) {
  const index = await visibleRowIndexByText(page, rowText);
  if (index < 0) throw new Error(`Row not found for text: ${rowText}`);
  const fixedRows = page.locator(".el-table__fixed-right .el-table__fixed-body-wrapper tbody tr");
  const mainRows = page.locator(".el-table__body-wrapper tbody tr");
  const rows = await fixedRows.count() > index ? fixedRows : mainRows;
  await rows.nth(index).locator(`button:has-text("${action}")`).first().click();
  await sleep(900);
  return index;
}

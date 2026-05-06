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
  const clicked = await page.evaluate(({ rowText, action }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const mainRows = [...document.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
    const index = mainRows.findIndex(row => (row.innerText || "").includes(rowText));
    if (index < 0) return false;
    const fixedRows = [...document.querySelectorAll(".el-table__fixed-right .el-table__fixed-body-wrapper tbody tr")].filter(visible);
    const row = fixedRows[index] || mainRows[index];
    const buttons = [...row.querySelectorAll("button")]
      .filter(visible)
      .filter(button => (button.innerText || "").trim().includes(action));
    if (!buttons.length) return false;
    buttons[0].click();
    return true;
  }, { rowText: String(rowText), action: String(action) });
  if (!clicked) throw new Error(`Visible row action not found: row=${rowText}; action=${action}`);
  await sleep(900);
  return true;
}

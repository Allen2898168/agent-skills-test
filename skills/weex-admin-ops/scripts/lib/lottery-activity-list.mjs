import { loginToPrizePage, sleep } from "./browser.mjs";
import { fillLabel, selectOptionByLabel, tableRows, clickRowActionByText } from "./element-ui.mjs";
import { setDateTimeRangeByLabel } from "./element-ui-datetime.mjs";
import { fillInputByPlaceholder } from "./element-ui.mjs";

export async function openLotteryList(page, config) {
  await loginToPrizePage(page, config);
  await sleep(1000);
  await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(1200);
}

export async function searchLotteryList(page, filters = {}) {
  await page.goto(page.url().includes("/activities/lottery") ? page.url() : `${new URL(page.url()).origin}/activities/lottery`, { waitUntil: "domcontentloaded" }).catch(() => {});
  if (!page.url().includes("/activities/lottery")) {
    throw new Error(`Lottery list page not loaded: ${page.url()}`);
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(1000);
  if (filters.activityId) await fillSearchTextField(page, {
    label: "活动id",
    placeholders: ["活动ID", "活动id", "请输入活动ID", "请输入活动id"],
    fallbackIndex: 0,
    value: String(filters.activityId),
  });
  if (filters.title) await fillSearchTextField(page, {
    label: "活动标题",
    placeholders: ["活动标题", "请输入活动标题"],
    fallbackIndex: 1,
    value: String(filters.title),
  });
  if (filters.alias) await fillSearchTextField(page, {
    label: "活动别名",
    placeholders: ["活动别名", "请输入活动别名"],
    fallbackIndex: 2,
    value: String(filters.alias),
  });
  if (filters.type) await selectSearchType(page, String(filters.type));
  if (filters.start && filters.end) {
    await setSearchDateRange(page, String(filters.start), String(filters.end));
  }
  const listPromise = page.waitForResponse(
    response => response.url().includes("/prod-api/activity/config/list") && response.request().method() === "GET",
    { timeout: 15000 },
  ).catch(() => null);
  await page.locator("button:visible").filter({ hasText: "查询" }).first().click();
  const response = await listPromise;
  await sleep(1200);
  const rows = await tableRows(page);
  let body = null;
  try { body = await response?.json(); } catch {}
  return { response, body, rows };
}

export async function visibleLotteryRowActions(page, rowText) {
  return page.evaluate(text => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const mainRows = [...document.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
    const index = mainRows.findIndex(row => (row.innerText || "").includes(String(text)));
    if (index < 0) return [];
    const fixedRows = [...document.querySelectorAll(".el-table__fixed-right .el-table__fixed-body-wrapper tbody tr")].filter(visible);
    const row = fixedRows[index] || mainRows[index];
    return [...row.querySelectorAll("button")].filter(visible).map(button => button.innerText.trim()).filter(Boolean);
  }, String(rowText));
}

export async function apiLotteryListByAlias(page, authHeader, alias) {
  if (!authHeader) return null;
  return page.evaluate(async ({ authHeader, alias }) => {
    const response = await fetch(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return response.json();
  }, { authHeader, alias });
}

export async function apiLotteryRecentList(page, authHeader) {
  if (!authHeader) return null;
  return page.evaluate(async authHeaderValue => {
    const response = await fetch("/prod-api/activity/config/list?pageNum=1&pageSize=20&type=LOTTERY", {
      headers: { Authorization: authHeaderValue },
      credentials: "include",
    });
    return response.json();
  }, authHeader);
}

export async function apiLotteryDetail(page, authHeader, activityId) {
  if (!authHeader) return null;
  return page.evaluate(async ({ authHeader, activityId }) => {
    const response = await fetch(`/prod-api/activity/config/${activityId}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return response.json();
  }, { authHeader, activityId });
}

export async function fillVerificationAndConfirm(page, googleCode, expectedText = "") {
  const box = page.locator(".el-message-box:visible, .el-message-box__wrapper:visible").last();
  await box.waitFor({ timeout: 10000 });
  const text = await box.innerText();
  if (expectedText && !text.includes(expectedText)) {
    throw new Error(`Message box did not include expected text: ${expectedText}`);
  }
  const input = box.locator("input:visible").first();
  if (await input.count()) await input.fill(String(googleCode));
  await box.locator('button:has-text("确定")').last().click({ force: true });
  await sleep(500);
  return text.replace(/\s+/g, " ").trim();
}

export async function submitCopiedLotteryForm(page, values) {
  await fillLabel(page, "活动标题", values.title, false).catch(() => {});
  await fillLabel(page, "活动别名配置", values.alias, false).catch(() => {});
  const submitResponse = page.waitForResponse(
    response => response.url().includes("/prod-api/activity/config") && response.request().method() === "POST",
    { timeout: 30000 },
  ).catch(() => null);
  const submitButton = page.locator("button:visible").filter({ hasText: "新增" }).last();
  await submitButton.scrollIntoViewIfNeeded().catch(() => {});
  await submitButton.click({ force: true });
  const response = await submitResponse;
  await sleep(2000);
  let body = null;
  try { body = await response?.json(); } catch {}
  return {
    httpStatus: response?.status?.() || null,
    code: body?.code || null,
    msg: body?.msg || "",
  };
}

export async function deleteLotteryDraftByAlias(page, config, alias, googleCode) {
  await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(1000);
  await fillLabel(page, "活动别名", alias);
  const listPromise = page.waitForResponse(
    response => response.url().includes("/prod-api/activity/config/list") && response.request().method() === "GET",
    { timeout: 15000 },
  ).catch(() => null);
  await page.locator("button:visible").filter({ hasText: "查询" }).first().click();
  await listPromise;
  await sleep(1200);
  const deleteResponsePromise = page.waitForResponse(
    response => response.url().includes("/prod-api/activity/lottery/delete") && response.request().method() === "POST",
    { timeout: 20000 },
  ).catch(() => null);
  await clickRowActionByText(page, alias, "删除");
  const confirmText = await fillVerificationAndConfirm(page, googleCode, "删除");
  const response = await deleteResponsePromise;
  await sleep(1500);
  let body = null;
  try { body = await response?.json(); } catch {}
  const verify = await searchLotteryList(page, { alias });
  const remainingRow = verify.rows.find(row => row.some(cell => cell.includes(alias)));
  return {
    confirmText,
    httpStatus: response?.status?.() || null,
    code: body?.code || null,
    msg: body?.msg || "",
    rowAbsentAfterSearch: !remainingRow,
  };
}

export function findLotteryRow(rows, matcher) {
  return rows.find(row => matcher(row)) || null;
}

async function fillSearchTextField(page, { label, placeholders, fallbackIndex, value }) {
  if (await fillLabel(page, label, value, false)) return true;
  for (const placeholder of placeholders) {
    if (await fillInputByPlaceholder(page, placeholder, value, false)) return true;
  }
  const filled = await page.evaluate(({ fallbackIndex, value }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const inputs = [...document.querySelectorAll('input:not([readonly]):not([type="radio"]):not([type="checkbox"])')]
      .filter(visible);
    const input = inputs[fallbackIndex];
    if (!input) return false;
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { fallbackIndex, value: String(value) });
  if (!filled) throw new Error(`Search input not found: ${label}`);
  await sleep(150);
  return true;
}

async function selectSearchType(page, option) {
  try {
    await selectOptionByLabel(page, "活动类型", option);
    return true;
  } catch {}
  const selected = await page.evaluate(target => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const selects = [...document.querySelectorAll(".el-select")].filter(visible);
    const select = selects[0];
    if (!select) return null;
    select.click();
    return true;
  }, option);
  if (!selected) {
    const inLotteryRoute = page.url().includes("/activities/lottery");
    if (inLotteryRoute) return true;
    throw new Error("Search select not found: 活动类型");
  }
  await sleep(500);
  const picked = await page.evaluate(target => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).at(-1);
    if (!dropdown) return null;
    const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
    const item = items.find(node => {
      const text = (node.innerText || "").trim();
      return text === target || text.includes(target);
    });
    if (!item) return null;
    item.click();
    return item.innerText.trim();
  }, option);
  if (!picked) {
    const inLotteryRoute = page.url().includes("/activities/lottery");
    if (inLotteryRoute) return true;
    throw new Error(`Search select option not found: 活动类型 -> ${option}`);
  }
  await sleep(500);
  return true;
}

async function setSearchDateRange(page, start, end) {
  try {
    await setDateTimeRangeByLabel(page, "活动日期", start, end);
    return true;
  } catch {}
  const bound = await page.evaluate(({ start, end }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const editors = [...document.querySelectorAll(".el-date-editor")]
      .filter(visible)
      .map(element => element.__vue__)
      .filter(Boolean);
    if (editors.length >= 2) {
      const values = [start, end];
      for (let index = 0; index < 2; index += 1) {
        const vm = editors[index];
        vm.emitInput(values[index]);
        vm.emitChange(values[index]);
        vm.$emit("input", values[index]);
        vm.$emit("change", values[index]);
        vm.userInput = null;
      }
      return true;
    }
    if (editors.length === 1) {
      const vm = editors[0];
      const values = [start, end];
      vm.emitInput(values);
      vm.emitChange(values);
      vm.$emit("input", values);
      vm.$emit("change", values);
      vm.userInput = null;
      return true;
    }
    const rangeInputs = [...document.querySelectorAll(".el-range-input, input[placeholder*='开始'], input[placeholder*='结束']")]
      .filter(visible);
    if (rangeInputs.length >= 2) {
      const values = [start, end];
      for (let index = 0; index < 2; index += 1) {
        const input = rangeInputs[index];
        const proto = HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(values[index]));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }
    return null;
  }, { start, end });
  if (!bound) throw new Error("Search date range not found: 活动日期");
  await sleep(500);
  return true;
}

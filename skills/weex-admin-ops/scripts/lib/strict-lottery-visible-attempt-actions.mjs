import { ensureAdminSession, loginToPrizePage } from "./browser.mjs";

export function buildShortLotteryAlias(prefixValue, stampValue, maxLength = 10) {
  const numericStamp = String(stampValue || "").replace(/\D+/g, "") || "00000000";
  const cleanPrefix = String(prefixValue || "lt")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "lt";
  const suffixLength = cleanPrefix.length <= 2 ? Math.min(8, Math.max(4, maxLength - cleanPrefix.length)) : 4;
  const suffix = numericStamp.slice(-suffixLength).padStart(suffixLength, "0");
  const prefix = cleanPrefix.slice(0, Math.max(1, maxLength - suffix.length));
  return `${prefix}${suffix}`.slice(0, maxLength);
}

export function parseList(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.map(item => String(item).trim()).filter(Boolean) : [];
    } catch {}
  }
  return text.split(/\s*\|\|\s*|\s*\|\s*|\s*,\s*/).map(item => item.trim()).filter(Boolean);
}

export function expandToEight(values) {
  if (!values.length) return [];
  return Array.from({ length: 8 }, (_, index) => values[index % values.length]);
}

function parseUtc8DateTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  const [, y, m, d, hh, mm, ss] = match;
  return Date.parse(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`);
}

export function createStrictLotteryVisibleAttemptActions({ page, config, wait, options }) {
  const {
    title,
    alias,
    subTitle,
    preApplyStartTime,
    preApplyEndTime,
    registrationTemplateLabel,
    guideTemplateLabel,
    ownerLabel,
    platformActivity,
    activityTaskLabels,
    enablePreApply,
    lotteryStyle,
    shareCopy,
    agentShareCopy,
    activityRules,
    englishTitle,
    englishSubTitle,
    englishShareCopy,
    englishAgentShareCopy,
    englishActivityRules,
    faqTitle,
    faqContent,
    variedMode,
    weightConfigMode,
    enableBeginnerTask,
    enableDailyLimit,
    enableAccumulatedWeight,
    prizeLabels,
    effectivePrizeAmounts,
    effectivePrizeStocks,
    prizeWeights,
    redSignWeights,
    whiteSignWeights,
    lotteryWeightConfigWeights,
  } = options || {};

  async function formItem(label, nth = 0) {
    return page
      .locator(`xpath=(//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.), "${label}")]])`)
      .nth(nth);
  }

  async function visibleOptionBox(text = null, index = 0) {
    return await page.evaluate(({ text, index }) => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const dropdowns = [...document.querySelectorAll(".el-select-dropdown, .el-dropdown-menu, .el-cascader__dropdown")].filter(visible);
      const dropdown = dropdowns[dropdowns.length - 1 - Math.max(0, Number(index) || 0)];
      if (!dropdown) return null;
      const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled), .el-dropdown-menu__item:not(.is-disabled), li:not(.is-disabled)")]
        .filter(visible);
      const item = text
        ? items.find(option => option.innerText.trim().includes(String(text).trim()))
        : items[0];
      if (!item) return null;
      const rect = item.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: item.innerText.trim() };
    }, { text, index }).catch(() => null);
  }

  async function clickOption(option) {
    if (!option) return;
    await page.mouse.click(option.x, option.y);
    await wait(250);
  }

  async function clickVisibleOptionByDom(text = null, index = 0) {
    const option = await visibleOptionBox(text, index);
    await clickOption(option);
    return option;
  }

  async function clickRadio(label, option, nth = 0) {
    const locator = (await formItem(label, nth)).locator(`xpath=.//label[contains(@class,'el-radio')][contains(normalize-space(.), "${option}")]`).first();
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ force: true }).catch(() => {});
    await wait(250);
    return await page.evaluate(async ({ label, option, nth }) => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const items = [...document.querySelectorAll(".el-form-item")].filter(visible)
        .filter(item => item.querySelector(".el-form-item__label")?.innerText?.includes(label));
      const item = items[nth];
      if (!item) return { missing: true };
      const radio = [...item.querySelectorAll(".el-radio")].filter(visible)
        .find(r => r.innerText.includes(option));
      if (!radio) return { missing: true };
      if (radio.getAttribute("aria-checked") === "true") return { checked: true };
      if (radio.classList.contains("is-disabled")) return { checked: radio.classList.contains("is-checked"), disabled: true };
      const rect = radio.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, { label, option, nth }).catch(() => ({ missing: true }));
  }

  async function ensurePreApplySupport() {
    await clickRadio("是否支持预报名", "支持");
    await wait(450);
    const preApplyBox = await page.locator("xpath=//*[contains(normalize-space(.),'预报名开始时间')]/ancestor::div[contains(@class,'el-form-item')]").first();
    if (!(await preApplyBox.isVisible({ timeout: 2000 }).catch(() => false))) {
      await clickRadio("是否支持预报名", "不支持");
      await wait(350);
      await clickRadio("是否支持预报名", "支持");
      await wait(450);
    }
  }

  async function fillControl(locator, value) {
    const text = String(value ?? "");
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ force: true }).catch(() => {});
    await locator.fill("").catch(() => {});
    await locator.type(text, { delay: 20 }).catch(() => locator.fill(text).catch(() => {}));
    await wait(250);
  }

  async function fillLabel(label, value, nth = 0) {
    const item = await formItem(label, nth);
    const input = item.locator("xpath=.//input[not(@type='radio')][not(@type='checkbox')]|.//textarea").first();
    await fillControl(input, value);
  }

  async function fillDateLabel(label, value, nth = 0) {
    const item = await formItem(label, nth);
    const input = item.locator("xpath=.//input[contains(@placeholder,'选择') or contains(@placeholder,'请输入')]").first();
    await fillControl(input, value);
    await page.keyboard.press("Enter").catch(() => {});
    await wait(350);
    await page.locator("text=确定").first().click({ force: true }).catch(() => {});
    await wait(350);
  }

  async function fillDateLabelWithinOffsetRange(label, { minOffsetMinutes = 3, maxOffsetMinutes = 5 } = {}) {
    const startedAt = Date.now();
    const desired = Date.now() + Math.floor((minOffsetMinutes + maxOffsetMinutes) / 2) * 60 * 1000;
    const desiredDate = new Date(desired);
    const stamp = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(desiredDate);
    const get = type => stamp.find(item => item.type === type)?.value || "00";
    const desiredText = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;

    let best = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await fillDateLabel(label, desiredText);
      const actualValue = await page.evaluate(({ label }) => {
        const visible = element => !!element && element.getClientRects().length
          && getComputedStyle(element).display !== "none"
          && getComputedStyle(element).visibility !== "hidden";
        const items = [...document.querySelectorAll(".el-form-item")].filter(visible)
          .filter(item => item.querySelector(".el-form-item__label")?.innerText?.includes(label));
        const item = items[0];
        if (!item) return "";
        const input = item.querySelector("input");
        return input?.value || "";
      }, { label }).catch(() => "");
      const diffMinutes = Math.abs(parseUtc8DateTime(actualValue) - parseUtc8DateTime(desiredText)) / 60000;
      best = best && best.diffMinutes <= diffMinutes ? best : { desired: desiredText, actualValue, diffMinutes };
      const within = Number.isFinite(diffMinutes) && diffMinutes >= minOffsetMinutes && diffMinutes <= maxOffsetMinutes;
      if (within) return { ...best, chosen: true, startedAt };
      await wait(700);
    }
    return { ...(best || { desired: "", actualValue: "", diffMinutes: Number.NaN }), chosen: false, startedAt };
  }

  async function fillRich(label, value, nth = 0) {
    const item = await formItem(label, nth);
    let editor = item.locator(".ql-editor").first();
    if (!(await editor.isVisible({ timeout: 1200 }).catch(() => false))) {
      editor = item.locator("xpath=.//*[contains(@class,'el-textarea')]/textarea").first();
    }
    await fillControl(editor, value);
  }

  async function selectLabel(label, text = null, nth = 0, index = 0) {
    const item = await formItem(label, nth);
    const select = item.locator(".el-select").first();
    await select.click({ force: true }).catch(() => {});
    await wait(400);
    const option = await clickVisibleOptionByDom(text, index);
    await wait(400);
    return option;
  }

  async function readSelectLabelValue(label, nth = 0) {
    const item = await formItem(label, nth);
    const input = item.locator(".el-select input").first();
    return String(await input.inputValue().catch(() => "")).trim();
  }

  async function ensureSelectLabel(label, text = null, nth = 0, index = 0) {
    const existing = await readSelectLabelValue(label, nth).catch(() => "");
    if (text && existing.includes(text)) return { selected: true, value: existing };
    const option = await selectLabel(label, text, nth, index);
    const value = await readSelectLabelValue(label, nth).catch(() => "");
    return { selected: Boolean(option), value };
  }

  async function readApplyConfigId() {
    return await page.evaluate(() => {
      const roots = [...document.querySelectorAll("*")]
        .map(element => element.__vue__)
        .filter(Boolean)
        .filter(vue => vue.$refs && vue.$refs.baseForm);
      const root = roots[0];
      if (!root) return "";
      return root.$refs.baseForm?.form?.applyConfigId || "";
    }).catch(() => "");
  }

  async function selectRegistrationTemplate(text) {
    await wait(350);
    await selectLabel("用户报名模版", text, 0, 0);
    await wait(500);
    const applyConfigId = await readApplyConfigId();
    const selected = await readSelectLabelValue("用户报名模版");
    return { selected, applyConfigId };
  }

  async function fetchActivityConfigDetail(detailId, authHeader, attempts = 5) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await page.evaluate(async ({ detailId, authHeader }) => {
          const res = await fetch(`/prod-api/activity/config/detail?id=${encodeURIComponent(detailId)}`, {
            headers: { Authorization: authHeader },
            credentials: "include",
          });
          return res.json();
        }, { detailId, authHeader });
        if (response?.code) return response;
      } catch {}
      await wait(attempt * 500);
    }
    return null;
  }

  async function uploadLabel(label, nth = 0) {
    const item = await formItem(label, nth);
    const input = item.locator("input[type=file]").first();
    if (!(await input.isVisible({ timeout: 1500 }).catch(() => false))) return false;
    await input.setInputFiles(config.imagePath).catch(() => {});
    await wait(1500);
    return true;
  }

  async function uploadLabelAfterSection(sectionText, label, nth = 0) {
    const section = page.locator(`xpath=(//*[contains(normalize-space(.), '${sectionText}')])[1]`).first();
    if (!(await section.isVisible({ timeout: 2500 }).catch(() => false))) return false;
    await section.scrollIntoViewIfNeeded().catch(() => {});
    await wait(400);
    const item = page.locator(`xpath=(//*[contains(normalize-space(.), '${sectionText}')]/following::div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.), '${label}')]])`).nth(nth);
    const input = item.locator("input[type=file]").first();
    if (!(await input.isVisible({ timeout: 1500 }).catch(() => false))) return false;
    await input.setInputFiles(config.imagePath).catch(() => {});
    await wait(1500);
    return true;
  }

  async function clickButton(text, nth = 0) {
    await page.locator("button:visible").filter({ hasText: text }).nth(nth).click({ force: true }).catch(() => {});
    await wait(400);
  }

  async function scrollText(text) {
    await page.evaluate(targetText => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const normalizedTarget = String(targetText || "").trim();
      if (!normalizedTarget) return false;
      const candidates = [...document.querySelectorAll("body *")]
        .filter(visible)
        .filter(element => {
          const textContent = (element.textContent || "").replace(/\s+/g, " ").trim();
          return textContent.includes(normalizedTarget);
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const element = candidates[0];
      if (!element) return false;
      element.scrollIntoView({ block: "center", inline: "nearest" });
      return true;
    }, text).catch(() => {});
    await wait(300);
  }

  async function openLotteryViaMenu() {
    if (config.useExistingChrome) {
      await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
      await wait(1500);
      if (await ensureAdminSession(page, config, "/activities/lottery")) {
        await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
        await wait(1500);
      }
      return;
    }
    await loginToPrizePage(page, config);
    await wait(1000);
    if (!(await page.locator("text=转盘抽奖").first().isVisible().catch(() => false))) {
      await page.locator("text=活动列表").first().click();
    }
    await wait(400);
    await page.locator("text=转盘抽奖").first().click();
    await page.waitForURL(/\/activities\/lottery/, { timeout: 15000 }).catch(() => {});
    await wait(1200);
    if (await ensureAdminSession(page, config, "/activities/lottery")) {
      await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
      await wait(1500);
    }
  }

  async function clickPrize(rowIndex, label = null) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const selected = await page.evaluate(async ({ rowIndex, label }) => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const visible = element => !!element && element.getClientRects().length
          && getComputedStyle(element).display !== "none"
          && getComputedStyle(element).visibility !== "hidden";
        const table = [...document.querySelectorAll(".el-table")]
          .filter(visible)
          .find(element => /奖品池ID|奖品名称/.test(element.innerText));
        if (!table) return null;
        const rows = [...table.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
        const row = rows[rowIndex];
        if (!row) return null;
        row.scrollIntoView({ block: "center", inline: "nearest" });
        const selects = [...row.querySelectorAll(".el-select")].filter(visible);
        const select = selects[1];
        if (!select) return null;
        select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        select.click();
        await sleep(500);
        const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
        if (!dropdown) return null;
        const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
        const item = label
          ? items.find(option => option.innerText.trim().includes(label))
          : items[Math.min(rowIndex, Math.max(items.length - 1, 0))];
        if (!item) return null;
        const selectedLabel = item.innerText.trim();
        item.scrollIntoView({ block: "center", inline: "nearest" });
        item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        item.click();
        await sleep(350);
        const input = [...select.querySelectorAll("input")].filter(visible)[0];
        const value = input?.value || "";
        return { selectedLabel, value };
      }, { rowIndex, label }).catch(() => null);
      if (selected?.selectedLabel) return selected;
      await wait(600);
    }
    return null;
  }

  async function readPrizeSelections() {
    return await page.evaluate(() => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")]
        .filter(visible)
        .find(element => /奖品池ID|奖品名称/.test(element.innerText));
      if (!table) return [];
      const rows = [...table.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
      return rows.slice(0, 8).map(row => {
        const selects = [...row.querySelectorAll(".el-select input")].filter(visible);
        return selects.map(item => item.value || "");
      });
    }).catch(() => []);
  }

  async function prizeTableBox() {
    return page.locator(".el-table").filter({ hasText: "奖品池ID" }).first();
  }

  async function setPrizeScroll(left) {
    await page.evaluate(leftValue => {
      const table = document.querySelector(".el-table__body-wrapper");
      if (table) table.scrollLeft = Math.max(0, Number(leftValue) || 0);
    }, left).catch(() => {});
    await wait(300);
  }

  async function fillPrizeCell(rowIndex, cellIndex, value) {
    await page.evaluate(async ({ rowIndex, cellIndex, value }) => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")]
        .filter(visible)
        .find(element => /奖品池ID|奖品名称/.test(element.innerText));
      if (!table) return false;
      const rows = [...table.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
      const row = rows[rowIndex];
      if (!row) return false;
      const cells = [...row.querySelectorAll("td")].filter(visible);
      const cell = cells[cellIndex];
      if (!cell) return false;
      const input = cell.querySelector("input");
      if (!input) return false;
      input.scrollIntoView({ block: "center", inline: "nearest" });
      input.focus();
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(120);
      input.value = String(value ?? "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, { rowIndex, cellIndex, value }).catch(() => false);
    await wait(220);
  }

  async function uploadPrizeImage(rowIndex) {
    const box = await prizeTableBox();
    if (!(await box.isVisible().catch(() => false))) return false;
    const input = page.locator(`xpath=(//div[contains(@class,'el-table')][.//div[contains(normalize-space(.),'奖品池ID')]]//tbody/tr)[${rowIndex + 1}]//input[@type='file']`).first();
    if (!(await input.isVisible({ timeout: 1200 }).catch(() => false))) return false;
    await input.setInputFiles(config.imagePath).catch(() => {});
    await wait(1200);
    return true;
  }

  async function selectPrizeMark(rowIndex, text) {
    await page.evaluate(async ({ rowIndex, text }) => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")]
        .filter(visible)
        .find(element => /奖品池ID|奖品名称/.test(element.innerText));
      if (!table) return false;
      const rows = [...table.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
      const row = rows[rowIndex];
      if (!row) return false;
      const selects = [...row.querySelectorAll(".el-select")].filter(visible);
      const select = selects[3];
      if (!select) return false;
      select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      select.click();
      await sleep(450);
      const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
      if (!dropdown) return false;
      const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
      const item = text
        ? items.find(option => option.innerText.trim().includes(text))
        : items[0];
      if (!item) return false;
      item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      item.click();
      return true;
    }, { rowIndex, text }).catch(() => false);
    await wait(300);
  }

  async function selectEasterEggType(rowIndex, text) {
    await page.evaluate(async ({ rowIndex, text }) => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")]
        .filter(visible)
        .find(element => /奖品池ID|奖品名称/.test(element.innerText));
      if (!table) return false;
      const rows = [...table.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
      const row = rows[rowIndex];
      if (!row) return false;
      const selects = [...row.querySelectorAll(".el-select")].filter(visible);
      const select = selects[4];
      if (!select) return false;
      select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      select.click();
      await sleep(450);
      const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
      if (!dropdown) return false;
      const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
      const item = text
        ? items.find(option => option.innerText.trim().includes(text))
        : items[0];
      if (!item) return false;
      item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      item.click();
      return true;
    }, { rowIndex, text }).catch(() => false);
    await wait(300);
  }

  async function fillPrizeRows() {
    await scrollText("奖品配置");
    await wait(700);
    if (variedMode) {
      await clickRadio("活动类型", "强运营");
      await wait(450);
    }
    const selected = await readPrizeSelections();
    for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
      const label = prizeLabels?.[rowIndex] || null;
      if (selected[rowIndex]?.[1] && label && selected[rowIndex][1].includes(label)) {
        continue;
      }
      await clickPrize(rowIndex, label);
      await wait(450);
      await fillPrizeCell(rowIndex, 4, effectivePrizeAmounts?.[rowIndex] || "1");
      await fillPrizeCell(rowIndex, 5, effectivePrizeStocks?.[rowIndex] || "100");
      await fillPrizeCell(rowIndex, 6, prizeWeights?.[rowIndex] || "12.5");
      await setPrizeScroll(800);
      await uploadPrizeImage(rowIndex);
      await selectPrizeMark(rowIndex, "红签").catch(() => {});
      if (String(lotteryStyle || "").includes("彩蛋")) {
        await selectEasterEggType(rowIndex, "彩蛋").catch(() => {});
      }
      await setPrizeScroll(0);
    }
    await wait(700);
  }

  async function fillTableWeightsByMarker(marker, values = Array(8).fill("12.5")) {
    await scrollText("颜色签概率");
    await wait(500);
    await page.evaluate(async ({ marker, values }) => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const title = [...document.querySelectorAll("body *")]
        .filter(visible)
        .find(element => (element.textContent || "").includes("颜色签概率"));
      if (title) title.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(300);
      const table = [...document.querySelectorAll(".el-table")].filter(visible).find(element => element.innerText.includes(marker));
      if (!table) return false;
      const rows = [...table.querySelectorAll("tbody tr")].filter(visible);
      rows.slice(0, 8).forEach((row, index) => {
        const inputs = [...row.querySelectorAll("input")].filter(visible);
        const input = inputs[inputs.length - 1];
        if (!input) return;
        input.value = String(values[index] ?? "12.5");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return true;
    }, { marker, values }).catch(() => false);
    await wait(300);
  }

  async function clickWeightConfigCheckbox(text) {
    await page.locator("xpath=(//*[contains(normalize-space(.),'权重配置')]/following::label[contains(@class,'el-checkbox')][contains(.,'" + text + "')])[1]")
      .click({ force: true })
      .catch(() => {});
    await wait(300);
  }

  async function selectWeightConfigVipLevels() {
    const label = "VIP等级";
    const item = page.locator("xpath=(//*[contains(normalize-space(.),'权重配置')]/following::div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.),'" + label + "')]])[1]");
    const selector = item.locator(".el-select").first();
    if (!(await selector.isVisible({ timeout: 2000 }).catch(() => false))) return;
    await selector.click({ force: true }).catch(() => {});
    await wait(450);
    await page.evaluate(() => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
      if (!dropdown) return false;
      const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
      for (const item of items.slice(0, 8)) {
        item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        item.click();
      }
      return true;
    }).catch(() => false);
    await wait(300);
    await page.keyboard.press("Escape").catch(() => {});
  }

  async function fillWeightConfigPrizeWeights(values = lotteryWeightConfigWeights) {
    await page.evaluate(async ({ values }) => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")].filter(visible).find(element => element.innerText.includes("VIP"));
      if (!table) return false;
      const rows = [...table.querySelectorAll("tbody tr")].filter(visible);
      rows.slice(0, 8).forEach((row, index) => {
        const input = [...row.querySelectorAll("input")].filter(visible).pop();
        if (!input) return;
        input.value = String(values[index] ?? "12.5");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return true;
    }, { values }).catch(() => false);
    await wait(300);
  }

  async function fillLotteryWeightConfig() {
    await scrollText("权重配置");
    await wait(700);
    await clickWeightConfigCheckbox("VIP等级").catch(() => {});
    await clickWeightConfigCheckbox("KYC等级").catch(() => {});
    await clickWeightConfigCheckbox("合约交易量").catch(() => {});
    await clickWeightConfigCheckbox("现货交易量").catch(() => {});
    await clickWeightConfigCheckbox("净充值").catch(() => {});
    await clickWeightConfigCheckbox("领取赠金").catch(() => {});
    await wait(600);
    await selectWeightConfigVipLevels().catch(() => {});
    await fillWeightConfigPrizeWeights(lotteryWeightConfigWeights).catch(() => {});
  }

  async function fillShareInfo() {
    await scrollText("分享信息");
    await wait(450);
    await fillLabel("分享活动文案", shareCopy, 0).catch(() => {});
    await fillLabel("代理分享文案", agentShareCopy, 0).catch(() => {});
    await fillLabel("分享活动文案", englishShareCopy, 1).catch(() => {});
    await fillLabel("代理分享文案", englishAgentShareCopy, 1).catch(() => {});
  }

  async function fillDailyLimit() {
    await scrollText("抽奖日上限");
    await wait(450);
    await clickRadio("是否开启抽奖日上限", "是").catch(() => {});
    await wait(450);
    await fillLabel("每日上限次数", "2").catch(() => {});
  }

  async function fillProbability() {
    await scrollText("奖品概率");
    await wait(450);
    await clickRadio("权重配置模式", "累计").catch(() => {});
    await wait(450);
    await page.evaluate(async () => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")].filter(visible).find(element => /奖品概率/.test(element.innerText));
      if (!table) return false;
      const inputs = [...table.querySelectorAll("input")].filter(visible);
      for (const input of inputs.slice(0, 8)) {
        input.value = "12.5";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }).catch(() => false);
    await wait(450);
  }

  async function enableBeginnerContractTask() {
    await scrollText("新手任务");
    await wait(450);
    await clickRadio("是否启用新手任务", "是").catch(() => {});
    await wait(450);
    await clickRadio("新手任务类型", "合约交易").catch(() => {});
    await wait(450);
  }

  async function fillTask() {
    await scrollText("任务配置");
    await wait(600);
    if (enableBeginnerTask) {
      await enableBeginnerContractTask().catch(() => {});
    }
    const added = [];
    for (const label of activityTaskLabels || []) {
      const result = await ensureSelectLabel("活动任务", label, 0, 0).catch(() => ({ selected: false }));
      if (!result.selected) continue;
      await clickButton("添加").catch(() => {});
      await wait(600);
      added.push({ label, selected: result.value });
      console.log(JSON.stringify({ step: "task_added", ...added[added.length - 1] }));
    }
    return { added };
  }

  async function fillI18n() {
    await scrollText("多语言配置");
    await wait(450);
    await page.locator("xpath=(//*[contains(normalize-space(.),'多语言配置')]/following::label[contains(@class,'el-checkbox')][contains(.,'英语')])[1]").click({ force: true }).catch(() => {});
    await wait(650);
    await fillLabel("活动标题", englishTitle, 1).catch(() => {});
    await fillLabel("活动副标题", englishSubTitle, 1).catch(() => {});
    await fillLabel("分享活动文案", englishShareCopy, 1).catch(() => {});
    await fillLabel("代理分享文案", englishAgentShareCopy, 1).catch(() => {});
    await fillRich("活动规则", englishActivityRules, 1).catch(() => {});
  }

  async function fillFaq() {
    await scrollText("常见问题");
    await page.locator("xpath=(//*[contains(normalize-space(.),'常见问题')]/following::label[contains(@class,'el-checkbox')][contains(.,'英语')])[1]").click({ force: true }).catch(() => {});
    await wait(650);
    let titleInput = page.locator("xpath=(//*[contains(normalize-space(.),'常见问题')]/following::input[contains(@placeholder,'标题')])[1]");
    if (!(await titleInput.isVisible({ timeout: 2500 }).catch(() => false))) {
      await page.locator("xpath=(//*[contains(normalize-space(.),'常见问题')]/following::*[contains(@class,'el-icon-plus')])[1]").click({ force: true }).catch(() => {});
      await wait(500);
      titleInput = page.locator("xpath=(//*[contains(normalize-space(.),'常见问题')]/following::input[contains(@placeholder,'标题')])[1]");
    }
    if (!(await titleInput.isVisible({ timeout: 2500 }).catch(() => false))) return;
    await fillControl(titleInput, faqTitle);
    const editor = page.locator("xpath=(//*[contains(normalize-space(.),'常见问题')]/following::*[contains(@class,'ql-editor')])[1]");
    await fillControl(editor, faqContent);
  }

  async function fillCalendar() {
    await scrollText("活动日历");
    await clickRadio("同步到活动日历", "同步");
    await wait(700);
    await selectLabel("所属一级筛选标签", null, 0, 0).catch(() => {});
    await selectLabel("所属二级筛选标签", null, 0, 0).catch(() => {});
    await uploadLabelAfterSection("活动日历", "配图", 0).catch(() => {});
    await uploadLabelAfterSection("活动日历", "小图标", 0).catch(() => {});
    await selectLabel("所属分区", null, 0, 0).catch(() => {});
    await wait(600);
  }

  return {
    formItem,
    visibleOptionBox,
    clickOption,
    clickVisibleOptionByDom,
    clickRadio,
    ensurePreApplySupport,
    fillControl,
    fillLabel,
    fillDateLabel,
    fillDateLabelWithinOffsetRange,
    fillRich,
    selectLabel,
    readSelectLabelValue,
    ensureSelectLabel,
    readApplyConfigId,
    selectRegistrationTemplate,
    fetchActivityConfigDetail,
    uploadLabel,
    uploadLabelAfterSection,
    clickButton,
    scrollText,
    openLotteryViaMenu,
    clickPrize,
    readPrizeSelections,
    prizeTableBox,
    setPrizeScroll,
    fillPrizeCell,
    uploadPrizeImage,
    selectPrizeMark,
    selectEasterEggType,
    fillPrizeRows,
    fillTableWeightsByMarker,
    clickWeightConfigCheckbox,
    selectWeightConfigVipLevels,
    fillWeightConfigPrizeWeights,
    fillLotteryWeightConfig,
    fillShareInfo,
    fillDailyLimit,
    fillProbability,
    enableBeginnerContractTask,
    fillTask,
    fillI18n,
    fillFaq,
    fillCalendar,
  };
}


#!/usr/bin/env node
import fs from "node:fs";
import { ensureAdminSession, loginToPrizePage } from "./lib/browser.mjs";
import { timestamp } from "./lib/cli.mjs";
import {
  isLotteryDraftCreateSuccessful,
  shouldSearchLotteryListAfterSubmit,
} from "./lib/lottery-draft-verification.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";

const { repoRoot } = pathsFrom(import.meta.url);
loadLocalEnv(repoRoot);
const config = adminConfig(repoRoot);
assertAdminConfig(config);
if (!fs.existsSync(config.imagePath)) throw new Error(`image missing: ${config.imagePath}`);

const { chromium } = loadPlaywright();
const stamp = timestamp();
const titlePrefix = process.env.LOTTERY_TITLE_PREFIX || "严格UI转盘抽奖草稿";
const aliasPrefix = process.env.LOTTERY_ALIAS_PREFIX || "lt";
const title = process.env.LOTTERY_TITLE_EXACT || `${titlePrefix}${stamp}`;
const alias = process.env.LOTTERY_ALIAS_EXACT || buildShortLotteryAlias(aliasPrefix, stamp);
const subTitle = process.env.LOTTERY_SUBTITLE || "严格 UI 复杂配置副标题";
const activityStartTime = process.env.LOTTERY_START || "2026-06-10 00:00:00";
const activityEndTime = process.env.LOTTERY_END || "2026-06-30 23:59:59";
const preApplyStartTime = process.env.LOTTERY_PREAPPLY_START || "2026-06-01 00:00:00";
const preApplyEndTime = process.env.LOTTERY_PREAPPLY_END || "2026-06-09 23:59:59";
const registrationTemplateLabel = process.env.LOTTERY_REGISTRATION_TEMPLATE_LABEL || "【2729】 自动化报名模板_auto_manual_20260505161031";
const guideTemplateLabel = process.env.LOTTERY_GUIDE_TEMPLATE_LABEL || "";
const ownerLabel = process.env.LOTTERY_OWNER || config.username || "auto";
const platformActivity = process.env.LOTTERY_PLATFORM_ACTIVITY || "否";
const activityTaskLabel = process.env.LOTTERY_ACTIVITY_TASK_LABEL || "";
const activityTaskLabels = parseList(process.env.LOTTERY_ACTIVITY_TASK_LABELS).length
  ? parseList(process.env.LOTTERY_ACTIVITY_TASK_LABELS)
  : [activityTaskLabel || "4998-自动化转盘首充100_20260514332054", "4997-自动化转盘现货100_20260514332054", "4996-自动化转盘合约100_20260514332054", "5102-自动化测试 - 非首次充值"];
const enablePreApply = process.env.LOTTERY_PREAPPLY !== "0";
const lotteryStyle = process.env.LOTTERY_STYLE || "圆形转盘";
const shareCopy = process.env.LOTTERY_SHARE_COPY || "严格 UI 分享活动文案";
const agentShareCopy = process.env.LOTTERY_AGENT_SHARE_COPY || "严格 UI 代理分享文案";
const activityRules = process.env.LOTTERY_RULES || "严格 UI 活动规则：完成转盘抽奖复杂配置验证。";
const englishTitle = process.env.LOTTERY_EN_TITLE || `EN ${title}`;
const englishSubTitle = process.env.LOTTERY_EN_SUBTITLE || `EN ${subTitle}`.slice(0, 15);
const englishShareCopy = process.env.LOTTERY_EN_SHARE_COPY || "EN share copy";
const englishAgentShareCopy = process.env.LOTTERY_EN_AGENT_SHARE_COPY || "EN agent copy";
const englishActivityRules = process.env.LOTTERY_EN_RULES || "EN activity rules.";
const faqTitle = process.env.LOTTERY_FAQ_TITLE || "FAQ title";
const faqContent = process.env.LOTTERY_FAQ_CONTENT || "FAQ content";
const keepOpenOnError = process.env.LOTTERY_DEBUG_KEEP_OPEN === "1";
const evidence = { uploads: 0, activityResponses: [] };
const variedMode = process.env.LOTTERY_VARIANT === "varied";
const weightConfigMode = process.env.LOTTERY_WEIGHT_CONFIG === "vip";
const enableBeginnerTask = variedMode || process.env.LOTTERY_ENABLE_BEGINNER_TASK === "1";
const enableDailyLimit = process.env.LOTTERY_ENABLE_DAILY_LIMIT === "1";
const enableAccumulatedWeight = process.env.LOTTERY_ENABLE_ACCUMULATED_WEIGHT === "1";
const prizeAmounts = variedMode ? ["1", "2", "3", "4", "5", "6", "7", "8"] : Array(8).fill("1");
const prizeStocks = variedMode ? ["80", "90", "100", "110", "120", "130", "140", "150"] : Array(8).fill("100");
const prizeWeights = variedMode ? ["5", "8", "10", "12", "13", "15", "17", "20"] : Array(8).fill("12.5");
const configuredPrizeLabels = parseList(process.env.LOTTERY_PRIZE_LABELS);
const prizeLabels = configuredPrizeLabels.length ? expandToEight(configuredPrizeLabels) : [];
const configuredPrizeAmounts = parseList(process.env.LOTTERY_PRIZE_AMOUNTS);
const effectivePrizeAmounts = configuredPrizeAmounts.length ? expandToEight(configuredPrizeAmounts) : prizeAmounts;
const configuredPrizeStocks = parseList(process.env.LOTTERY_PRIZE_STOCKS);
const effectivePrizeStocks = configuredPrizeStocks.length ? expandToEight(configuredPrizeStocks) : prizeStocks;
const redSignWeights = variedMode ? ["4", "6", "8", "10", "12", "14", "18", "28"] : Array(8).fill("12.5");
const whiteSignWeights = variedMode ? ["3", "7", "9", "11", "13", "15", "19", "23"] : Array(8).fill("12.5");
const lotteryWeightConfigWeights = ["5", "8", "10", "12", "13", "15", "17", "20"];
const headlessMode = process.env.LOTTERY_HEADLESS === "1";

const browser = await chromium.launch({
  headless: headlessMode,
  executablePath: config.chromePath,
  slowMo: 120,
  args: ["--window-size=1440,1000"],
});

function buildShortLotteryAlias(prefixValue, stampValue, maxLength = 10) {
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

function parseList(value) {
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

function expandToEight(values) {
  if (!values.length) return [];
  return Array.from({ length: 8 }, (_, index) => values[index % values.length]);
}
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let authHeader = "";
page.on("response", async response => {
  if (response.url().includes("/prod-api/common/upload")) evidence.uploads += 1;
  if (response.url().includes("/prod-api/activity/config") || response.url().includes("/prod-api/activity/lottery")) {
    const entry = {
      url: response.url().replace(/^https?:\/\/[^/]+/, ""),
      method: response.request().method(),
      status: response.status(),
    };
    if (response.request().method() === "POST" || response.request().method() === "PUT") {
      try {
        const body = await response.json();
        entry.code = body?.code;
        entry.msg = body?.msg;
      } catch {}
    }
    evidence.activityResponses.push(entry);
    if (evidence.activityResponses.length > 30) evidence.activityResponses.shift();
  }
});
page.on("request", request => {
  if (request.url().includes("/prod-api/activity/")) authHeader = request.headers().authorization || authHeader;
});

const wait = ms => page.waitForTimeout(ms);
async function formItem(label, nth = 0) {
  return page
    .locator(`xpath=(//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.), "${label}")]])`)
    .nth(nth);
}

async function visibleOptionBox(text = null, index = 0) {
  return page.evaluate(({ text, index }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
    if (!dropdown) return null;
    const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
    const item = text ? items.find(option => option.innerText.trim().includes(text)) : items[index];
    if (!item) return null;
    const rect = item.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: item.innerText.trim() };
  }, { text, index });
}

async function clickOption(option) {
  await page.mouse.click(option.x, option.y);
  await wait(250);
}

async function clickVisibleOptionByDom(text = null, index = 0) {
  const selected = await page.evaluate(({ text, index }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
    if (!dropdown) return null;
    const items = [...dropdown.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)")].filter(visible);
    const item = text
      ? items.find(option => option.innerText.trim() === text || option.innerText.trim().includes(text))
      : items[index];
    if (!item) return null;
    item.scrollIntoView({ block: "center", inline: "nearest" });
    item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    item.click();
    return item.innerText.trim();
  }, { text, index });
  await wait(250);
  return selected;
}

async function clickRadio(label, option, nth = 0) {
  const box = await page.evaluate(({ label, option, nth }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const items = [...document.querySelectorAll(".el-form-item")]
      .filter(visible)
      .filter(item => item.querySelector(".el-form-item__label")?.innerText?.trim().includes(label));
    const item = items[nth];
    if (!item) return { missing: true };
    item.scrollIntoView({ block: "center", inline: "nearest" });
    const radio = [...item.querySelectorAll(".el-radio")]
      .filter(visible)
      .find(element => element.innerText.trim() === option);
    if (!radio) return { missing: true };
    if (radio.getAttribute("aria-checked") === "true") return { checked: true };
    if (radio.classList.contains("is-disabled")) return { checked: radio.classList.contains("is-checked"), disabled: true };
    const rect = radio.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, { label, option, nth });
  if (box?.missing) throw new Error(`radio missing: ${label} ${option}`);
  if (box?.checked) return;
  if (box?.disabled) return;
  await page.mouse.click(box.x, box.y);
  await wait(250);
}

async function ensurePreApplySupport() {
  await clickRadio("是否支持预报名", "支持");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await formItem("预报名模版").then(locator => locator.count()).catch(() => 0)) return;
    await page.evaluate(() => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const item = [...document.querySelectorAll(".el-form-item")]
        .filter(visible)
        .find(element => element.querySelector(".el-form-item__label")?.innerText?.trim().includes("是否支持预报名"));
      item?.scrollIntoView({ block: "center", inline: "nearest" });
      const radio = [...(item?.querySelectorAll(".el-radio") || [])]
        .filter(visible)
        .find(element => element.innerText.trim().includes("支持") && !element.innerText.trim().includes("不支持"));
      radio?.click();
    });
    await wait(800);
  }
  if (!(await formItem("预报名模版").then(locator => locator.count()).catch(() => 0))) {
    throw new Error("pre apply fields did not expand");
  }
}

async function fillControl(locator, value) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.waitFor({ state: "visible", timeout: 7000 }).catch(() => {});
  await locator.fill(String(value), { timeout: 7000 }).catch(async () => {
    await locator.click({ force: true, timeout: 7000 });
    await page.keyboard.type(String(value), { delay: 8 });
  });
  await wait(120);
}

async function fillLabel(label, value, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  await fillControl(item.locator("input:not([type=radio]):not([type=checkbox]), textarea").first(), value);
}

async function fillRich(label, value, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  const editor = item.locator(".ql-editor").first();
  await editor.click({ force: true, timeout: 7000 });
  await editor.evaluate((element, text) => {
    element.innerHTML = "";
    element.textContent = text;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
  await wait(120);
}

async function selectLabel(label, text = null, nth = 0, index = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  const select = item.locator(".el-select").first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const box = await select.boundingBox();
    if (!box) throw new Error(`select missing: ${label}`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await wait(450);
    let selected = await clickVisibleOptionByDom(text, index);
    if (!selected && text) selected = await clickVisibleOptionByDom(null, index);
    if (selected) {
      return selected;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await wait(200);
  }
  throw new Error(`option missing: ${label}`);
}

async function readSelectLabelValue(label, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  return item.locator(".el-select input").first().inputValue().catch(() => "");
}

function selectValueMatches(actual, expected) {
  const current = String(actual || "").trim();
  const target = String(expected || "").trim();
  if (!target) return Boolean(current);
  return current.includes(target) || target.includes(current);
}

async function ensureSelectLabel(label, text = null, nth = 0, index = 0) {
  const current = await readSelectLabelValue(label, nth).catch(() => "");
  if (selectValueMatches(current, text)) return current;
  const selected = await selectLabel(label, text, nth, index);
  const after = await readSelectLabelValue(label, nth).catch(() => "");
  if (!selectValueMatches(after, text || selected)) {
    throw new Error(`select not bound: ${label}; current=${after}; expected=${text || selected}`);
  }
  return after;
}

async function readApplyConfigId() {
  return page.evaluate(() => {
    const roots = [...document.querySelectorAll("*")]
      .map(element => element.__vue__)
      .filter(Boolean)
      .filter(vue => vue.$refs && vue.$refs.baseForm && vue.$refs.styleForm);
    return roots[0]?.$refs?.baseForm?.form?.applyConfigId ?? "";
  }).catch(() => "");
}

async function selectRegistrationTemplate(text) {
  const item = await formItem("用户报名模版");
  if (!(await item.count())) throw new Error("form item missing: 用户报名模版");
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  await item.locator(".el-select").first().click({ timeout: 7000 });
  await wait(600);
  const selected = await page.evaluate(targetText => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dropdown = [...document.querySelectorAll(".el-select-dropdown")].filter(visible).pop();
    const option = [...(dropdown?.querySelectorAll(".el-select-dropdown__item:not(.is-disabled)") || [])]
      .filter(visible)
      .find(element => element.innerText.includes(targetText));
    if (!option) return "";
    option.scrollIntoView({ block: "center", inline: "nearest" });
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    option.click();
    return option.innerText.trim();
  }, text);
  await wait(800);
  const applyConfigId = await readApplyConfigId();
  if (!selected || !applyConfigId) {
    throw new Error(`registration template not bound: selected=${selected || ""}; applyConfigId=${applyConfigId || ""}`);
  }
  return { selected, applyConfigId };
}

async function fetchActivityConfigDetail(detailId, authHeader, attempts = 5) {
  let last = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await page.evaluate(async ({ detailId, authHeader }) => {
      const response = await fetch(`/prod-api/activity/config/${encodeURIComponent(detailId)}`, {
        headers: { Authorization: authHeader },
        credentials: "include",
      });
      return response.json();
    }, { detailId, authHeader }).catch(() => null);
    const prizeCount = Array.isArray(last?.data?.prize) ? last.data.prize.length : 0;
    const taskCount = Array.isArray(last?.data?.taskConfig) ? last.data.taskConfig.length : 0;
    if (prizeCount >= 8 && taskCount > 0) return last;
    if (attempt < attempts - 1) await wait(1500);
  }
  return last;
}

async function uploadLabel(label, nth = 0) {
  const item = await formItem(label, nth);
  if (!(await item.count())) throw new Error(`form item missing: ${label}`);
  await item.scrollIntoViewIfNeeded({ timeout: 5000 });
  await item.locator("input[type=file]").first().setInputFiles(config.imagePath);
  await wait(650);
}

async function clickButton(text, nth = 0) {
  const button = page.locator("button:visible").filter({ hasText: text }).nth(nth);
  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click({ timeout: 8000 });
  await wait(450);
}

async function scrollText(text) {
  await page.locator(`text=${text}`).first().scrollIntoViewIfNeeded().catch(() => {});
  await wait(300);
}

async function openLotteryViaMenu() {
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
      const boundLabel = input?.value?.trim() || "";
      if (!boundLabel || boundLabel !== selectedLabel) return null;
      return boundLabel;
    }, { rowIndex, label });
    if (selected) {
      await wait(250);
      await page.keyboard.press("Escape").catch(() => {});
      await wait(120);
      return;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await wait(250);
  }
  throw new Error(`prize dropdown missing row ${rowIndex + 1}`);
}

async function readPrizeSelections() {
  return page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const rows = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible);
    return rows.map(row => {
      const selects = [...row.querySelectorAll(".el-select")].filter(visible);
      const prizeInput = [...(selects[1]?.querySelectorAll("input") || [])].filter(visible)[0];
      return prizeInput?.value?.trim() || "";
    });
  });
}

async function prizeTableBox() {
  return page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    return Boolean(table);
  });
}

async function setPrizeScroll(left) {
  await page.evaluate(value => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    table?.querySelector(".el-table__body-wrapper")?.scrollTo({ left: value });
    table?.querySelector(".el-table__header-wrapper")?.scrollTo({ left: value });
  }, left);
  await wait(250);
}

async function fillPrizeCell(rowIndex, cellIndex, value) {
  const input = await page.evaluateHandle(({ rowIndex, cellIndex }) => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[rowIndex];
    const cell = [...(row?.querySelectorAll("td") || [])].filter(visible)[cellIndex];
    const input = [...(cell?.querySelectorAll("input:not([type=checkbox])") || [])].filter(visible)[0];
    if (!input) return null;
    input.scrollIntoView({ block: "center", inline: "center" });
    return input;
  }, { rowIndex, cellIndex });
  const element = input.asElement();
  if (!element) throw new Error(`prize input missing row ${rowIndex + 1} cell ${cellIndex}`);
  await element.fill(String(value), { timeout: 5000 });
  await wait(80);
}

async function uploadPrizeImage(rowIndex) {
  const input = await page.evaluateHandle(index => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[index];
    return row?.querySelector("input[type=file]") || null;
  }, rowIndex);
  const element = input.asElement();
  if (!element) throw new Error(`prize image input missing row ${rowIndex + 1}`);
  await element.setInputFiles(config.imagePath);
  await wait(180);
}

async function selectPrizeMark(rowIndex, text) {
  const box = await page.evaluate(index => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[index];
    const input = row?.querySelector('input[placeholder="请选择奖品标记"]');
    if (!input) return null;
    input.scrollIntoView({ block: "center", inline: "center" });
    const rect = input.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, rowIndex);
  if (!box) throw new Error(`prize mark select missing row ${rowIndex + 1}`);
  await page.mouse.click(box.x, box.y);
  await wait(250);
  const option = await visibleOptionBox(text, 0);
  if (!option) throw new Error(`prize mark option missing: ${text}`);
  await clickOption(option);
}

async function selectEasterEggType(rowIndex, text) {
  const box = await page.evaluate(index => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /奖品池ID|奖品名称/.test(element.innerText));
    const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[index];
    const input = row?.querySelector('input[placeholder="请选择彩蛋类型"]');
    if (!input) return null;
    input.scrollIntoView({ block: "center", inline: "center" });
    const rect = input.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, rowIndex);
  if (!box) throw new Error(`easter egg type select missing row ${rowIndex + 1}`);
  await page.mouse.click(box.x, box.y);
  await wait(250);
  const option = await visibleOptionBox(text, 0);
  if (!option) throw new Error(`easter egg type option missing: ${text}`);
  await clickOption(option);
}

async function fillPrizeRows() {
  await scrollText("抽奖奖品配置");
  if (!(await prizeTableBox())) throw new Error("prize table missing");
  for (let index = 0; index < 8; index += 1) {
    await clickPrize(index, prizeLabels[index] || null);
    await fillPrizeCell(index, 4, effectivePrizeAmounts[index]);
    await fillPrizeCell(index, 5, effectivePrizeStocks[index]);
    await uploadPrizeImage(index);
  }
  await setPrizeScroll(1000);
  const marks = ["大奖", "中奖", "小奖", "中奖", "小奖", "中奖", "小奖", "中奖"];
  for (let index = 0; index < 8; index += 1) {
    await fillPrizeCell(index, 7, prizeWeights[index]);
    await selectPrizeMark(index, marks[index]);
  }
  if (lotteryStyle === "彩蛋") {
    await setPrizeScroll(1600);
    const eggTypes = ["金蛋", "银蛋", "铜蛋", "金蛋", "银蛋", "铜蛋", "金蛋", "银蛋"];
    for (let index = 0; index < 8; index += 1) {
      await selectEasterEggType(index, eggTypes[index]);
    }
  }
  await setPrizeScroll(0);
  const selections = await readPrizeSelections();
  if (selections.length !== 8 || selections.some(value => !value)) {
    throw new Error(`prize selection not bound: ${JSON.stringify(selections)}`);
  }
}

async function fillTableWeightsByMarker(marker, values = Array(8).fill("12.5")) {
  await scrollText(marker);
  const table = page.locator(".el-table").filter({ hasText: marker }).first();
  const rowCount = await table.locator(".el-table__body-wrapper tbody tr").count();
  for (let index = 0; index < rowCount; index += 1) {
    await fillControl(table.locator(".el-table__body-wrapper tbody tr").nth(index).locator("input:not([type=checkbox])").last(), values[index] || "0");
  }
}

async function clickWeightConfigCheckbox(text) {
  const clicked = await page.evaluate(labelText => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const dialog = [...document.querySelectorAll(".el-dialog__wrapper")].filter(visible).pop();
    const checkbox = [...(dialog?.querySelectorAll(".el-checkbox") || [])]
      .filter(visible)
      .find(element => element.innerText.trim() === labelText);
    if (!checkbox) return false;
    if (!checkbox.classList.contains("is-checked")) checkbox.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`weight config checkbox missing: ${text}`);
  await wait(250);
}

async function selectWeightConfigVipLevels() {
  for (let index = 0; index < 2; index += 1) {
    const box = await page.evaluate(selectIndex => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const dialog = [...document.querySelectorAll(".el-dialog__wrapper")].filter(visible).pop();
      const table = [...(dialog?.querySelectorAll(".el-table") || [])]
        .filter(visible)
        .find(element => /VIP等级/.test(element.innerText));
      const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[0];
      const selects = [...(row?.querySelectorAll(".el-select") || [])].filter(visible);
      const select = selects[selectIndex];
      if (!select) return null;
      select.scrollIntoView({ block: "center", inline: "center" });
      const rect = select.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, index);
    if (!box) throw new Error(`VIP level select missing: ${index + 1}`);
    await page.mouse.click(box.x, box.y);
    await wait(350);
    const option = await visibleOptionBox(null, 0);
    if (!option) throw new Error(`VIP level option missing: ${index + 1}`);
    await clickOption(option);
  }
}

async function fillWeightConfigPrizeWeights(values = lotteryWeightConfigWeights) {
  for (let index = 0; index < 8; index += 1) {
    const input = await page.evaluateHandle(inputIndex => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const dialog = [...document.querySelectorAll(".el-dialog__wrapper")].filter(visible).pop();
      const table = [...(dialog?.querySelectorAll(".el-table") || [])]
        .filter(visible)
        .find(element => /VIP等级/.test(element.innerText));
      const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[0];
      const cells = [...(row?.querySelectorAll("td") || [])].filter(visible);
      const weightCell = cells.find(cell => cell.querySelectorAll("input:not([disabled])").length >= 8) || cells[4];
      return [...(weightCell?.querySelectorAll("input:not([type=checkbox])") || [])].filter(visible)[inputIndex] || null;
    }, index);
    const element = input.asElement();
    if (!element) throw new Error(`weight config prize weight missing ${index + 1}`);
    await element.fill(values[index], { timeout: 5000 });
    await wait(70);
  }
}

async function fillLotteryWeightConfig() {
  await scrollText("抽奖权重配置");
  await page.locator("text=未配置").first().click({ force: true });
  await wait(800);
  await clickWeightConfigCheckbox("VIP");
  await page.locator(".el-dialog__wrapper:visible button:visible").filter({ hasText: "添加" }).first().click();
  await wait(800);
  await selectWeightConfigVipLevels();
  await fillWeightConfigPrizeWeights();
  await page.locator(".el-dialog__wrapper:visible button:visible").filter({ hasText: "隐藏" }).first().click();
  await wait(800);
}

async function fillShareInfo() {
  await scrollText("配置分享信息");
  for (let index = 1; index <= 8; index += 1) {
    await page.locator(".el-tabs__item").filter({ hasText: `奖品(${index})` }).last().click({ force: true });
    await wait(350);
    const pane = page.locator(".el-tab-pane:visible").filter({ hasText: "奖品名称" }).first();
    await pane.locator("input[type=file]").first().setInputFiles(config.imagePath);
    await wait(450);
    await fillControl(pane.locator(".el-form-item").filter({ hasText: "分享文案" }).locator("input,textarea").first(), `奖品${index} 分享文案`);
    await fillControl(pane.locator(".el-form-item").filter({ hasText: "奖品名称" }).locator("input,textarea").first(), `奖品${index}`);
  }
}

async function fillDailyLimit() {
  await scrollText("奖品每日限制配置");
  const row = page.locator(".el-table").filter({ hasText: "奖励开始后+N" }).first().locator(".el-table__body-wrapper tbody tr").first();
  await fillControl(row.locator("input").nth(0), "1");
  await fillControl(row.locator("input").nth(1), "1");
  await fillControl(row.locator("input").nth(2), "100");
}

async function fillProbability() {
  await fillLabel("累计抽奖次数", "5");
  await clickButton("添加");
  await wait(800);
  const rowCount = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const table = [...document.querySelectorAll(".el-table")]
      .filter(visible)
      .find(element => /累计抽奖次数N/.test(element.innerText));
    return [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible).length;
  });
  for (let index = 0; index < Math.min(rowCount, 8); index += 1) {
    const input = await page.evaluateHandle(rowIndex => {
      const visible = element => !!element && element.getClientRects().length
        && getComputedStyle(element).display !== "none"
        && getComputedStyle(element).visibility !== "hidden";
      const table = [...document.querySelectorAll(".el-table")]
        .filter(visible)
        .find(element => /累计抽奖次数N/.test(element.innerText));
      const row = [...(table?.querySelectorAll(".el-table__body-wrapper tbody tr") || [])].filter(visible)[rowIndex];
      const cell = [...(row?.querySelectorAll("td") || [])].filter(visible)[2];
      return cell?.querySelector("input:not([type=radio]):not([type=checkbox])") || null;
    }, index);
    const element = input.asElement();
    if (!element) throw new Error(`probability weight input missing row ${index + 1}`);
    await element.fill(prizeWeights[index] || "0", { timeout: 5000 });
    await wait(80);
  }
}

async function enableBeginnerContractTask() {
  await scrollText("活动任务信息");
  const clicked = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const target = [...document.querySelectorAll(".el-switch")]
      .filter(visible)
      .find(element => element.innerText.includes("启用新手活动合约任务"));
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "nearest" });
    if (!target.classList.contains("is-checked")) target.click();
    return true;
  });
  if (!clicked) throw new Error("beginner task switch missing");
  await wait(800);
  const table = page.locator(".el-table").filter({ hasText: "排序系数" }).last();
  const rowCount = await table.locator(".el-table__body-wrapper tbody tr").count();
  for (let index = 0; index < rowCount; index += 1) {
    await fillControl(table.locator(".el-table__body-wrapper tbody tr").nth(index).locator("input:not([type=checkbox])").last(), String(index + 1)).catch(() => {});
  }
}

async function fillTask() {
  await scrollText("活动任务信息");
  const addedRows = [];
  const card = page.locator(".el-card").filter({ hasText: "活动任务信息" }).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  for (let index = 0; index < activityTaskLabels.length; index += 1) {
    const taskText = activityTaskLabels[index];
    const select = card.locator(".el-select:visible").first();
    await select.click({ timeout: 7000 });
    await wait(700);
    const selected = await clickVisibleOptionByDom(taskText, 0)
      || await clickVisibleOptionByDom("合约", 0)
      || await clickVisibleOptionByDom(null, 0);
    if (!selected) throw new Error(`activity task option missing: ${taskText}`);
    const rowCountBefore = await card.locator(".el-table__body-wrapper tbody tr").count().catch(() => 0);
    await card.locator("button.el-button--primary:visible").first().click({ timeout: 7000 });
    await wait(900);
    const rows = card.locator(".el-table__body-wrapper tbody tr");
    const rowCountAfter = await rows.count();
    if (rowCountAfter <= rowCountBefore) {
      throw new Error(`activity task row not added: ${taskText}`);
    }
    const row = rows.nth(rowCountAfter - 1);
    const sortInput = row.locator('input[placeholder*="排序"], input:not([type=checkbox]):not([type=radio])').last();
    await fillControl(sortInput, String(index + 1));
    const added = {
      ok: true,
      selected,
      row: (await row.innerText()).trim().replace(/\s+/g, " "),
    };
    if (!added.ok) throw new Error(`activity task config failed: ${JSON.stringify(added)}`);
    addedRows.push(added);
    console.log(JSON.stringify({ step: "task_added", ...added }));
  }
  if (enableBeginnerTask) await enableBeginnerContractTask();
}

async function fillI18n() {
  await scrollText("多语言");
  await page.locator("xpath=(//*[contains(normalize-space(.),'多语言')]/following::label[contains(@class,'el-checkbox')][contains(.,'英语')])[1]").click({ force: true }).catch(() => {});
  await wait(600);
  await fillLabel("活动标题", englishTitle, 1).catch(() => {});
  await fillLabel("活动副标题", englishSubTitle, 1).catch(() => {});
  for (const label of ["WEB头图上传", "H5头图上传", "web分享图上传", "H5分享图片上传"]) {
    await uploadLabel(label, 1).catch(() => {});
  }
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
  await uploadLabel("配图", 0).catch(() => {});
  await uploadLabel("小图标", 0).catch(() => {});
  await selectLabel("所属分区", null, 0, 0).catch(() => {});
  await wait(600);
}

try {
  console.log(JSON.stringify({ step: "start", title, alias, activityStartTime, activityEndTime, lotteryStyle }));
  await openLotteryViaMenu();
  await clickButton("新增");
  await page.waitForURL(/\/activities\/lottery\/add/, { timeout: 15000 });
  await wait(3000);

  console.log(JSON.stringify({ step: "basic" }));
  await clickRadio("配置类型", "正式活动");
  await fillLabel("负责人", ownerLabel);
  await selectLabel("类别配置", "通用");
  await selectLabel("流程引导配置", guideTemplateLabel || null, 0, 0);
  await clickRadio("是否为平台活动", platformActivity);
  await fillLabel("活动标题", title, 0);
  await fillLabel("活动副标题", subTitle, 0);
  await fillLabel("活动开始时间", activityStartTime);
  await fillLabel("活动结束时间", activityEndTime);
  await selectRegistrationTemplate(registrationTemplateLabel);
  for (const label of ["WEB头图上传", "H5头图上传", "web分享图上传", "H5分享图片上传", "社媒活动预览图上传"]) await uploadLabel(label, 0);
  await fillLabel("分享活动文案", shareCopy, 0);
  await fillLabel("代理分享文案", agentShareCopy, 0);
  await fillRich("活动规则", activityRules, 0);
  await fillLabel("活动别名配置", alias);
  if (enablePreApply) {
    await ensurePreApplySupport();
    await selectLabel("预报名模版", null, 0, 0);
    await fillLabel("预报名开始时间", preApplyStartTime);
    await fillLabel("预报名结束时间", preApplyEndTime);
  } else {
    await clickRadio("是否支持预报名", "不支持");
  }
  await clickRadio("是否显示活动日历入口", "是");
  await selectLabel("抽奖样式", lotteryStyle).catch(() => {});
  if (!(await readApplyConfigId())) await selectRegistrationTemplate(registrationTemplateLabel);

  console.log(JSON.stringify({ step: "prizes" }));
  await fillPrizeRows();
  console.log(JSON.stringify({ step: "prizes_done", count: 8 }));
  if (weightConfigMode) {
    console.log(JSON.stringify({ step: "lottery_weight_config" }));
    await fillLotteryWeightConfig();
  }
  console.log(JSON.stringify({ step: "color_tags" }));
  await fillTableWeightsByMarker("红签", redSignWeights);
  await fillTableWeightsByMarker("白签", whiteSignWeights);
  console.log(JSON.stringify({ step: "share" }));
  await fillShareInfo();
  if (enableDailyLimit) {
    console.log(JSON.stringify({ step: "daily" }));
    await fillDailyLimit();
  }
  if (enableAccumulatedWeight) {
    console.log(JSON.stringify({ step: "probability" }));
    await fillProbability();
  }
  console.log(JSON.stringify({ step: "task" }));
  await fillTask();
  console.log(JSON.stringify({ step: "i18n" }));
  await fillI18n();
  console.log(JSON.stringify({ step: "faq" }));
  await fillFaq();
  console.log(JSON.stringify({ step: "calendar" }));
  await fillCalendar();
  if (!(await readApplyConfigId())) {
    await selectRegistrationTemplate(registrationTemplateLabel);
  }

  console.log(JSON.stringify({ step: "submit" }));
  const preSubmitDiagnostics = await page.evaluate(async () => {
    const roots = [...document.querySelectorAll("*")]
      .map(element => element.__vue__)
      .filter(Boolean)
      .filter(vue => vue.$refs && vue.$refs.baseForm && vue.$refs.styleForm);
    const root = roots[0];
    if (!root) return { found: false };
    const refs = root.$refs;
    const result = { found: true };
    const summarize = value => {
      if (value === false) return false;
      if (value === true) return true;
      if (Array.isArray(value)) return { type: "array", length: value.length };
      if (value && typeof value === "object") return { type: "object", keys: Object.keys(value), size: Object.keys(value).length };
      return value ?? null;
    };
    for (const [name, method] of [
      ["baseForm", "submit"],
      ["prizeConfigForm", "submit"],
      ["prizeWeightForm", "submit"],
      ["colorTagConfigForm", "submit"],
      ["shareInfoForm", "submit"],
      ["dailyLimitForm", "submit"],
      ["prizeProbabilityForm", "submit"],
      ["activityTaskForm", "submit"],
      ["i18nConfigForm", "submit"],
      ["faqForm", "submit"],
      ["styleForm", "submit"],
    ]) {
      try {
        result[name] = summarize(await refs[name]?.[method]?.());
      } catch (error) {
        result[name] = { error: error.message };
      }
    }
    try {
      await refs.activityCalendarConfig?.validate?.();
      result.activityCalendarConfig = { validate: true, data: summarize(refs.activityCalendarConfig?.getData?.()) };
    } catch (error) {
      result.activityCalendarConfig = { validate: false, error: error.message };
    }
    result.baseFormModel = {
      applyConfigId: refs.baseForm?.form?.applyConfigId ?? null,
      guideTemplateId: refs.baseForm?.form?.guideTemplateId ?? null,
      showUrl: refs.baseForm?.form?.showUrl ?? null,
      registrationInputValue: [...document.querySelectorAll(".el-form-item")]
        .find(item => item.querySelector(".el-form-item__label")?.innerText?.trim().includes("用户报名模版"))
        ?.querySelector(".el-select input")?.value || "",
    };
    return result;
  }).catch(error => ({ error: error.message }));
  const createPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config") && response.request().method() === "POST"
  ), { timeout: 25000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight));
  await wait(700);
  const submitBox = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const buttons = [...document.querySelectorAll("button")]
      .filter(button => visible(button) && button.innerText.trim() === "新增")
      .map(button => {
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, bottom: rect.bottom };
      })
      .sort((a, b) => b.bottom - a.bottom);
    return buttons[0] || null;
  });
  if (!submitBox) throw new Error("submit button not found");
  await page.mouse.click(submitBox.x, submitBox.y);
  const createResponse = await createPromise;
  let createBody = null;
  if (createResponse) {
    try { createBody = await createResponse.json(); } catch {}
  }
  await wait(2500);
  const errors = await page.evaluate(() => {
    const formErrors = [...document.querySelectorAll(".el-form-item.is-error")].map(item => ({
      label: item.querySelector(".el-form-item__label")?.innerText?.trim() || "",
      error: item.querySelector(".el-form-item__error")?.innerText?.trim() || "",
      text: item.innerText.trim().slice(0, 120),
    }));
    const messages = [...document.querySelectorAll(".el-message,.el-message-box,.el-notification")]
      .map(element => element.innerText.trim())
      .filter(Boolean);
    return { formErrors: formErrors.slice(0, 80), messages: messages.slice(0, 20) };
  });
  let verify = null;
  if (authHeader) {
    verify = await page.evaluate(async ({ activityAlias, authHeader }) => {
      const response = await fetch(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(activityAlias)}`, {
        headers: { Authorization: authHeader },
        credentials: "include",
      });
      return response.json();
    }, { activityAlias: alias, authHeader });
  }
  const verifyListItem = verify?.rows?.[0] || verify?.data?.[0] || null;
  let verifyDetail = null;
  if (authHeader && (verifyListItem?.activityId || verifyListItem?.id)) {
    const detailId = String(verifyListItem.activityId || verifyListItem.id);
    verifyDetail = await fetchActivityConfigDetail(detailId, authHeader);
  }
  const shouldSearchList = shouldSearchLotteryListAfterSubmit({
    currentUrl: page.url(),
    authHeader,
  });
  if (!verify && shouldSearchList) {
    await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
    await wait(1800);
    const aliasItem = await formItem("活动别名");
    await fillControl(aliasItem.locator("input").first(), alias);
    await page.locator("button:visible").filter({ hasText: "查询" }).first().click();
    await wait(1500);
  }
  const ok = isLotteryDraftCreateSuccessful({ createBody, verify });
  console.log(JSON.stringify({
    ok,
    title,
    alias,
    lotteryStyle,
    activityTime: {
      start: activityStartTime,
      end: activityEndTime,
    },
    finalUrl: page.url(),
    createStatus: createResponse?.status?.(),
    createBody,
    errors,
    preSubmitDiagnostics,
    verifyTotal: verify?.total,
    verifyFirst: verifyDetail?.data || verifyListItem,
    verifyListFirst: verifyListItem,
    skippedUiSearchAfterSubmit: !shouldSearchList,
    uploads: evidence.uploads,
    activityResponses: evidence.activityResponses,
  }, null, 2));
  await wait(5000);
  if (!ok) process.exitCode = 1;
} catch (error) {
  const errors = await page.evaluate(() => {
    const formErrors = [...document.querySelectorAll(".el-form-item.is-error")].map(item => ({
      label: item.querySelector(".el-form-item__label")?.innerText?.trim() || "",
      error: item.querySelector(".el-form-item__error")?.innerText?.trim() || "",
      text: item.innerText.trim().slice(0, 120),
    }));
    const messages = [...document.querySelectorAll(".el-message,.el-message-box,.el-notification")]
      .map(element => element.innerText.trim())
      .filter(Boolean);
    return { formErrors: formErrors.slice(0, 80), messages: messages.slice(0, 20) };
  }).catch(() => []);
  console.error(JSON.stringify({ ok: false, error: error.message, url: page.url(), title, alias, errors, uploads: evidence.uploads, activityResponses: evidence.activityResponses }, null, 2));
  if (keepOpenOnError && !headlessMode) {
    console.error(JSON.stringify({ debug: true, message: "browser kept open on error for manual inspection", url: page.url(), alias }, null, 2));
    await wait(30 * 60 * 1000).catch(() => {});
  } else {
    await wait(5000).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  if (!(keepOpenOnError && process.exitCode && !headlessMode)) {
    await browser.close().catch(() => {});
  }
}

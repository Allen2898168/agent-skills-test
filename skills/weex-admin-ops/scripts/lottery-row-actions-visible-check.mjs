#!/usr/bin/env node
import { loginToPrizePage, sleep } from "./lib/browser.mjs";
import { timestamp } from "./lib/cli.mjs";
import { clickRowActionByText, confirmMessageBox, fillLabel, tableRows } from "./lib/element-ui.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";

const { repoRoot } = pathsFrom(import.meta.url);
loadLocalEnv(repoRoot);
const config = adminConfig(repoRoot);
assertAdminConfig(config);

const targetId = process.env.LOTTERY_ROW_ACTION_ID || "9023";
const targetAlias = process.env.LOTTERY_ROW_ACTION_ALIAS || "strict-ui-lottery-20260507200430";
const fallbackDraftId = process.env.LOTTERY_ROW_ACTION_DRAFT_ID || "9022";
const fallbackDraftAlias = process.env.LOTTERY_ROW_ACTION_DRAFT_ALIAS || "strict-ui-lottery-20260507193419";
const skipCopy = process.env.LOTTERY_ROW_ACTION_SKIP_COPY === "1";
const stamp = timestamp();
const copiedAlias = `copy-delete-lottery-${stamp}`;
const copiedTitle = `复制删除验证转盘抽奖${stamp}`;
const modifiedSubtitle = `行操作修改验证${stamp}`;
const responses = [];
let authHeader = "";

const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: false,
  executablePath: config.chromePath,
  slowMo: 100,
  args: ["--window-size=1440,1000"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

page.on("request", request => {
  const url = request.url();
  if (url.includes("/prod-api/activity/config/list")) authHeader = request.headers().authorization || authHeader;
});
page.on("response", async response => {
  const url = response.url();
  if (!url.includes("/prod-api/activity/config") && !url.includes("/prod-api/activity/lottery")) return;
  const entry = {
    method: response.request().method(),
    url: url.replace(/^https?:\/\/[^/]+/, ""),
    status: response.status(),
  };
  try {
    const body = await response.json();
    entry.code = body?.code;
    entry.msg = body?.msg;
    if (body?.data && typeof body.data !== "object") entry.data = body.data;
  } catch {}
  responses.push(entry);
});

async function openLotteryViaMenu() {
  await loginToPrizePage(page, config);
  await sleep(1000);
  if (!(await page.locator("text=转盘抽奖").first().isVisible().catch(() => false))) {
    await page.locator("text=活动列表").first().click();
    await sleep(400);
  }
  await page.locator("text=转盘抽奖").first().click();
  await page.waitForURL(/\/activities\/lottery/, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
}

async function searchByAlias(alias) {
  await page.goto(`${config.baseUrl}/activities/lottery`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await fillLabel(page, "活动别名", alias);
  const listPromise = page.waitForResponse(response => response.url().includes("/prod-api/activity/config/list") && response.request().method() === "GET", { timeout: 15000 }).catch(() => null);
  await page.locator("button:visible").filter({ hasText: "查询" }).first().click();
  await listPromise;
  await sleep(900);
  const rows = await tableRows(page);
  const row = rows.find(cells => cells.some(cell => cell === alias || cell.includes(alias)));
  return { row, rows };
}

async function apiListByAlias(alias) {
  if (!authHeader) return null;
  return page.evaluate(async ({ alias, authHeader }) => {
    const response = await fetch(`/prod-api/activity/config/list?pageNum=1&pageSize=10&type=LOTTERY&showUrl=${encodeURIComponent(alias)}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return response.json();
  }, { alias, authHeader });
}

async function apiRecentList() {
  if (!authHeader) return null;
  return page.evaluate(async authHeader => {
    const response = await fetch("/prod-api/activity/config/list?pageNum=1&pageSize=20&type=LOTTERY", {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return response.json();
  }, authHeader);
}

async function apiDetail(id) {
  if (!authHeader) return null;
  return page.evaluate(async ({ id, authHeader }) => {
    const response = await fetch(`/prod-api/activity/config/${id}`, {
      headers: { Authorization: authHeader },
      credentials: "include",
    });
    return response.json();
  }, { id, authHeader });
}

async function visibleRowActions(rowText) {
  return page.evaluate(text => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const mainRows = [...document.querySelectorAll(".el-table__body-wrapper tbody tr")].filter(visible);
    const index = mainRows.findIndex(row => (row.innerText || "").includes(text));
    if (index < 0) return [];
    const fixedRows = [...document.querySelectorAll(".el-table__fixed-right .el-table__fixed-body-wrapper tbody tr")].filter(visible);
    const row = fixedRows[index] || mainRows[index];
    return [...row.querySelectorAll("button")].filter(visible).map(button => button.innerText.trim()).filter(Boolean);
  }, String(rowText));
}

async function clickBottomButton(label) {
  const box = await page.evaluate(buttonText => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const buttons = [...document.querySelectorAll("button")]
      .filter(button => visible(button) && button.innerText.trim() === buttonText)
      .map(button => {
        button.scrollIntoView({ block: "center", inline: "nearest" });
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, bottom: rect.bottom };
      })
      .sort((a, b) => b.bottom - a.bottom);
    return buttons[0] || null;
  }, label);
  if (!box) throw new Error(`button not found: ${label}`);
  await page.mouse.click(box.x, box.y);
  await sleep(800);
}

async function fillIfPresent(label, value, nth = 0) {
  try {
    await fillLabel(page, label, value, nth);
    return true;
  } catch {
    return false;
  }
}

async function submitCopyForm() {
  await fillIfPresent("活动标题", copiedTitle, 0);
  await fillIfPresent("活动别名配置", copiedAlias, 0);
  const submitResponse = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config") && response.request().method() === "POST"
  ), { timeout: 30000 }).catch(() => null);
  await clickBottomButton("新增");
  const response = await submitResponse;
  await sleep(2500);
  let body = null;
  try { body = await response?.json(); } catch {}
  return { httpStatus: response?.status?.(), code: body?.code, msg: body?.msg };
}

async function copySource(sourceAlias, sourceId) {
  await searchByAlias(sourceAlias);
  const before = await apiRecentList();
  const beforeIds = new Set((before?.rows || []).map(row => String(row.id)));
  const copyResponsePromise = page.waitForResponse(response => (
    /\/prod-api\/activity\/(config|lottery)/.test(response.url()) && response.request().method() === "POST" && response.url().includes("copy")
  ), { timeout: 12000 }).catch(() => null);
  await clickRowActionByText(page, sourceAlias, "复制");
  await sleep(2000);
  const directCopyResponse = await copyResponsePromise;
  let directCopyBody = null;
  try { directCopyBody = await directCopyResponse?.json(); } catch {}
  let copySubmit = null;
  let copiedSearch = null;
  if (/\/activities\/lottery\/(add|copy)/.test(page.url()) || (await page.locator("text=活动别名配置").first().isVisible().catch(() => false))) {
    copySubmit = await submitCopyForm();
    copiedSearch = await apiListByAlias(copiedAlias);
    return {
      sourceAlias,
      sourceId,
      directCopyHttpStatus: directCopyResponse?.status?.(),
      directCopyCode: directCopyBody?.code,
      directCopyMsg: directCopyBody?.msg,
      copySubmit,
      copied: copiedSearch?.rows?.[0] || copiedSearch?.data?.[0] || null,
      copiedAlias,
    };
  }
  if (!directCopyResponse || directCopyResponse.status() >= 400 || directCopyBody?.code !== 200) {
    return {
      sourceAlias,
      sourceId,
      directCopyHttpStatus: directCopyResponse?.status?.(),
      directCopyCode: directCopyBody?.code,
      directCopyMsg: directCopyBody?.msg,
      copied: null,
    };
  }
  const after = await apiRecentList();
  const copied = (after?.rows || [])
    .filter(row => !beforeIds.has(String(row.id)) && String(row.id) !== String(sourceId))
    .sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
  return {
    sourceAlias,
    sourceId,
    directCopyHttpStatus: directCopyResponse.status(),
    directCopyCode: directCopyBody?.code,
    directCopyMsg: directCopyBody?.msg,
    copySubmit,
    copied,
    copiedAlias: copied?.showUrl || copied?.activityUrl || copied?.alias || copiedAlias,
  };
}

async function submitModifyForm() {
  await fillIfPresent("活动副标题", modifiedSubtitle, 0);
  const submitResponse = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config") && ["PUT", "POST"].includes(response.request().method())
  ), { timeout: 30000 }).catch(() => null);
  const saveButton = page.locator("button:visible").filter({ hasText: "保存" }).last();
  if (await saveButton.count()) {
    await saveButton.scrollIntoViewIfNeeded().catch(() => {});
    await saveButton.click({ force: true });
  } else {
    await clickBottomButton("修改").catch(async () => clickBottomButton("新增"));
  }
  const response = await submitResponse;
  await sleep(2500);
  let body = null;
  try { body = await response?.json(); } catch {}
  return { method: response?.request?.().method(), httpStatus: response?.status?.(), code: body?.code, msg: body?.msg };
}

async function deleteCopiedRow(id, alias) {
  await searchByAlias(alias);
  const actions = await visibleRowActions(alias);
  if (!actions.includes("删除")) throw new Error(`copied row has no delete button: ${actions.join(",")}`);
  const deleteResponsePromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/lottery/delete")
      && response.request().method() === "POST"
  ), { timeout: 20000 }).catch(() => null);
  await clickRowActionByText(page, alias, "删除");
  const confirmText = await fillCodeAndConfirmMessageBox("确认删除");
  const deleteResponse = await deleteResponsePromise;
  await sleep(1500);
  let body = null;
  try { body = await deleteResponse?.json(); } catch {}
  const remaining = await apiListByAlias(alias);
  return {
    id,
    confirmText: confirmText.replace(/\s+/g, " ").slice(0, 120),
    httpStatus: deleteResponse?.status?.(),
    code: body?.code,
    msg: body?.msg,
    remainingTotal: remaining?.total,
  };
}

async function fillCodeAndConfirmMessageBox(expectedText = "") {
  const box = page.locator(".el-message-box:visible, .el-message-box__wrapper:visible").last();
  await box.waitFor({ timeout: 10000 });
  const text = await box.innerText();
  if (expectedText && !text.includes(expectedText)) throw new Error(`Message box did not include expected text: ${expectedText}`);
  const input = box.locator("input:visible").first();
  if (await input.count()) {
    await input.fill(process.env.WEEX_ADMIN_GOOGLE_CODE || config.googleCode);
  }
  const confirm = box.locator('button:has-text("确定")').last();
  await confirm.click({ force: true });
  await sleep(500);
  return text;
}

try {
  await openLotteryViaMenu();
  const originalSearch = await searchByAlias(targetAlias);
  if (!originalSearch.row) throw new Error(`original row not found: ${targetAlias}`);
  const originalActions = await visibleRowActions(targetAlias);
  const originalList = await apiListByAlias(targetAlias);
  const original = originalList?.rows?.[0] || originalList?.data?.[0] || {};

  const viewResponsePromise = page.waitForResponse(response => response.url().includes(`/prod-api/activity/config/${targetId}`) && response.request().method() === "GET", { timeout: 15000 }).catch(() => null);
  await clickRowActionByText(page, targetAlias, "查看");
  await page.waitForURL(/\/activities\/lottery\/view/, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  const viewResponse = await viewResponsePromise;
  const viewBody = await viewResponse?.json().catch(() => null);
  const viewUrl = page.url();
  const viewTextMatched = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).includes(targetAlias);

  await searchByAlias(targetAlias);
  await clickRowActionByText(page, targetAlias, "修改");
  await page.waitForURL(/\/activities\/lottery\/(edit|add|update)/, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  const originalModifyUrl = page.url();
  const originalModifyLoaded = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).includes("活动标题");

  let originalCopy = null;
  let effectiveCopy = null;
  if (skipCopy) {
    effectiveCopy = {
      sourceAlias: targetAlias,
      sourceId: targetId,
      skipped: true,
      copied: original,
      copiedAlias: targetAlias,
    };
  } else {
    originalCopy = await copySource(targetAlias, targetId);
    effectiveCopy = originalCopy;
  }
  if (!skipCopy && !(effectiveCopy.copied?.id || effectiveCopy.copied?.activityId)) {
    const fallbackSearch = await searchByAlias(fallbackDraftAlias);
    if (!fallbackSearch.row) throw new Error(`fallback draft row not found after online copy failure: ${fallbackDraftAlias}`);
    effectiveCopy = await copySource(fallbackDraftAlias, fallbackDraftId);
  }
  const copied = effectiveCopy.copied;
  const copiedId = copied?.id || copied?.activityId;
  const effectiveCopiedAlias = effectiveCopy.copiedAlias || copiedAlias;
  if (!copiedId) throw new Error(`copy did not create searchable draft from ${effectiveCopy.sourceAlias}`);

  await searchByAlias(effectiveCopiedAlias);
  const copiedActions = await visibleRowActions(effectiveCopiedAlias);
  await clickRowActionByText(page, effectiveCopiedAlias, "修改");
  await page.waitForURL(/\/activities\/lottery\/(edit|add|update)/, { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  const modifySubmit = await submitModifyForm();
  const modifiedDetail = await apiDetail(copiedId);
  const modifiedData = modifiedDetail?.data || {};

  const deleteResult = await deleteCopiedRow(copiedId, effectiveCopiedAlias);
  const originalAfter = await apiDetail(targetId);
  const passed = (skipCopy || originalCopy?.copied?.id || originalCopy?.copied?.activityId)
    && modifySubmit?.code === 200
    && deleteResult?.code === 200
    && deleteResult?.remainingTotal === 0;

  console.log(JSON.stringify({
    ok: passed,
    original: {
      id: targetId,
      alias: targetAlias,
      status: original.status,
      rowActions: originalActions,
      deleteButtonVisible: originalActions.includes("删除"),
    },
    view: {
      url: viewUrl.replace(config.baseUrl, ""),
      httpStatus: viewResponse?.status?.(),
      code: viewBody?.code,
      pageContainsAlias: viewTextMatched,
    },
    originalModifyOpen: {
      url: originalModifyUrl.replace(config.baseUrl, ""),
      loaded: originalModifyLoaded,
      saved: false,
      note: "online original modify page opened only; save was tested on copied draft",
    },
    copy: {
      onlineOriginalCopyAttempt: originalCopy,
      skipped: skipCopy,
      effectiveSourceAlias: effectiveCopy.sourceAlias,
      alias: effectiveCopiedAlias,
      id: copiedId,
      status: copied.status,
      rowActions: copiedActions,
    },
    modifyCopiedDraft: {
      id: copiedId,
      subtitle: modifiedData.subTitle || modifiedData.subtitle || null,
      submit: modifySubmit,
      detailCode: modifiedDetail?.code,
      subtitleMatched: JSON.stringify(modifiedData).includes(modifiedSubtitle),
    },
    deleteCopiedDraft: deleteResult,
    originalAfter: {
      id: targetId,
      code: originalAfter?.code,
      status: originalAfter?.data?.status,
      stillOnline: originalAfter?.data?.status === "ONLINE",
    },
    compactResponses: responses.slice(-30),
    finalUrl: page.url().replace(config.baseUrl, ""),
  }, null, 2));
  if (!passed) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    url: page.url().replace(config.baseUrl, ""),
    compactResponses: responses.slice(-30),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await sleep(5000).catch(() => {});
  await browser.close().catch(() => {});
}

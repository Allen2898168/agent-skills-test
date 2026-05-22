import { sleep } from "../../lib/browser.mjs";
import { clickButton, fillInputByPlaceholder, tableRows } from "../../lib/element-ui.mjs";

export async function runTaskSearchChecks(page, config, created) {
  const target = pickTaskSearchTarget(created);
  if (!target) {
    return {
      byId: { ok: false, reason: "missing_target" },
      byAlias: { ok: false, reason: "missing_target" },
      byTag: { ok: false, reason: "missing_target" },
      byRemark: { ok: false, reason: "missing_target" },
      byStartTime: { ok: false, reason: "missing_target" },
      byEndTime: { ok: false, reason: "missing_target" },
    };
  }

  return {
    byId: await verifyTaskSearchById(page, config, target),
    byAlias: await verifyTaskSearchByAlias(page, config, target),
    byTag: await verifyTaskSearchByTag(page, config, target),
    byRemark: await verifyTaskSearchByRemark(page, config, target),
    byStartTime: await verifyTaskSearchByStartTime(page, config, target),
    byEndTime: await verifyTaskSearchByEndTime(page, config, target),
  };
}

export function rowToTask(row) {
  const cells = normalizeTaskRow(row);
  return {
    id: String(cells?.[0] || "").trim(),
    alias: String(cells?.[1] || "").trim(),
    content: String(cells?.[2] || "").trim(),
    scope: String(cells?.[3] || "").trim(),
    riskControl: String(cells?.[4] || "").trim(),
    manualAuditScore: String(cells?.[5] || "").trim(),
    manualAuditLabels: String(cells?.[6] || "").trim(),
    manualAuditCountries: String(cells?.[7] || "").trim(),
    inviteCode: String(cells?.[8] || "").trim(),
    agencyGroup: String(cells?.[9] || "").trim(),
    tag: String(cells?.[10] || "").trim(),
    remark: String(cells?.[11] || "").trim(),
    updatedAt: String(cells?.[12] || "").trim(),
    editor: String(cells?.[13] || "").trim(),
    row,
  };
}

function pickTaskSearchTarget(created) {
  return created.find(item => item?.id && item?.name && item?.tag && item?.remark && item?.updatedAt) || null;
}

async function verifyTaskSearchById(page, config, target) {
  const result = await searchTaskList(page, config, page => fillInputByPlaceholder(page, "任务编号", target.id));
  const rows = result.rows.map(rowToTask);
  return {
    ok: rows.length > 0 && rows.every(item => item.id === target.id),
    recordType: "task_search",
    searchBy: "id",
    taskId: target.id,
    taskAlias: target.name,
    searchedValue: target.id,
    requestUrl: result.requestUrl,
    rowCount: rows.length,
    matchedTaskIds: rows.map(item => item.id),
  };
}

async function verifyTaskSearchByAlias(page, config, target) {
  const result = await searchTaskList(page, config, page => fillInputByPlaceholder(page, "任务别名", target.name));
  const rows = result.rows.map(rowToTask);
  return {
    ok: rows.length > 0 && rows.every(item => item.alias.includes(target.name)) && rows.some(item => item.id === target.id),
    recordType: "task_search",
    searchBy: "alias",
    taskId: target.id,
    taskAlias: target.name,
    searchedValue: target.name,
    requestUrl: result.requestUrl,
    rowCount: rows.length,
    matchedTaskIds: rows.map(item => item.id),
  };
}

async function verifyTaskSearchByTag(page, config, target) {
  const result = await searchTaskList(page, config, page => fillInputByPlaceholder(page, "任务标签", target.tag));
  const rows = result.rows.map(rowToTask);
  return {
    ok: rows.length > 0 && rows.every(item => item.tag.includes(target.tag)) && rows.some(item => item.id === target.id),
    recordType: "task_search",
    searchBy: "tag",
    taskId: target.id,
    taskAlias: target.name,
    searchedValue: target.tag,
    requestUrl: result.requestUrl,
    rowCount: rows.length,
    matchedTaskIds: rows.map(item => item.id),
  };
}

async function verifyTaskSearchByRemark(page, config, target) {
  const result = await searchTaskList(page, config, page => fillInputByPlaceholder(page, "备注", target.remark));
  const rows = result.rows.map(rowToTask);
  return {
    ok: rows.length > 0 && rows.every(item => item.remark.includes(target.remark)) && rows.some(item => item.id === target.id),
    recordType: "task_search",
    searchBy: "remark",
    taskId: target.id,
    taskAlias: target.name,
    searchedValue: target.remark,
    requestUrl: result.requestUrl,
    rowCount: rows.length,
    matchedTaskIds: rows.map(item => item.id),
  };
}

async function verifyTaskSearchByStartTime(page, config, target) {
  const date = extractDate(target.updatedAt);
  const result = await searchTaskList(page, config, page => setTaskSearchDate(page, "start", date));
  const rows = result.rows.map(rowToTask);
  return {
    ok: rows.length > 0 && result.requestUrl.includes(`beginTime=${date}`),
    recordType: "task_search",
    searchBy: "start_time",
    taskId: target.id,
    taskAlias: target.name,
    searchedValue: date,
    requestUrl: result.requestUrl,
    rowCount: rows.length,
    matchedTaskIds: rows.map(item => item.id),
  };
}

async function verifyTaskSearchByEndTime(page, config, target) {
  const date = extractDate(target.updatedAt);
  const result = await searchTaskList(page, config, page => setTaskSearchDate(page, "end", date));
  const rows = result.rows.map(rowToTask);
  return {
    ok: rows.length > 0 && result.requestUrl.includes(`endTime=${date}`),
    recordType: "task_search",
    searchBy: "end_time",
    taskId: target.id,
    taskAlias: target.name,
    searchedValue: date,
    requestUrl: result.requestUrl,
    rowCount: rows.length,
    matchedTaskIds: rows.map(item => item.id),
  };
}

async function searchTaskList(page, config, fillFilters) {
  await openTaskList(page, config);
  await fillFilters(page);
  const listResponse = waitTaskList(page).catch(() => null);
  await clickButton(page, "搜索");
  const response = await listResponse;
  await sleep(1000);
  return {
    rows: await tableRows(page),
    requestUrl: response?.url?.() || "",
  };
}

async function openTaskList(page, config) {
  await page.goto(`${config.baseUrl}/activity/task`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await sleep(1200);
}

async function waitTaskList(page) {
  return page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/task/list")
    && response.request().method() === "GET"
  ), { timeout: 12000 });
}

async function setTaskSearchDate(page, mode, value) {
  const bound = await page.evaluate(({ mode, value }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const placeholder = mode === "start" ? "开始时间" : "结束时间";
    const input = [...document.querySelectorAll("input")]
      .filter(visible)
      .find(element => (element.getAttribute("placeholder") || "").includes(placeholder));
    if (!input) return false;
    const editor = input.closest(".el-date-editor");
    const vm = editor?.__vue__;
    if (vm?.emitInput) {
      vm.emitInput(value);
      vm.emitChange(value);
      vm.$emit("input", value);
      vm.$emit("change", value);
      vm.userInput = null;
      return true;
    }
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, { mode, value });
  if (!bound) throw new Error(`Task search date input not found: ${mode}`);
  await sleep(300);
}

function extractDate(value) {
  return String(value || "").slice(0, 10);
}

function normalizeTaskRow(row) {
  const cells = Array.isArray(row) ? row : [];
  return cells[0] === "" ? cells.slice(1) : cells;
}

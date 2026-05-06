import { sleep } from "../../lib/browser.mjs";
import { guidePayload } from "./guide-template-plan.mjs";
import fs from "node:fs";

export async function createGuideTemplates(page, config, plan) {
  const auth = await openGuidePageAndCaptureAuth(page, config);
  const created = [];
  for (const record of plan) created.push(await createOneGuideTemplate(page, auth, record));
  return created;
}

export async function createGuideTemplatesWithUi(page, config, plan) {
  const created = [];
  for (const record of plan) created.push(await createOneGuideTemplateWithUi(page, config, record));
  return created;
}

export async function openGuidePageAndCaptureAuth(page, config) {
  let authHeader = "";
  page.on("request", request => {
    if (request.url().includes("/prod-api/activity/guideTemplate/list")) {
      authHeader = request.headers().authorization || authHeader;
    }
  });
  await page.goto(`${config.baseUrl}/activity/guide`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.locator('button:has-text("新增")').first().waitFor({ state: "visible", timeout: 15000 });
  await sleep(500);
  if (!authHeader) throw new Error("Guide template list request did not expose an Authorization header");
  return authHeader;
}

async function createOneGuideTemplateWithUi(page, config, record) {
  const authHeader = await openGuidePageAndCaptureAuth(page, config);
  const uploadEvidence = [];
  const staticImagePath = config.imagePath;
  const gifPath = ensureDefaultGif();
  page.on("response", async response => {
    if (!response.url().includes("/prod-api/common/upload")) return;
    let body = null;
    try { body = await response.json(); } catch {}
    uploadEvidence.push({ status: response.status(), code: body?.code, msg: body?.msg });
  });

  await page.locator('button:has-text("新增")').first().click();
  const dialog = page.locator(".el-dialog:visible").last();
  await dialog.waitFor({ timeout: 12000 });
  await dialog.locator(".el-form-item", { hasText: "模版名称" }).first().locator("input").fill(record.name);
  await selectDialogOption(page, "活动类型", record.typeLabel);
  await selectDialogOption(page, "引导弹窗显示频率", record.frequencyLabel);

  for (let i = 1; i < record.steps; i += 1) {
    await dialog.locator('button:has-text("新增步骤")').click();
    await page.locator(".el-dialog:visible .card-group").nth(i).waitFor({ timeout: 8000 });
  }

  for (let i = 0; i < record.steps; i += 1) {
    const stepNo = i + 1;
    await fillStepField(page, i, "活动简介标题", `UI Step ${stepNo} title`);
    await fillStepField(page, i, "H5活动简介内容", `UI Step ${stepNo} content`);
    await uploadStepFile(page, i, "H5配图（静图）", staticImagePath);
    await uploadStepFile(page, i, "H5配图（动图）", gifPath);
    await uploadStepFile(page, i, "Web配图（静图）", staticImagePath);
    await uploadStepFile(page, i, "Web配图（动图）", gifPath);
    await fillStepField(page, i, "按钮文案", `Button ${stepNo}`);
  }

  const postPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/guideTemplate") && response.request().method() === "POST"
  ), { timeout: 20000 }).catch(() => null);
  await dialog.locator('button:has-text("确认")').last().scrollIntoViewIfNeeded();
  await dialog.locator('button:has-text("确认")').last().click();
  const response = await postPromise;
  await sleep(1500);
  let body = null;
  try { body = await response?.json(); } catch {}
  const verification = body?.code === 200 ? await searchGuideTemplate(page, authHeader, record.name) : null;
  const ok = body?.code === 200 && verification?.total >= 1;
  return {
    ...record,
    ok,
    writePath: "visible_ui_clicks",
    result: { httpStatus: response?.status(), code: body?.code, msg: body?.msg },
    verification,
    uploadCount: uploadEvidence.length,
    uploadFailures: uploadEvidence.filter(item => item.status >= 400 || (item.code && item.code !== 200)),
  };
}

async function createOneGuideTemplate(page, authHeader, record) {
  const result = await page.evaluate(async ({ payload, authHeader }) => {
    const response = await fetch("/prod-api/activity/guideTemplate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    let body = {};
    try { body = await response.json(); } catch {}
    return { httpStatus: response.status, code: body.code, msg: body.msg };
  }, { payload: guidePayload(record), authHeader });

  const verification = result.code === 200
    ? await searchGuideTemplate(page, authHeader, record.name)
    : null;
  const ok = result.code === 200 && verification?.total >= 1;
  return { ...record, ok, writePath: "invisible_api_write", result, verification };
}

export async function searchGuideTemplate(page, authHeader, name) {
  return page.evaluate(async ({ authHeader, name }) => {
    const url = `/prod-api/activity/guideTemplate/list?pageNum=1&pageSize=10&templateName=${encodeURIComponent(name)}`;
    const response = await fetch(url, { headers: { Authorization: authHeader }, credentials: "include" });
    const body = await response.json();
    return {
      httpStatus: response.status,
      code: body.code,
      msg: body.msg,
      total: body.total,
      rows: (body.rows || []).map(row => ({
        id: row.id,
        templateName: row.templateName,
        activityType: row.activityType,
        displayFrequency: row.displayFrequency,
        operator: row.operator,
        hasStep2: Boolean(row.step2I18nConfig),
      })),
    };
  }, { authHeader, name });
}

async function selectDialogOption(page, label, option) {
  const dialog = page.locator(".el-dialog:visible").last();
  const item = dialog.locator(".el-form-item", { hasText: label }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator(".el-select").click({ force: true });
  await sleep(400);
  await page.locator(".el-select-dropdown:visible .el-select-dropdown__item", { hasText: option }).last().click();
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);
}

async function fillStepField(page, stepIndex, label, value) {
  const item = stepFormItem(page, stepIndex, label);
  await item.scrollIntoViewIfNeeded();
  await item.locator('input[placeholder="英语"], textarea[placeholder="英语"]').first().fill(value);
  await sleep(100);
}

async function uploadStepFile(page, stepIndex, label, filePath) {
  const item = stepFormItem(page, stepIndex, label);
  await item.scrollIntoViewIfNeeded();
  const uploadPromise = page.waitForResponse(response => response.url().includes("/prod-api/common/upload"), { timeout: 20000 }).catch(() => null);
  await item.locator('input[type="file"]').first().setInputFiles(filePath);
  const response = await uploadPromise;
  await sleep(800);
  if (!response) throw new Error(`Upload response not observed for step ${stepIndex + 1} ${label}`);
}

function stepFormItem(page, stepIndex, label) {
  return page
    .locator(".el-dialog:visible .card-group")
    .nth(stepIndex)
    .locator(".el-form-item", { hasText: label })
    .first();
}

function ensureDefaultGif() {
  const gifPath = "/tmp/weex-guide-default.gif";
  if (!fs.existsSync(gifPath)) {
    fs.writeFileSync(gifPath, Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"));
  }
  return gifPath;
}

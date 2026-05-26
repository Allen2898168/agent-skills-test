#!/usr/bin/env node
import fs from "node:fs";
import { ensureAdminSession, ensureAdminSessionForCurrentPage, loginToPrizePage } from "./lib/browser.mjs";
import { timestamp } from "./lib/cli.mjs";
import {
  isLotteryDraftCreateSuccessful,
  shouldSearchLotteryListAfterSubmit,
} from "./lib/lottery-draft-verification.mjs";
import { adminConfig, assertAdminConfig, loadLocalEnv, loadPlaywright, pathsFrom } from "./lib/runtime.mjs";
import {
  buildMidsceneReportName,
  createMidsceneRecorder,
} from "./lib/midscene.mjs";
import {
  buildShortLotteryAlias,
  createStrictLotteryVisibleAttemptActions,
  expandToEight,
  parseList,
} from "./lib/strict-lottery-visible-attempt-actions.mjs";

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
const configuredActivityStartTime = process.env.LOTTERY_START || "";
const configuredActivityEndTime = process.env.LOTTERY_END || "";
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
const enablePreApply = process.env.LOTTERY_PREAPPLY === "1";
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

const browser = config.useExistingChrome
  ? await chromium.connectOverCDP(config.chromeCdpUrl)
  : await chromium.launch({
      headless: headlessMode,
      executablePath: config.chromePath,
      slowMo: 120,
      args: ["--window-size=1440,1000"],
    });
const context = config.useExistingChrome
  ? (browser.contexts()[0] || await browser.newContext({ viewport: { width: 1440, height: 1000 } }))
  : browser;
const existingPage = config.useExistingChrome
  ? context.pages().find(item => /\/activities\/lottery(\/add)?/.test(item.url()))
  : null;
const page = existingPage || await context.newPage({ viewport: { width: 1440, height: 1000 } });
const midscene = await createMidsceneRecorder(page, {
  reportName: buildMidsceneReportName(["strict-lottery-visible-attempt", alias]),
  groupName: "WEEX Lottery Admin Regression",
  groupDescription: "严格UI新建转盘抽奖活动",
});
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

function formatUtc8DateTime(date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = type => parts.find(item => item.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function resolveActivityWindow() {
  if (configuredActivityStartTime || configuredActivityEndTime) {
    return {
      start: configuredActivityStartTime || "2026-06-10 00:00:00",
      end: configuredActivityEndTime || "2026-06-30 23:59:59",
    };
  }
  const now = new Date();
  const start = new Date(now.getTime() + 4 * 60 * 1000);
  const end = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return {
    start: formatUtc8DateTime(start),
    end: formatUtc8DateTime(end),
  };
}

const actions = createStrictLotteryVisibleAttemptActions({
  page,
  config,
  wait,
  options: {
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
  },
});

const {
  clickRadio,
  clickButton,
  ensurePreApplySupport,
  formItem,
  fillControl,
  fillLabel,
  fillDateLabel,
  fillDateLabelWithinOffsetRange,
  fillRich,
  selectLabel,
  readApplyConfigId,
  selectRegistrationTemplate,
  fetchActivityConfigDetail,
  uploadLabel,
  fillPrizeRows,
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
} = actions;

try {
  console.log(JSON.stringify({ step: "start", title, alias, configuredActivityStartTime, configuredActivityEndTime, lotteryStyle }));
  await openLotteryViaMenu();
  await midscene.record("打开活动列表", `${title}\n${alias}`).catch(() => {});
  await clickButton("新增");
  await page.waitForURL(/\/activities\/lottery\/add/, { timeout: 15000 });
  await wait(3000);
  if (await ensureAdminSessionForCurrentPage(page, config, "/activities/lottery/add")) {
    await page.waitForURL(/\/activities\/lottery\/add/, { timeout: 15000 }).catch(() => {});
    await wait(2500);
  }

  console.log(JSON.stringify({ step: "basic" }));
  await clickRadio("配置类型", "正式活动");
  console.log(JSON.stringify({ step: "basic_config_type_done" }));
  await fillLabel("负责人", ownerLabel);
  console.log(JSON.stringify({ step: "basic_owner_done" }));
  await selectLabel("类别配置", "通用");
  console.log(JSON.stringify({ step: "basic_category_done" }));
  await selectLabel("流程引导配置", guideTemplateLabel || null, 0, 0);
  console.log(JSON.stringify({ step: "basic_guide_done" }));
  await clickRadio("是否为平台活动", platformActivity);
  console.log(JSON.stringify({ step: "basic_platform_done" }));
  await fillLabel("活动标题", title, 0);
  console.log(JSON.stringify({ step: "basic_title_done" }));
  await fillLabel("活动副标题", subTitle, 0);
  console.log(JSON.stringify({ step: "basic_subtitle_done" }));
  await selectRegistrationTemplate(registrationTemplateLabel);
  console.log(JSON.stringify({ step: "basic_registration_template_done" }));
  for (const label of ["WEB头图上传", "H5头图上传", "web分享图上传", "H5分享图片上传", "社媒活动预览图上传"]) await uploadLabel(label, 0);
  console.log(JSON.stringify({ step: "basic_uploads_done" }));
  await fillLabel("分享活动文案", shareCopy, 0);
  console.log(JSON.stringify({ step: "basic_share_copy_done" }));
  await fillLabel("代理分享文案", agentShareCopy, 0);
  console.log(JSON.stringify({ step: "basic_agent_share_copy_done" }));
  await fillRich("活动规则", activityRules, 0);
  console.log(JSON.stringify({ step: "basic_rules_done" }));
  await fillLabel("活动别名配置", alias);
  console.log(JSON.stringify({ step: "basic_alias_done" }));
  if (enablePreApply) {
    await ensurePreApplySupport();
    await selectLabel("预报名模版", null, 0, 0);
    await fillLabel("预报名开始时间", preApplyStartTime);
    await fillLabel("预报名结束时间", preApplyEndTime);
  } else {
    await clickRadio("是否支持预报名", "不支持");
  }
  console.log(JSON.stringify({ step: "basic_preapply_done", enabled: enablePreApply }));
  await clickRadio("是否显示活动日历入口", "是");
  console.log(JSON.stringify({ step: "basic_calendar_entry_done" }));
  await selectLabel("抽奖样式", lotteryStyle).catch(() => {});
  console.log(JSON.stringify({ step: "basic_style_done" }));
  if (!(await readApplyConfigId())) await selectRegistrationTemplate(registrationTemplateLabel);
  console.log(JSON.stringify({ step: "basic_apply_config_verified" }));

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

  console.log(JSON.stringify({ step: "activity_time" }));
  const activityWindow = resolveActivityWindow();
  if (configuredActivityStartTime) {
    await fillDateLabel("活动开始时间", activityWindow.start);
  } else {
    await fillDateLabelWithinOffsetRange("活动开始时间", { minOffsetMinutes: 3, maxOffsetMinutes: 5 });
  }
  await fillDateLabel("活动结束时间", activityWindow.end);

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
    const baseFormSnapshot = refs.baseForm?.form || {};
    result.baseFormModel = {
      configType: baseFormSnapshot.configType ?? null,
      activityOwner: baseFormSnapshot.activityOwner ?? null,
      channelCategory: baseFormSnapshot.channelCategory ?? null,
      applyConfigId: refs.baseForm?.form?.applyConfigId ?? null,
      guideTemplateId: refs.baseForm?.form?.guideTemplateId ?? null,
      title: baseFormSnapshot.title ?? null,
      subTitle: baseFormSnapshot.subTitle ?? null,
      startTime: baseFormSnapshot.startTime ?? null,
      endTime: baseFormSnapshot.endTime ?? null,
      applicationMode: baseFormSnapshot.applicationMode ?? null,
      showActivityCalendar: baseFormSnapshot.showActivityCalendar ?? null,
      shareContent: baseFormSnapshot.shareContent ?? null,
      agentShareContent: baseFormSnapshot.agentShareContent ?? null,
      introLength: String(baseFormSnapshot.intro || "").length,
      webBannerUrl: baseFormSnapshot.webBannerUrl ?? null,
      appBannerUrl: baseFormSnapshot.appBannerUrl ?? null,
      webShareUrl: baseFormSnapshot.webShareUrl ?? null,
      appShareUrl: baseFormSnapshot.appShareUrl ?? null,
      ogImageUrl: baseFormSnapshot.ogImageUrl ?? null,
      showUrl: refs.baseForm?.form?.showUrl ?? null,
      registrationInputValue: [...document.querySelectorAll(".el-form-item")]
        .find(item => item.querySelector(".el-form-item__label")?.innerText?.trim().includes("用户报名模版"))
        ?.querySelector(".el-select input")?.value || "",
      visibleFieldValues: [...document.querySelectorAll(".el-form-item")]
        .map(item => ({
          label: item.querySelector(".el-form-item__label")?.innerText?.trim() || "",
          inputValue: item.querySelector("input:not([type=radio]):not([type=checkbox]), textarea")?.value || "",
          selectValue: item.querySelector(".el-select input")?.value || "",
          radioValue: [...item.querySelectorAll(".el-radio.is-checked")].map(radio => radio.innerText.trim()).filter(Boolean)[0] || "",
          error: item.querySelector(".el-form-item__error")?.innerText?.trim() || "",
        }))
        .filter(entry => entry.label)
        .slice(0, 40),
    };
    return result;
  }).catch(error => ({ error: error.message }));
  const createPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/config") && response.request().method() === "POST"
  ), { timeout: 25000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight));
  await wait(700);
  const submitButtons = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    return [...document.querySelectorAll("button")]
      .filter(button => visible(button) && button.innerText.trim() === "新增")
      .map(button => {
        const rect = button.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          text: button.innerText.trim(),
        };
      })
      .sort((a, b) => b.bottom - a.bottom);
  });
  const submitBox = submitButtons[0] || null;
  if (!submitBox) throw new Error("submit button not found");
  const submitClickResult = await page.evaluate(() => {
    const visible = element => !!element && element.getClientRects().length
      && getComputedStyle(element).display !== "none"
      && getComputedStyle(element).visibility !== "hidden";
    const buttons = [...document.querySelectorAll("button")]
      .filter(button => visible(button) && button.innerText.trim() === "新增")
      .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    const button = buttons[0];
    if (!button) return { ok: false };
    button.scrollIntoView({ block: "center", inline: "nearest" });
    button.click();
    return { ok: true, text: button.innerText.trim() };
  }).catch(error => ({ ok: false, error: error.message }));
  await wait(800);
  if (!submitClickResult?.ok) {
    await page.mouse.click(submitBox.x, submitBox.y);
  }
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
  await midscene.record("创建结果", JSON.stringify({
    ok,
    title,
    alias,
    createCode: createBody?.code || null,
    verifyTotal: verify?.total || 0,
  }, null, 2)).catch(() => {});
  const midsceneReportPath = await midscene.finalize();
  console.log(JSON.stringify({
    ok,
    title,
    alias,
    lotteryStyle,
    activityTime: {
      start: activityWindow.start,
      end: activityWindow.end,
    },
    finalUrl: page.url(),
    createStatus: createResponse?.status?.(),
    createBody,
    errors,
    preSubmitDiagnostics,
    submitButtons,
    submitClickResult,
    verifyTotal: verify?.total,
    verifyFirst: verifyDetail?.data || verifyListItem,
    verifyListFirst: verifyListItem,
    skippedUiSearchAfterSubmit: !shouldSearchList,
    midsceneReportPath,
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
  await midscene.record("创建失败", error.message).catch(() => {});
  const midsceneReportPath = await midscene.finalize();
  console.error(JSON.stringify({ ok: false, error: error.message, url: page.url(), title, alias, midsceneReportPath, errors, uploads: evidence.uploads, activityResponses: evidence.activityResponses }, null, 2));
  if (keepOpenOnError && !headlessMode) {
    console.error(JSON.stringify({ debug: true, message: "browser kept open on error for manual inspection", url: page.url(), alias }, null, 2));
    await wait(30 * 60 * 1000).catch(() => {});
  } else {
    await wait(5000).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  if (!(keepOpenOnError && process.exitCode && !headlessMode)) {
    if (!config.useExistingChrome) {
      await browser.close().catch(() => {});
    }
  }
}

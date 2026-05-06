import { sleep } from "../../lib/browser.mjs";
import {
  clearCheckedByLabel,
  clickButton,
  clickChoiceByLabel,
  fillInputByPlaceholder,
  fillLabel,
  selectOptionByLabel,
  selectFirstByLabel,
  setSwitchByLabel,
  tableRows,
  visibleFormErrors,
} from "../../lib/element-ui.mjs";
import { setDateTimeRangeByLabel } from "../../lib/element-ui-datetime.mjs";

export async function createRegisterTemplates(page, config, plan) {
  const created = [];
  for (const spec of plan) created.push(await createOneTemplate(page, config, spec));
  return created;
}

async function createOneTemplate(page, config, spec) {
  await openRegisterPage(page, config);
  await clickButton(page, "新增");
  await page.locator(".el-dialog:visible").last().waitFor({ timeout: 12000 });
  await sleep(500);
  await fillLabel(page, "用户管理模板名称", spec.name);
  await clickChoiceByLabel(page, "平台用户参与范围", spec.platformScope, "radio");
  await configurePlatformScope(page, spec);
  await clearCheckedByLabel(page, "限制用户参与范围");
  await clickChoiceByLabel(page, "限制用户参与范围", spec.restrictScope, "checkbox");
  await configureRestrictScope(page, spec);
  if (spec.registerTimeRange) {
    await setSwitchByLabel(page, "可参与注册时间范围", true, true);
    spec.branchDefaults.registerTimeRange = {
      ...spec.registerTimeRange,
      binding: await setDateTimeRangeByLabel(page, "可参与注册时间范围", spec.registerTimeRange.start, spec.registerTimeRange.end),
    };
  }
  await clearCheckedByLabel(page, "限制用户权限");
  for (const permission of spec.permissions || []) {
    await clickChoiceByLabel(page, "限制用户权限", permission, "checkbox");
  }
  await clearCheckedByLabel(page, "用户报名方式");
  await clickChoiceByLabel(page, "用户报名方式", spec.signupModeLabel, "checkbox");
  if (spec.minTeam) await fillLabel(page, "最小团队人数", spec.minTeam);
  if (spec.peopleLimit) await fillLabel(page, "报名人数限制", spec.peopleLimit);

  const postPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/apply") && response.request().method() === "POST"
  ), { timeout: 15000 }).catch(() => null);
  await clickButton(page, "确认", ".el-dialog");
  const response = await postPromise;
  await sleep(1000);
  const errors = await visibleFormErrors(page);
  if (!response) throw new Error(`Create register template did not send POST: ${spec.name}; errors=${JSON.stringify(errors)}`);
  let body = null;
  try { body = await response.json(); } catch {}
  if (response.status() >= 400 || (body?.code && body.code !== 200)) {
    throw new Error(`Create register template failed: ${spec.name}; HTTP ${response.status()}; body=${JSON.stringify(body)}; errors=${JSON.stringify(errors)}`);
  }
  await page.locator(".el-dialog:visible").last().waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  const verification = await searchRegisterTemplate(page, config, spec.name);
  if (!verification.found) throw new Error(`Register template created but search did not find row: ${spec.name}`);
  return {
    name: spec.name,
    signupMode: spec.signupModeLabel,
    platformScope: spec.platformScope,
    restrictScope: spec.restrictScope,
    branchDefaults: spec.branchDefaults || {},
    registerTimeRange: spec.registerTimeRange,
    permissions: spec.permissions,
    minTeam: spec.minTeam,
    status: response.status(),
    responseCode: body?.code,
    responseMsg: body?.msg,
    row: verification.row,
  };
}

async function openRegisterPage(page, config) {
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.locator('button:has-text("新增")').first().waitFor({ state: "visible", timeout: 15000 });
}

async function searchRegisterTemplate(page, config, name) {
  await page.goto(`${config.baseUrl}/activity/register`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const listPromise = page.waitForResponse(response => (
    response.url().includes("/prod-api/activity/apply/list") && response.request().method() === "GET"
  ), { timeout: 12000 }).catch(() => null);
  await fillInputByPlaceholder(page, "用户管理模板名称", name);
  await clickButton(page, "搜索");
  await listPromise;
  await sleep(800);
  const row = (await tableRows(page)).find(cells => cells.some(cell => cell.includes(name)));
  return { found: Boolean(row), row };
}

async function configurePlatformScope(page, spec) {
  spec.branchDefaults = spec.branchDefaults || {};
  if (spec.platformScope === "指定渠道码或邀请码") {
    const partnerGroup = await selectFirstByLabel(page, "合伙人分组", false, true);
    if (partnerGroup) spec.branchDefaults.partnerGroup = partnerGroup;
    await fillLabel(page, "渠道码", spec.channelCode);
    await fillLabel(page, "邀请码", spec.inviteCode);
    spec.branchDefaults.channelCode = spec.channelCode;
    spec.branchDefaults.inviteCode = spec.inviteCode;
    return;
  }
  if (spec.platformScope === "非活跃用户") {
    spec.branchDefaults.inactiveRange = await selectFirstByLabel(page, "非活跃用户范围", true, true);
    spec.branchDefaults.userRegion = await selectFirstByLabel(page, "用户区域", true, true);
    return;
  }
  if (spec.platformScope === "混合条件") {
    const partnerGroup = await selectFirstByLabel(page, "条件-1：合伙人分组", true, true);
    if (partnerGroup) spec.branchDefaults.partnerGroup = partnerGroup;
    await fillLabel(page, "用户UID", spec.uid);
    spec.branchDefaults.uid = spec.uid;
    spec.branchDefaults.conditionRelation = await selectOptionByLabel(page, "条件关系", "且", true, true);
    spec.branchDefaults.country = await selectFirstByLabel(page, "条件-2", true, true);
    return;
  }
  if (spec.platformScope !== "指定参赛代理或用户") return;
  spec.branchDefaults.uid = spec.uid;
  const partnerGroup = await selectFirstByLabel(page, "合伙人分组", false, true);
  if (partnerGroup) spec.branchDefaults.partnerGroup = partnerGroup;
  await fillLabel(page, "指定代理", spec.uid);
  if (spec.agentRoleDetail === "all") {
    const enabled = await setSwitchByLabel(page, "代理角色细分", true, false);
    if (enabled) {
      const selected = [];
      for (const role of ["总代理", "代理", "直客"]) {
        if (await clickChoiceByLabel(page, "代理角色细分", role, "checkbox", false)) selected.push(role);
      }
      spec.branchDefaults.agentRoles = selected;
    }
  }
  await fillLabel(page, "指定用户UID", spec.uid);
}

async function configureRestrictScope(page, spec) {
  spec.branchDefaults = spec.branchDefaults || {};
  if (spec.restrictScope === "代理及其直客") {
    await fillLabel(page, "代理及其直客", spec.uid);
    spec.branchDefaults.restrictUid = spec.uid;
  } else if (spec.restrictScope === "代理+下级代理+所有直客") {
    await fillLabel(page, "代理+下级代理+直客", spec.uid);
    spec.branchDefaults.restrictUid = spec.uid;
  } else if (spec.restrictScope === "KYC") {
    spec.branchDefaults.kycRegion = await selectFirstByLabel(page, "kyc限制区域", true, true);
  } else if (spec.restrictScope === "VIP等级") {
    spec.branchDefaults.vipLevel = await selectFirstByLabel(page, "VIP等级", true, true);
    await clickChoiceByLabel(page, "VIP白名单限制", spec.vipWhitelistMode, "radio");
    spec.branchDefaults.vipWhitelistMode = spec.vipWhitelistMode;
  } else if (spec.restrictScope === "风控标签") {
    spec.branchDefaults.riskTag = await selectFirstByLabel(page, "风控标签", true, true);
  } else if (spec.restrictScope === "合约账户余额") {
    await fillLabel(page, "合约账户余额", spec.contractBalance);
    spec.branchDefaults.contractBalance = spec.contractBalance;
  }
}

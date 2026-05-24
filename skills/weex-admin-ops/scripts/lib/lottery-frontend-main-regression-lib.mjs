export function resolvePhaseCommands(phase, args, createdActivity) {
  return phase.commands.map(command => {
    const next = command.flatMap(token => {
      if (token === "<created-alias>" && createdActivity.activityAlias) return [createdActivity.activityAlias];
      if (token === "<created-id>" && createdActivity.activityId) return [createdActivity.activityId];
      return [token];
    });
    if (args.visible) next.push("--visible");
    return next;
  });
}

export function buildFrontendRegressionCaseResults(plan, phaseResults) {
  const executed = new Map((phaseResults || []).map(item => [item.phaseId, item]));
  return (plan.phases || []).flatMap(phase => {
    const phaseResult = executed.get(phase.phaseId);
    if (!phaseResult) {
      return (phase.caseEntries || []).map(item => ({
        caseId: item.caseId,
        caseName: item.caseName || "",
        module: item.module || "",
        priority: item.priority || "",
        phaseId: phase.phaseId,
        status: "SKIPPED",
        evidence: null,
        errorMessage: "",
      }));
    }
    return (phaseResult.cases || []).map(item => evaluateFrontendCase(item, phaseResult));
  });
}

export function evaluateFrontendCase(caseEntry, phaseResult) {
  if (!phaseResult) return buildCaseResult(caseEntry, "", "SKIPPED");
  const payload = phaseResult.payload || {};
  const page = payload.page || {};
  const signup = payload.signup || {};
  const draw = payload.draw || {};
  const rewardRecord = payload.rewardRecord || {};
  const mqRecharge = payload.mqRecharge || {};

  switch (caseEntry.caseId) {
    case "FE-01":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && !page.loginFormVisible);
    case "FE-07":
      return buildMatchedResult(caseEntry, phaseResult, page.myPrizeVisible || (rewardRecord.opened && rewardRecord.dialogVisible));
    case "FE-17":
      return buildMatchedResult(caseEntry, phaseResult, !page.loginFormVisible && !page.guestVisible && hasActionableMainButton(page));
    case "FE-19":
      return buildMatchedResult(caseEntry, phaseResult, page.activityTitleVisible && page.countdownVisible && page.countdownTicking && !page.pageErrorVisible);
    case "FE-21":
      return buildMatchedResult(caseEntry, phaseResult, Number(page.drawCount ?? mqRecharge.countBefore ?? 0) === 0);
    case "FE-22":
      return buildMatchedResult(caseEntry, phaseResult, Number(mqRecharge.countAfter ?? draw.countBefore ?? 0) >= 1);
    case "FE-24":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.buttonVisibleBefore) || Number(draw.countBefore ?? mqRecharge.countAfter ?? 0) >= 1);
    case "FE-26":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.requestSent) && Boolean(draw.duplicateClickBlocked) && Number(draw.requestCountDelta ?? 0) <= 1);
    case "FE-28":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.duplicateClickBlocked) && Number(draw.requestCountDelta ?? 0) <= 1);
    case "FE-32":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.apiSuccess));
    case "FE-33":
      return buildMatchedResult(caseEntry, phaseResult, draw.popupVisible);
    case "FE-34":
    case "FE-35":
      return buildMatchedResult(caseEntry, phaseResult, Number(draw.countBefore) - Number(draw.countAfter) === 1);
    case "FE-36":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.opened && rewardRecord.dialogVisible && rewardRecord.hasRewardRow);
    case "FE-37":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.opened && rewardRecord.dialogVisible && rewardRecord.hasReadableRewardValue);
    case "FE-48":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.opened && rewardRecord.dialogVisible);
    case "FE-49":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.dialogVisible);
    case "FE-50":
      return buildMatchedResult(caseEntry, phaseResult, hasHeaders(rewardRecord.fieldHeaders, ["活动名称", "奖励金额", "获奖时间", "备注"]));
    case "FE-79":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && page.urlMatchesAlias);
    case "FE-81":
      if (isAlreadySignedUpState(page, signup) && signup.initialState !== "立即报名") {
        return buildCaseResult(caseEntry, phaseResult.phaseId, "SKIPPED", phaseResult.payload);
      }
      return buildMatchedResult(caseEntry, phaseResult, signup.initialState === "立即报名");
    case "FE-82":
      if (isAlreadySignedUpState(page, signup) && signup.initialState !== "立即报名") return buildCaseResult(caseEntry, phaseResult.phaseId, "SKIPPED", phaseResult.payload);
      return buildMatchedResult(caseEntry, phaseResult, signup.done && signup.finalState === "抽奖");
    case "FE-83":
      return buildMatchedResult(caseEntry, phaseResult, signup.reopenedState === "抽奖" || isAlreadySignedUpState(page, signup));
    case "FE-84":
      if (!mqRecharge.sent) return buildCaseResult(caseEntry, phaseResult.phaseId, "SKIPPED", phaseResult.payload);
      return buildMatchedResult(caseEntry, phaseResult, mqRecharge.ok && Number(mqRecharge.countAfter ?? 0) > Number(mqRecharge.countBefore ?? -1));
    default:
      return buildCaseResult(caseEntry, phaseResult.phaseId, phaseResult.ok ? "PASS" : "FAIL", payload);
  }
}

function hasHeaders(headers, expected) {
  const available = new Set((headers || []).map(item => String(item).trim()));
  return expected.every(item => available.has(item));
}

function hasActionableMainButton(page) {
  return [
    page.mainButtonState,
    page.drawButtonVariant,
  ].some(item => ["立即报名", "抽奖", "抽奖×1", "抽奖×5"].includes(String(item || "").trim()));
}

function isAlreadySignedUpState(page, signup) {
  return Boolean(
    signup.done
    && [
      page.mainButtonState,
      page.drawButtonVariant,
      signup.finalState,
      signup.reopenedState,
    ].some(item => ["抽奖", "抽奖×1", "抽奖×5"].includes(String(item || "").trim()))
  );
}

function buildMatchedResult(caseEntry, phaseResult, passed) {
  return buildCaseResult(caseEntry, phaseResult.phaseId, passed ? "PASS" : "FAIL", phaseResult.payload);
}

function buildCaseResult(caseEntry, phaseId, status, payload = null) {
  return {
    caseId: caseEntry.caseId,
    caseName: caseEntry.caseName || "",
    module: caseEntry.module || "",
    priority: caseEntry.priority || "",
    phaseId,
    status,
    evidence: summarizeEvidence(payload),
    errorMessage: payload?.error || "",
  };
}

function summarizeEvidence(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    page: payload.page ? {
      activityAlias: payload.page.activityAlias || "",
      url: payload.page.url || "",
      mainButtonState: payload.page.mainButtonState || "",
      drawButtonVariant: payload.page.drawButtonVariant || "",
      loginFormVisible: Boolean(payload.page.loginFormVisible),
      myPrizeVisible: Boolean(payload.page.myPrizeVisible),
      guestVisible: Boolean(payload.page.guestVisible),
      activityTitle: payload.page.activityTitle || "",
      activityTitleVisible: Boolean(payload.page.activityTitleVisible),
      countdownText: payload.page.countdownText || "",
      countdownVisible: Boolean(payload.page.countdownVisible),
      countdownTicking: Boolean(payload.page.countdownTicking),
      pageErrorVisible: Boolean(payload.page.pageErrorVisible),
      buttons: payload.page.buttons || [],
    } : null,
    signup: payload.signup ? {
      initialState: payload.signup.initialState || "",
      finalState: payload.signup.finalState || "",
      reopenedState: payload.signup.reopenedState || "",
      done: Boolean(payload.signup.done),
    } : null,
    mqRecharge: payload.mqRecharge ? {
      uid: payload.mqRecharge.uid || "",
      amount: payload.mqRecharge.amount || "",
      ok: Boolean(payload.mqRecharge.ok),
      sent: Boolean(payload.mqRecharge.sent),
      countBefore: payload.mqRecharge.countBefore ?? null,
      countAfter: payload.mqRecharge.countAfter ?? null,
    } : null,
    draw: payload.draw ? {
      requestObserved: Boolean(payload.draw.requestObserved),
      requestSent: Boolean(payload.draw.requestSent),
      buttonVisibleBefore: Boolean(payload.draw.buttonVisibleBefore),
      buttonDisabledDuringDraw: Boolean(payload.draw.buttonDisabledDuringDraw),
      duplicateClickBlocked: Boolean(payload.draw.duplicateClickBlocked),
      requestCountDelta: payload.draw.requestCountDelta ?? null,
      apiSuccess: Boolean(payload.draw.apiSuccess),
      apiCode: payload.draw.apiCode || "",
      apiMessage: payload.draw.apiMessage || "",
      popupVisible: Boolean(payload.draw.popupVisible),
      countBefore: payload.draw.countBefore ?? null,
      countAfter: payload.draw.countAfter ?? null,
    } : null,
    rewardRecord: payload.rewardRecord ? {
      opened: Boolean(payload.rewardRecord.opened),
      dialogVisible: Boolean(payload.rewardRecord.dialogVisible),
      fieldHeaders: payload.rewardRecord.fieldHeaders || [],
      hasRewardRow: Boolean(payload.rewardRecord.hasRewardRow),
      hasReadableRewardValue: Boolean(payload.rewardRecord.hasReadableRewardValue),
      dataLineCount: payload.rewardRecord.dataLineCount ?? null,
    } : null,
  };
}

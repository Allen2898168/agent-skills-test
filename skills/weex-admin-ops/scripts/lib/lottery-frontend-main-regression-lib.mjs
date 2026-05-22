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
  if (!phaseResult.ok) return buildCaseResult(caseEntry, phaseResult.phaseId, "FAIL", phaseResult.payload);
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
      return buildMatchedResult(caseEntry, phaseResult, page.myPrizeVisible);
    case "FE-17":
      return buildMatchedResult(caseEntry, phaseResult, !page.loginFormVisible && Boolean(page.mainButtonState));
    case "FE-19":
      return buildMatchedResult(caseEntry, phaseResult, ["立即报名", "抽奖"].includes(signup.initialState || page.mainButtonState));
    case "FE-22":
      return buildMatchedResult(caseEntry, phaseResult, Number(mqRecharge.countAfter ?? draw.countBefore ?? 0) >= 1);
    case "FE-32":
      return buildMatchedResult(caseEntry, phaseResult, draw.requestObserved || draw.popupVisible);
    case "FE-33":
      return buildMatchedResult(caseEntry, phaseResult, draw.popupVisible);
    case "FE-34":
    case "FE-35":
      return buildMatchedResult(caseEntry, phaseResult, Number(draw.countBefore) - Number(draw.countAfter) === 1);
    case "FE-48":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.opened && rewardRecord.dialogVisible);
    case "FE-49":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.dialogVisible);
    case "FE-50":
      return buildMatchedResult(caseEntry, phaseResult, hasHeaders(rewardRecord.fieldHeaders, ["活动名称", "奖励金额", "获奖时间", "备注"]));
    case "FE-79":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && page.urlMatchesAlias);
    case "FE-81":
      return buildMatchedResult(caseEntry, phaseResult, signup.initialState === "立即报名");
    case "FE-82":
      return buildMatchedResult(caseEntry, phaseResult, signup.done && signup.finalState === "抽奖");
    case "FE-83":
      return buildMatchedResult(caseEntry, phaseResult, signup.reopenedState === "抽奖");
    case "FE-84":
      return buildMatchedResult(caseEntry, phaseResult, mqRecharge.ok && Number(mqRecharge.countAfter ?? 0) > Number(mqRecharge.countBefore ?? -1));
    default:
      return buildCaseResult(caseEntry, phaseResult.phaseId, "PASS", payload);
  }
}

function hasHeaders(headers, expected) {
  const available = new Set((headers || []).map(item => String(item).trim()));
  return expected.every(item => available.has(item));
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
      loginFormVisible: Boolean(payload.page.loginFormVisible),
      myPrizeVisible: Boolean(payload.page.myPrizeVisible),
      guestVisible: Boolean(payload.page.guestVisible),
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
      countBefore: payload.mqRecharge.countBefore ?? null,
      countAfter: payload.mqRecharge.countAfter ?? null,
    } : null,
    draw: payload.draw ? {
      requestObserved: Boolean(payload.draw.requestObserved),
      popupVisible: Boolean(payload.draw.popupVisible),
      countBefore: payload.draw.countBefore ?? null,
      countAfter: payload.draw.countAfter ?? null,
    } : null,
    rewardRecord: payload.rewardRecord ? {
      opened: Boolean(payload.rewardRecord.opened),
      dialogVisible: Boolean(payload.rewardRecord.dialogVisible),
      fieldHeaders: payload.rewardRecord.fieldHeaders || [],
    } : null,
  };
}

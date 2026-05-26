export function resolvePhaseCommands(phase, args, createdActivity) {
  return phase.commands.map(command => {
    const substituted = command.flatMap(token => {
      if (token === "<created-alias>" && createdActivity.activityAlias) return [createdActivity.activityAlias];
      if (token === "<created-id>" && createdActivity.activityId) return [createdActivity.activityId];
      if (token === "<admin-snapshot-path>" && createdActivity.adminSnapshotPath) return [createdActivity.adminSnapshotPath];
      if (token === "<prestart-alias>" && createdActivity.prestartActivityAlias) return [createdActivity.prestartActivityAlias];
      if (token === "<draw-payload-path>" && createdActivity.drawPayloadPath) return [createdActivity.drawPayloadPath];
      return [token];
    });
    const next = [];
    for (let index = 0; index < substituted.length; index += 1) {
      const token = substituted[index];
      if (token === "--draw-payload-path") {
        const value = substituted[index + 1];
        if (!value || value === "<draw-payload-path>") {
          index += 1;
          continue;
        }
      }
      next.push(token);
    }
    if (args.visible) next.push("--visible");
    return next;
  });
}

export function buildFrontendRegressionCaseResults(plan, phaseResults) {
  const executed = new Map((phaseResults || []).map(item => [item.phaseId, item]));
  return (plan.phases || []).flatMap(phase => {
    const phaseResult = executed.get(phase.phaseId);
    if (!phaseResult) {
      const unmetDependencies = (phase.dependsOn || []).filter(dependency => {
        const dependencyPhase = executed.get(dependency);
        return !dependencyPhase || !dependencyPhase.ok;
      });
      const reason = unmetDependencies.length
        ? `blocked by ${unmetDependencies.join(", ")}`
        : "phase not executed";
      return (phase.caseEntries || []).map(item => ({
        caseId: item.caseId,
        caseName: item.caseName || "",
        module: item.module || "",
        priority: item.priority || "",
        phaseId: phase.phaseId,
        status: "SKIPPED",
        evidence: null,
        errorMessage: reason,
      }));
    }
    return (phaseResult.cases || []).map(item => evaluateFrontendCase(item, phaseResult));
  });
}

export function evaluateFrontendCase(caseEntry, phaseResult) {
  if (!phaseResult) return buildCaseResult(caseEntry, "", "SKIPPED");
  const payload = phaseResult.payload || {};
  const page = payload.page || {};
  const consistency = payload.consistency || {};
  const linkage = payload.linkage || {};
  const linkageReadonly = payload.linkageReadonly || {};
  const signup = payload.signup || {};
  const draw = payload.draw || {};
  const rewardRecord = payload.rewardRecord || {};
  const mqRecharge = payload.mqRecharge || {};

  switch (caseEntry.caseId) {
    case "FE-16":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(page.opened && (page.guestVisible || page.loginFormVisible)));
    case "FE-01":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && !page.loginFormVisible);
    case "FE-02":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(page.mainVisualVisible));
    case "FE-03":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(consistency.titleMatched));
    case "FE-05":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(consistency.rulesMatched));
    case "FE-06":
      return buildMatchedResult(caseEntry, phaseResult, Boolean((page.prizeAreaVisible || Number(page.prizeCount ?? 0) > 0) && consistency.prizeCountMatched));
    case "FE-07":
      return buildMatchedResult(caseEntry, phaseResult, page.myPrizeVisible || (rewardRecord.opened && rewardRecord.dialogVisible));
    case "FE-08":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(consistency.basicModulesVisible) && !page.horizontalOverflow);
    case "FE-17":
      return buildMatchedResult(caseEntry, phaseResult, !page.loginFormVisible && !page.guestVisible && hasActionableMainButton(page));
    case "FE-19":
      return buildMatchedResult(caseEntry, phaseResult, page.activityTitleVisible && page.countdownVisible && page.countdownTicking && !page.pageErrorVisible);
    case "FE-18":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && page.mainButtonState === "即将开始" && page.countdownVisible && !page.pageErrorVisible);
    case "FE-21":
      return buildMatchedResult(caseEntry, phaseResult, Number(page.drawCount ?? mqRecharge.countBefore ?? 0) === 0);
    case "FE-22":
      return buildMatchedResult(caseEntry, phaseResult, Number(mqRecharge.countAfter ?? draw.countBefore ?? 0) >= 1);
    case "FE-24":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.buttonVisibleBefore) || Number(draw.countBefore ?? mqRecharge.countAfter ?? 0) >= 1);
    case "FE-26":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.requestSent) && Boolean(draw.duplicateClickBlocked) && Number(draw.requestCountDelta ?? 0) <= 1);
    case "FE-27":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(draw.apiSuccess) && Boolean(draw.buttonRestoredAfterDraw));
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
    case "FE-55":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.opened && rewardRecord.dialogVisible && Boolean(rewardRecord.closedOk));
    case "FE-56":
      return buildMatchedResult(caseEntry, phaseResult, rewardRecord.opened && rewardRecord.dialogVisible && Boolean(rewardRecord.prizeMatchesPopup));
    case "FE-73":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(linkage.titleUpdated) && Boolean(linkage.titleMatched));
    case "FE-75":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(linkageReadonly.languageSwitch?.switched));
    case "FE-76":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(linkageReadonly.faq?.found));
    case "FE-77":
      return buildMatchedResult(caseEntry, phaseResult, Boolean((page.prizeAreaVisible || Number(page.prizeCount ?? 0) > 0) && consistency.prizeCountMatched));
    case "FE-78":
      return buildMatchedResult(caseEntry, phaseResult, Boolean(linkageReadonly.calendarTab?.found));
    case "FE-79":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && page.urlMatchesAlias);
    case "FE-80":
      return buildMatchedResult(caseEntry, phaseResult, page.opened && page.mainButtonState === "即将开始" && !page.guestVisible && !page.loginFormVisible);
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
  const errorMessage = buildErrorMessage(status, payload);
  return {
    caseId: caseEntry.caseId,
    caseName: caseEntry.caseName || "",
    module: caseEntry.module || "",
    priority: caseEntry.priority || "",
    phaseId,
    status,
    evidence: summarizeEvidence(payload),
    errorMessage,
  };
}

function buildErrorMessage(status, payload) {
  if (String(status || "").toUpperCase() !== "FAIL") return "";
  if (!payload || typeof payload !== "object") return "assertion failed";
  if (payload.error) return String(payload.error);
  const draw = payload.draw || {};
  if (draw.apiCode || draw.apiMessage) {
    const code = draw.apiCode ? String(draw.apiCode) : "";
    const message = draw.apiMessage ? String(draw.apiMessage) : "";
    const suffix = [code ? `code=${code}` : "", message ? `msg=${message}` : ""].filter(Boolean).join(" ");
    return suffix ? `draw api ${suffix}` : "draw api failed";
  }
  return "assertion failed";
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
      activitySubtitle: payload.page.activitySubtitle || "",
      activitySubtitleVisible: Boolean(payload.page.activitySubtitleVisible),
      rulesVisible: Boolean(payload.page.rulesVisible),
      prizeCount: payload.page.prizeCount ?? null,
      prizeAreaVisible: Boolean(payload.page.prizeAreaVisible),
      mainVisualVisible: Boolean(payload.page.mainVisualVisible),
      horizontalOverflow: Boolean(payload.page.horizontalOverflow),
      countdownText: payload.page.countdownText || "",
      countdownVisible: Boolean(payload.page.countdownVisible),
      countdownTicking: Boolean(payload.page.countdownTicking),
      pageErrorVisible: Boolean(payload.page.pageErrorVisible),
      buttons: payload.page.buttons || [],
    } : null,
    consistency: payload.consistency ? {
      titleMatched: Boolean(payload.consistency.titleMatched),
      subtitleMatched: Boolean(payload.consistency.subtitleMatched),
      rulesMatched: Boolean(payload.consistency.rulesMatched),
      prizeCountMatched: Boolean(payload.consistency.prizeCountMatched),
      expectedPrizeCount: payload.consistency.expectedPrizeCount ?? null,
      detectedPrizeCount: payload.consistency.detectedPrizeCount ?? null,
      basicModulesVisible: Boolean(payload.consistency.basicModulesVisible),
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
      buttonRestoredAfterDraw: Boolean(payload.draw.buttonRestoredAfterDraw),
      duplicateClickBlocked: Boolean(payload.draw.duplicateClickBlocked),
      requestCountDelta: payload.draw.requestCountDelta ?? null,
      apiSuccess: Boolean(payload.draw.apiSuccess),
      apiCode: payload.draw.apiCode || "",
      apiMessage: payload.draw.apiMessage || "",
      popupVisible: Boolean(payload.draw.popupVisible),
      popupPrizeText: payload.draw.popupPrizeText || "",
      countBefore: payload.draw.countBefore ?? null,
      countAfter: payload.draw.countAfter ?? null,
    } : null,
    rewardRecord: payload.rewardRecord ? {
      opened: Boolean(payload.rewardRecord.opened),
      dialogVisible: Boolean(payload.rewardRecord.dialogVisible),
      fieldHeaders: payload.rewardRecord.fieldHeaders || [],
      hasRewardRow: Boolean(payload.rewardRecord.hasRewardRow),
      hasReadableRewardValue: Boolean(payload.rewardRecord.hasReadableRewardValue),
      latestRewardText: payload.rewardRecord.latestRewardText || "",
      closedOk: Boolean(payload.rewardRecord.closedOk),
      prizeMatchesPopup: Boolean(payload.rewardRecord.prizeMatchesPopup),
      expectedPopupPrizeText: payload.rewardRecord.expectedPopupPrizeText || "",
      dataLineCount: payload.rewardRecord.dataLineCount ?? null,
    } : null,
    linkage: payload.linkage ? {
      activityAlias: payload.linkage.activityAlias || "",
      expectedTitle: payload.linkage.expectedTitle || "",
      expectedSubtitle: payload.linkage.expectedSubtitle || "",
      titleUpdated: Boolean(payload.linkage.titleUpdated),
      subtitleUpdated: Boolean(payload.linkage.subtitleUpdated),
      titleMatched: Boolean(payload.linkage.titleMatched),
      subtitleMatched: Boolean(payload.linkage.subtitleMatched),
      frontendUrl: payload.linkage.frontendUrl || "",
    } : null,
    linkageReadonly: payload.linkageReadonly ? {
      languageSwitch: payload.linkageReadonly.languageSwitch ? {
        zhUrl: payload.linkageReadonly.languageSwitch.zhUrl || "",
        enUrl: payload.linkageReadonly.languageSwitch.enUrl || "",
        zhTitle: payload.linkageReadonly.languageSwitch.zhTitle || "",
        enTitle: payload.linkageReadonly.languageSwitch.enTitle || "",
        switched: Boolean(payload.linkageReadonly.languageSwitch.switched),
      } : null,
      faq: payload.linkageReadonly.faq ? {
        found: Boolean(payload.linkageReadonly.faq.found),
        matchedText: payload.linkageReadonly.faq.matchedText || "",
      } : null,
      calendarTab: payload.linkageReadonly.calendarTab ? {
        found: Boolean(payload.linkageReadonly.calendarTab.found),
        top: payload.linkageReadonly.calendarTab.top ?? null,
        text: payload.linkageReadonly.calendarTab.text || "",
      } : null,
    } : null,
  };
}

export function resolvePhaseCommands(phase, args, createdActivity) {
  return phase.commands.map(command => {
    const next = [...command];
    if (phase.phaseId === "online_lottery_activity") {
      if (createdActivity.activityAlias) {
        const index = next.indexOf("<created-alias>");
        if (index >= 0) next.splice(index, 1, createdActivity.activityAlias);
      } else if (createdActivity.activityId) {
        const aliasFlagIndex = next.indexOf("--activity-alias");
        if (aliasFlagIndex >= 0) next.splice(aliasFlagIndex, 2, "--activity-id", createdActivity.activityId);
      }
    }
    if (args.visible) next.push("--visible");
    return next;
  });
}

export function evaluateAdminMainCase(caseEntry, phaseResult) {
  if (!phaseResult) {
    return buildCaseResult(caseEntry, "", "SKIPPED");
  }
  if (!phaseResult.ok) {
    return buildCaseResult(caseEntry, phaseResult.phaseId, "FAIL", phaseResult.payload);
  }

  const payload = phaseResult.payload || {};
  const verifyFirst = payload.verifyFirst || {};
  const verifyItem = payload.verifyItem || {};
  const created = collectCreatedItems(phaseResult);
  const searchChecks = collectPrizeSearchChecks(phaseResult);

  if (caseEntry.caseId === "AC-01") {
    const passed = Boolean(payload.ok && (verifyFirst.id || verifyFirst.activityId || payload.verifyTotal === 1));
    return buildCaseResult(caseEntry, phaseResult.phaseId, passed ? "PASS" : "FAIL", payload);
  }
  if (caseEntry.caseId === "AC-07") {
    const passed = Array.isArray(verifyFirst.prize) && verifyFirst.prize.length === 8;
    return buildCaseResult(caseEntry, phaseResult.phaseId, passed ? "PASS" : "FAIL", payload);
  }
  if (caseEntry.caseId === "AC-08") {
    const taskCount = Array.isArray(verifyFirst.taskRequirement)
      ? verifyFirst.taskRequirement.length
      : Array.isArray(verifyFirst.taskConfig)
        ? verifyFirst.taskConfig.length
        : Array.isArray(verifyFirst.taskConfigIds)
          ? verifyFirst.taskConfigIds.length
          : 0;
    const passed = taskCount > 0;
    return buildCaseResult(caseEntry, phaseResult.phaseId, passed ? "PASS" : "FAIL", payload);
  }
  if (caseEntry.caseId === "ST-01") {
    const passed = verifyItem.status === "ONLINE" || payload.onlineBody?.code === 200;
    return buildCaseResult(caseEntry, phaseResult.phaseId, passed ? "PASS" : "FAIL", payload);
  }
  if (caseEntry.caseId === "PM-04") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrize(created, { category: "赠金" }));
  }
  if (caseEntry.caseId === "PM-01") {
    const matched = searchChecks?.byId?.ok ? searchChecks.byId : null;
    return buildMatchedRecordResult(caseEntry, phaseResult, matched);
  }
  if (caseEntry.caseId === "PM-02") {
    const matched = searchChecks?.byCategorySubtype?.ok ? searchChecks.byCategorySubtype : null;
    return buildMatchedRecordResult(caseEntry, phaseResult, matched);
  }
  if (caseEntry.caseId === "PM-03") {
    const byName = searchChecks?.byName;
    const byAlias = searchChecks?.byAlias;
    const matched = byName?.ok && byAlias?.ok ? { byName, byAlias } : null;
    return buildMatchedRecordResult(caseEntry, phaseResult, matched);
  }
  if (caseEntry.caseId === "PM-05") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrize(created, { category: "币种", subtype: "BTC" }));
  }
  if (caseEntry.caseId === "PM-06") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrize(created, { category: "实物" }));
  }
  if (caseEntry.caseId === "PM-07") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrize(created, { category: "虚拟积分或资格", subtype: "抽奖次数" }));
  }
  if (caseEntry.caseId === "PM-08") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrizeRowAction(phaseResult, "view"), "SKIPPED");
  }
  if (caseEntry.caseId === "PM-09") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrizeRowAction(phaseResult, "modify"), "SKIPPED");
  }
  if (caseEntry.caseId === "PM-10") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrizeRowAction(phaseResult, "copy"), "SKIPPED");
  }
  if (caseEntry.caseId === "PM-11") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findPrizeRowAction(phaseResult, "delete"), "SKIPPED");
  }
  if (caseEntry.caseId === "RT-03") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findTemplate(created, {
      signupMode: "注册即报名",
      platformScope: "全平台用户",
      restrictScope: "无",
    }));
  }
  if (caseEntry.caseId === "RT-04") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findTemplate(created, {
      signupMode: "用户手动点击报名",
      platformScope: "全平台用户",
      restrictScope: "无",
    }));
  }
  if (caseEntry.caseId === "RT-05") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findTemplate(created, {
      customMatcher: item => ["指定渠道码或邀请码", "自然流量", "非活跃用户", "混合条件", "假钱账户"].includes(item.platformScope),
    }), "SKIPPED");
  }
  if (caseEntry.caseId === "RT-06") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findTemplate(created, {
      customMatcher: item => Boolean(item.registerTimeRange?.start && item.registerTimeRange?.end),
    }), "SKIPPED");
  }
  if (["RT-07", "RT-08", "RT-09"].includes(caseEntry.caseId)) {
    return buildCaseResult(caseEntry, phaseResult.phaseId, "SKIPPED", payload);
  }
  if (caseEntry.caseId === "TM-07") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findTask(created, {
      scope: "报名的所有用户",
      rewardMode: "单一奖励",
      taskCondition: "KOL绑定",
    }));
  }
  if (caseEntry.caseId === "TM-08") {
    return buildMatchedRecordResult(caseEntry, phaseResult, hasTaskConditionCoverage(created, [
      "KOL绑定",
      "合约交易量",
      "现货交易量",
      "充值任务",
    ]) ? { covered: true } : null, "SKIPPED");
  }
  if (caseEntry.caseId === "TM-09") {
    return buildMatchedRecordResult(caseEntry, phaseResult, findTask(created, {
      rewardMode: "单一奖励",
      rewardMin: "10",
      rewardMax: "100",
    }), "SKIPPED");
  }
  if (["TM-10", "TM-11"].includes(caseEntry.caseId)) {
    return buildCaseResult(caseEntry, phaseResult.phaseId, "SKIPPED", payload);
  }
  return buildCaseResult(caseEntry, phaseResult.phaseId, "PASS", payload);
}

export function buildRegressionCaseResults(plan, phaseResults) {
  const executed = new Map(phaseResults.map(item => [item.phaseId, item]));
  return plan.phases.flatMap(phase => {
    const phaseResult = executed.get(phase.phaseId);
    if (!phaseResult) {
      return (phase.caseEntries || phase.caseIds || []).map(item => ({
        caseId: typeof item === "string" ? item : item.caseId,
        caseName: typeof item === "string" ? "" : item.caseName,
        module: typeof item === "string" ? "" : (item.module || ""),
        priority: typeof item === "string" ? "" : (item.priority || ""),
        phaseId: phase.phaseId,
        status: "SKIPPED",
        evidence: null,
      }));
    }
    return (phaseResult.cases || []).map(item => evaluateAdminMainCase(item, phaseResult));
  });
}

function buildCaseResult(caseEntry, phaseId, status, payload = null) {
  return {
    caseId: caseEntry.caseId,
    caseName: caseEntry.caseName || "",
    module: caseEntry.module || "",
    priority: caseEntry.priority || "",
    phaseId,
    status,
    evidence: payload ? summarizeEvidence(payload) : null,
    errorMessage: payload?.error || "",
  };
}

function buildMatchedRecordResult(caseEntry, phaseResult, matched, missingStatus = "FAIL") {
  return buildCaseResult(caseEntry, phaseResult.phaseId, matched ? "PASS" : missingStatus, matched || phaseResult.payload);
}

function collectCreatedItems(phaseResult) {
  const phaseCreated = Array.isArray(phaseResult?.payload?.created) ? phaseResult.payload.created : [];
  const childCreated = Array.isArray(phaseResult?.childResults)
    ? phaseResult.childResults.flatMap(item => Array.isArray(item?.payload?.created) ? item.payload.created : [])
    : [];
  return [...childCreated, ...phaseCreated];
}

function collectPrizeSearchChecks(phaseResult) {
  if (phaseResult?.payload?.searchChecks) return phaseResult.payload.searchChecks;
  if (!Array.isArray(phaseResult?.childResults)) return null;
  for (const child of phaseResult.childResults) {
    if (child?.payload?.searchChecks) return child.payload.searchChecks;
  }
  return null;
}

function findPrize(created, { category, subtype = "" }) {
  return created.find(item => {
    if (item?.category !== category) return false;
    if (subtype && item?.subtype !== subtype) return false;
    return true;
  }) || null;
}

function findTemplate(created, { signupMode = "", platformScope = "", restrictScope = "", customMatcher = null }) {
  return created.find(item => {
    if (customMatcher) return customMatcher(item);
    if (signupMode && item?.signupMode !== signupMode) return false;
    if (platformScope && item?.platformScope !== platformScope) return false;
    if (restrictScope && item?.restrictScope !== restrictScope) return false;
    return isSuccessfulCreate(item);
  }) || null;
}

function findTask(created, { scope = "", rewardMode = "", rewardMin = "", rewardMax = "", taskCondition = "", customMatcher = null }) {
  return created.find(item => {
    if (customMatcher) return customMatcher(item);
    if (scope && item?.scope !== scope) return false;
    if (rewardMode && item?.rewardMode !== rewardMode) return false;
    if (rewardMin && String(item?.rewardMin || "") !== rewardMin) return false;
    if (rewardMax && String(item?.rewardMax || "") !== rewardMax) return false;
    if (taskCondition && item?.taskCondition !== taskCondition) return false;
    return isSuccessfulCreate(item);
  }) || null;
}

function isSuccessfulCreate(item) {
  if (!item) return false;
  if (item.responseCode !== undefined) return Number(item.responseCode) === 200;
  if (item.submit?.body?.code !== undefined) return Number(item.submit.body.code) === 200;
  if (item.submitStatus !== undefined) return Number(item.submitStatus) < 400;
  return true;
}

function hasTaskConditionCoverage(created, expectedConditions) {
  const covered = new Set(
    created
      .filter(item => isSuccessfulCreate(item) && item?.taskCondition)
      .map(item => item.taskCondition)
  );
  return expectedConditions.every(condition => covered.has(condition));
}

function findPrizeRowAction(phaseResult, stepName) {
  const actionResults = Array.isArray(phaseResult?.childResults)
    ? phaseResult.childResults.flatMap(item => Array.isArray(item?.payload?.results) ? item.payload.results : [])
    : [];
  for (const result of actionResults) {
    const step = Array.isArray(result?.steps) ? result.steps.find(item => item?.step === stepName) : null;
    if (!step) continue;
    if (stepName === "view" && !(Number(step.status) === 200 && Number(step.responseCode) === 200)) continue;
    if (stepName === "modify" && !(Number(step.status) === 200 && Number(step.responseCode) === 200)) continue;
    if (stepName === "copy" && !(step.copied?.id && step.copied?.id !== result.originalId)) continue;
    if (stepName === "delete" && !(Number(step.status) === 200 && Number(step.responseCode) === 200 && step.rowAbsentAfterSearch)) continue;
    return {
      recordType: "prize_row_action",
      step: stepName,
      id: result.originalId || "",
      alias: result.originalAlias || "",
      name: result.originalName || "",
      modifiedName: result.modifiedName || "",
      copiedPrizeId: result.copiedId || step.copied?.id || step.deletedId || "",
      confirmText: step.confirmText || "",
    };
  }
  return null;
}

function summarizeEvidence(payload) {
  const verifyFirst = payload?.verifyFirst || {};
  const verifyItem = payload?.verifyItem || {};
  const summary = {
    ok: payload?.ok,
    error: payload?.error || "",
    alias: payload?.alias || verifyFirst?.showUrl || "",
    activityId: verifyFirst?.id || verifyFirst?.activityId || verifyItem?.id || payload?.id || "",
    prizeCount: Array.isArray(verifyFirst?.prize) ? verifyFirst.prize.length : 0,
    taskRequirementCount: Array.isArray(verifyFirst?.taskRequirement)
      ? verifyFirst.taskRequirement.length
      : Array.isArray(verifyFirst?.taskConfig)
        ? verifyFirst.taskConfig.length
      : Array.isArray(verifyFirst?.taskConfigIds)
        ? verifyFirst.taskConfigIds.length
        : 0,
    status: verifyItem?.status || "",
    onlineCode: payload?.onlineBody?.code || "",
    finalUrl: payload?.finalUrl || "",
    pageText: payload?.pageText ? String(payload.pageText).slice(0, 300) : "",
    responseCount: Array.isArray(payload?.responses) ? payload.responses.length : 0,
  };
  if (payload?.category) {
    summary.recordType = "prize";
    summary.prizeId = payload.id || "";
    summary.category = payload.category || "";
    summary.subtype = payload.subtype || "";
    summary.name = payload.name || "";
  }
  if (payload?.signupMode) {
    summary.recordType = "register_template";
    summary.templateName = payload.name || "";
    summary.signupMode = payload.signupMode || "";
    summary.platformScope = payload.platformScope || "";
    summary.restrictScope = payload.restrictScope || "";
  }
  if (payload?.scope && payload?.submit) {
    summary.recordType = "roulette_task";
    summary.taskId = payload.id || "";
    summary.taskName = payload.name || "";
    summary.scope = payload.scope || "";
    summary.taskCondition = payload.taskCondition || "";
    summary.rewardMode = payload.rewardMode || "";
    summary.rewardMin = payload.rewardMin || "";
    summary.rewardMax = payload.rewardMax || "";
  }
  if (payload?.recordType === "prize_row_action") {
    summary.recordType = "prize_row_action";
    summary.actionStep = payload.step || "";
    summary.prizeId = payload.id || "";
    summary.copiedPrizeId = payload.copiedPrizeId || "";
    summary.name = payload.name || "";
    summary.modifiedName = payload.modifiedName || "";
  }
  if (Array.isArray(payload?.responses) && payload.responses.length) {
    summary.lastResponse = summarizeLastResponse(payload.responses[payload.responses.length - 1]);
  }
  return summary;
}

function summarizeLastResponse(response) {
  if (!response) return null;
  return {
    url: response.url || "",
    method: response.method || "",
    status: response.status || "",
    bodyCode: response.body?.code || "",
    bodyMsg: response.body?.msg || response.body?.message || "",
  };
}

import { loadSchema, validateValue } from "./schema-validator.mjs";
import { RUN_STATUS, STAGE_IDS, STAGE_ORDER, STAGE_STATUS, getStage, stageAgentRole } from "./stages.mjs";

const runStateSchema = loadSchema("run-state.schema.json");
const stageReportSchema = loadSchema("stage-report.schema.json");

export function validateRunState(runState) {
  return validateValue(runState, runStateSchema);
}

export function validateStageReport(report, expectedStageId = "", expectedRunId = "") {
  const errors = validateValue(report, stageReportSchema);
  if (expectedStageId && report.stageId !== expectedStageId) {
    errors.push(`$.stageId: expected ${expectedStageId}`);
  }
  if (expectedRunId && report.runId !== expectedRunId) {
    errors.push(`$.runId: expected ${expectedRunId}`);
  }
  if (report.stageId && !STAGE_IDS.has(report.stageId)) {
    errors.push(`$.stageId: unknown stage ${report.stageId}`);
    return errors;
  }
  const stageSpecific = stageReportSchema.xStageSpecific?.[report.stageId];
  if (report.stageId) {
    const expectedStage = getStage(report.stageId);
    if (report.stageName !== expectedStage.name) {
      errors.push(`$.stageName: expected ${expectedStage.name}`);
    }
  }
  if (stageSpecific) {
    for (const key of stageSpecific.required || []) {
      if (!Object.prototype.hasOwnProperty.call(report, key)) {
        errors.push(`$.${key}: missing required property`);
      }
    }
    for (const [key, schema] of Object.entries(stageSpecific.properties || {})) {
      if (!Object.prototype.hasOwnProperty.call(report, key)) continue;
      errors.push(...validateValue(report[key], schema, stageReportSchema, `$.${key}`));
    }
  }
  const expectedRole = report.stageId ? stageAgentRole(report.stageId) : "";
  if (report.stageId && report.agentRole !== expectedRole) {
    errors.push(`$.agentRole: expected ${expectedRole}`);
  }
  if (report.stageId === "coverage_review" && report.coverageDecision === "REJECT" && !report.rejectReasonType) {
    errors.push("$.rejectReasonType: required when coverageDecision=REJECT");
  }
  if (report.stageId === "execution_run" && report.status !== "BLOCKED" && !report.executionDecision) {
    errors.push("$.executionDecision: required when execution status is PASS/FAIL");
  }
  return errors;
}

export function assertTerminalRun(runState) {
  if (!RUN_STATUS.has(runState.overallStatus) || runState.overallStatus === "IN_PROGRESS") {
    throw new Error(`Run ${runState.runId} is not terminal yet.`);
  }
}

export function nextStateForStage(runState, report) {
  const stage = getStage(report.stageId);
  const next = {
    overallStatus: runState.overallStatus,
    currentStageId: stage.id,
    nextStageId: "",
  };

  if (stage.id === "linkage_analysis") {
    if (report.status === "PASS") next.nextStageId = "coverage_review";
    else next.overallStatus = report.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    return next;
  }

  if (stage.id === "coverage_review") {
    if (report.coverageDecision === "APPROVE" && report.status === "PASS") {
      next.nextStageId = "script_integration";
    } else if (report.coverageDecision === "REJECT" && (report.status === "FAIL" || report.status === "BLOCKED")) {
      next.nextStageId = "rework_advice";
    } else {
      next.overallStatus = report.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    }
    return next;
  }

  if (stage.id === "rework_advice") {
    const previousReview = runState.stages.validation_review?.status === "FAIL" || runState.stages.validation_review?.status === "BLOCKED"
      ? runState.stages.validation_review
      : runState.stages.coverage_review;
    next.overallStatus = previousReview?.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    next.nextStageId = "";
    return next;
  }

  if (stage.id === "script_integration") {
    if (report.integrationDecision === "READY" && report.status === "PASS") {
      next.nextStageId = "validation_review";
    } else {
      next.overallStatus = report.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    }
    return next;
  }

  if (stage.id === "validation_review") {
    if (report.validationDecision === "APPROVE" && report.status === "PASS") {
      next.nextStageId = "execution_run";
    } else if (report.validationDecision === "REJECT" && (report.status === "FAIL" || report.status === "BLOCKED")) {
      next.nextStageId = "rework_advice";
    } else {
      next.overallStatus = report.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    }
    return next;
  }

  if (stage.id === "execution_run") {
    next.overallStatus = report.executionDecision === "PASS" && report.status === "PASS"
      ? "PASS"
      : (report.status === "BLOCKED" ? "BLOCKED" : "FAIL");
    next.nextStageId = "";
    return next;
  }

  return next;
}

export function markRemainingStagesSkipped(runState, timestamp) {
  for (const stageId of STAGE_ORDER) {
    const stage = runState.stages[stageId];
    if (stage.status !== "PENDING") continue;
    stage.status = "SKIPPED";
    stage.decision = "未进入该阶段";
    stage.recordedAt = timestamp;
  }
}

export function expectedStageOrThrow(runState, stageId) {
  if (!runState.nextStageId) {
    throw new Error(`Run ${runState.runId} has no next stage.`);
  }
  if (runState.nextStageId !== stageId) {
    throw new Error(`Run ${runState.runId} expected stage ${runState.nextStageId}, received ${stageId}.`);
  }
  if (!STAGE_STATUS.has(runState.stages[stageId]?.status || "")) {
    throw new Error(`Invalid recorded stage state for ${stageId}.`);
  }
  if (runState.stages[stageId].status !== "PENDING") {
    throw new Error(`Stage ${stageId} has already been recorded.`);
  }
}

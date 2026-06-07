import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const scriptsRoot = path.join(repoRoot, "orchestrations/automation-review-pipeline/scripts");

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "automation-review-pipeline-"));
}

function run(scriptName, args, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [path.join(scriptsRoot, scriptName), ...args], {
    cwd,
    encoding: "utf8",
  });
  const payload = parseLastJson(result.stdout) || parseLastJson(result.stderr);
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
    payload,
  };
}

function parseLastJson(text) {
  const lines = String(text || "").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trimStart();
    if (!line.startsWith("{")) continue;
    const candidate = lines.slice(i).join("\n");
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function writeStageFiles(root, name, json) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const jsonFile = path.join(dir, `${name}.json`);
  const mdFile = path.join(dir, `${name}.md`);
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2));
  fs.writeFileSync(mdFile, `# ${json.stageName}\n\n- 结论：${json.decision}\n`);
  return { jsonFile, mdFile };
}

function stageReport(overrides = {}) {
  return {
    runId: "2026-06-07-001",
    stageId: "linkage_analysis",
    stageName: "链路分析",
    agentRole: "链路分析 subagent",
    status: "PASS",
    decision: "推荐纳入自动化覆盖",
    summary: "现有覆盖部分可复用，需要补充编排层。",
    inputs: ["原始回归需求"],
    findings: ["已有 orchestrations 可复用"],
    evidence: ["orchestrations/lottery-regression/README.md"],
    risks: ["需保持跨 skill 边界"],
    nextAction: "进入覆盖审阅",
    relatedCommands: ["node orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs --menu"],
    relatedFiles: ["orchestrations/lottery-regression/README.md"],
    timestamp: "2026-06-07T10:00:00.000Z",
    existingCoverage: "PARTIAL",
    suggestedFlow: ["链路分析", "覆盖审阅", "脚本整合"],
    dependentSkills: ["weex-admin-ops", "weex-frontend-ops"],
    entrypoints: ["orchestrations/lottery-regression/scripts/lottery-regression-dispatcher.mjs"],
    ...overrides,
  };
}

test("prepare-run creates sequential history directories on same day", () => {
  const historyRoot = tmpRoot();
  const first = run("prepare-run.mjs", [
    "--title", "第一次任务",
    "--requirement", "分析第一次需求",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const second = run("prepare-run.mjs", [
    "--title", "第二次任务",
    "--requirement", "分析第二次需求",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const third = run("prepare-run.mjs", [
    "--title", "第三次任务",
    "--requirement", "分析第三次需求",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(third.status, 0);
  assert.equal(first.payload.runId, "2026-06-07-001");
  assert.equal(second.payload.runId, "2026-06-07-002");
  assert.equal(third.payload.runId, "2026-06-07-003");
});

test("prepare-run uses max suffix plus one when history has gaps", () => {
  const historyRoot = tmpRoot();
  fs.mkdirSync(path.join(historyRoot, "2026-06-07-001"), { recursive: true });
  fs.mkdirSync(path.join(historyRoot, "2026-06-07-003"), { recursive: true });
  const prepared = run("prepare-run.mjs", [
    "--title", "有缺口的目录",
    "--requirement", "验证编号分配",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  assert.equal(prepared.status, 0);
  assert.equal(prepared.payload.runId, "2026-06-07-004");
});

test("build-stage-context writes next stage packet for fresh run", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "新 run",
    "--requirement", "需要构建第一阶段上下文",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const built = run("build-stage-context.mjs", [
    "--run-id", runId,
    "--history-root", historyRoot,
  ]);
  assert.equal(built.status, 0);
  assert.equal(built.payload.nextStageId, "linkage_analysis");
  assert.match(built.payload.promptPath, /prompts\/01-链路分析\.md$/);
  assert.ok(fs.existsSync(built.payload.contextMarkdown));
  assert.ok(fs.existsSync(built.payload.contextJson));
});

test("coverage review approve skips rework and advances to script integration", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "自动化回归",
    "--requirement", "请新增自动化覆盖",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  let files = writeStageFiles(historyRoot, "linkage", stageReport({ runId }));
  let recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "linkage_analysis",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.status, 0);
  assert.equal(recorded.payload.nextStageId, "coverage_review");

  files = writeStageFiles(historyRoot, "coverage", stageReport({
    runId,
    stageId: "coverage_review",
    stageName: "覆盖审阅",
    agentRole: "覆盖审阅 subagent",
    status: "PASS",
    decision: "同意纳入覆盖",
    summary: "业务价值明确，风险可控。",
    nextAction: "进入脚本整合",
    coverageDecision: "APPROVE"
  }));
  recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "coverage_review",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.status, 0);
  assert.equal(recorded.payload.nextStageId, "script_integration");

  const built = run("build-stage-context.mjs", [
    "--run-id", runId,
    "--history-root", historyRoot,
  ]);
  assert.equal(built.status, 0);
  assert.equal(built.payload.nextStageId, "script_integration");
  assert.ok(built.payload.contextFiles.some(item => /01-链路分析报告\.md$/.test(item)));
  assert.ok(built.payload.contextFiles.some(item => /02-覆盖审阅报告\.json$/.test(item)));
});

test("uncovered requirement can still be approved and receives new coverage guidance", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "新增覆盖需求",
    "--requirement", "当前没有现成自动化，希望设计并执行新覆盖",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;

  let files = writeStageFiles(historyRoot, "linkage-none", stageReport({
    runId,
    decision: "当前暂无现成覆盖，但建议新增自动化",
    summary: "已有体系可承接，只缺新增用例与脚本补齐。",
    existingCoverage: "NONE",
    suggestedFlow: ["链路分析", "覆盖审阅", "脚本整合", "校验审阅", "执行落地"],
    entrypoints: ["orchestrations/automation-review-pipeline/scripts/build-stage-context.mjs"],
  }));
  let recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "linkage_analysis",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.status, 0);
  assert.equal(recorded.payload.nextStageId, "coverage_review");

  files = writeStageFiles(historyRoot, "coverage-approve-none", stageReport({
    runId,
    stageId: "coverage_review",
    stageName: "覆盖审阅",
    agentRole: "覆盖审阅 subagent",
    status: "PASS",
    decision: "同意纳入新增覆盖",
    summary: "虽然当前无现成用例，但收益明确，可以先补设计再执行。",
    nextAction: "进入脚本整合补新增覆盖",
    coverageDecision: "APPROVE",
  }));
  recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "coverage_review",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.status, 0);
  assert.equal(recorded.payload.nextStageId, "script_integration");

  const built = run("build-stage-context.mjs", [
    "--run-id", runId,
    "--history-root", historyRoot,
  ]);
  assert.equal(built.status, 0);
  assert.equal(built.payload.nextStageId, "script_integration");
  const packet = JSON.parse(fs.readFileSync(built.payload.contextJson, "utf8"));
  assert.equal(packet.pipelineSignals.existingCoverage, "NONE");
  assert.equal(packet.pipelineSignals.coverageDecision, "APPROVE");
  assert.ok(packet.stageSpecificHints.some(item => item.includes("新增用例设计")));
  assert.ok(packet.parentInstructions.some(item => item.includes("不得因无现成脚本直接终止")));
});

test("coverage review reject requires rework and finalization skips later stages", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "高风险需求",
    "--requirement", "请直接做高风险自动化",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  let files = writeStageFiles(historyRoot, "linkage", stageReport({ runId }));
  run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "linkage_analysis",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);

  files = writeStageFiles(historyRoot, "coverage", stageReport({
    runId,
    stageId: "coverage_review",
    stageName: "覆盖审阅",
    agentRole: "覆盖审阅 subagent",
    status: "FAIL",
    decision: "暂不纳入覆盖",
    summary: "当前收益不足以覆盖维护成本。",
    nextAction: "输出返工建议并终止",
    coverageDecision: "REJECT",
    rejectReasonType: "NO_VALUE"
  }));
  let recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "coverage_review",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.payload.nextStageId, "rework_advice");

  files = writeStageFiles(historyRoot, "rework", stageReport({
    runId,
    stageId: "rework_advice",
    stageName: "返工建议",
    agentRole: "返工建议 subagent",
    status: "PASS",
    decision: "回退到覆盖审阅前补充价值说明",
    summary: "需要补业务收益和复用关系。",
    nextAction: "终止本次流程",
    reworkTargetStage: "coverage_review",
    reworkItems: ["补充业务价值", "补充替代方案比较"],
    acceptanceCriteria: ["能证明自动化收益大于维护成本"]
  }));
  recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "rework_advice",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.payload.overallStatus, "FAIL");

  const finalized = run("finalize-run.mjs", [
    "--run-id", runId,
    "--history-root", historyRoot,
  ]);
  assert.equal(finalized.status, 0);
  const runState = JSON.parse(fs.readFileSync(path.join(historyRoot, runId, "run-state.json"), "utf8"));
  assert.equal(runState.stages.script_integration.status, "SKIPPED");
  assert.equal(runState.stages.validation_review.status, "SKIPPED");
  assert.equal(runState.stages.execution_run.status, "SKIPPED");
  assert.ok(fs.existsSync(path.join(historyRoot, runId, "03-返工建议报告.md")));
});

test("validation review reject requires rework and blocks execution", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "校验拒绝",
    "--requirement", "需要走到校验审阅拒绝",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const stagePayloads = [
    stageReport({ runId }),
    stageReport({
      runId,
      stageId: "coverage_review",
      stageName: "覆盖审阅",
      agentRole: "覆盖审阅 subagent",
      status: "PASS",
      decision: "通过",
      summary: "允许继续。",
      nextAction: "进入脚本整合",
      coverageDecision: "APPROVE"
    }),
    stageReport({
      runId,
      stageId: "script_integration",
      stageName: "脚本整合",
      agentRole: "脚本整合 subagent",
      status: "PASS",
      decision: "整合完成",
      summary: "已有脚本入口和报告计划。",
      nextAction: "进入校验审阅",
      integrationDecision: "READY",
      scriptPlan: ["复用现有 dispatcher", "新增 history 记录"],
      artifactPlan: ["history/ 目录", "最终执行报告"]
    }),
    stageReport({
      runId,
      stageId: "validation_review",
      stageName: "校验审阅",
      agentRole: "校验审阅 subagent",
      status: "FAIL",
      decision: "证据不足",
      summary: "缺少执行前验证。",
      nextAction: "进入返工建议",
      validationDecision: "REJECT",
      gaps: ["缺少 dry simulation 结果"],
      requiredFixes: ["补全执行前证据"]
    }),
    stageReport({
      runId,
      stageId: "rework_advice",
      stageName: "返工建议",
      agentRole: "返工建议 subagent",
      status: "PASS",
      decision: "回到脚本整合补证据",
      summary: "需要补 dry simulation。",
      nextAction: "终止本次流程",
      reworkTargetStage: "script_integration",
      reworkItems: ["补 dry simulation", "补执行前校验断言"],
      acceptanceCriteria: ["校验审阅能给出 APPROVE"]
    }),
  ];
  const stageIds = ["linkage_analysis", "coverage_review", "script_integration", "validation_review", "rework_advice"];
  stageIds.forEach((stageId, index) => {
    const files = writeStageFiles(historyRoot, `${stageId}-${index}`, stagePayloads[index]);
    const recorded = run("record-stage.mjs", [
      "--run-id", runId,
      "--stage-id", stageId,
      "--history-root", historyRoot,
      "--report-json-file", files.jsonFile,
      "--report-markdown-file", files.mdFile,
    ]);
    assert.equal(recorded.status, 0);
  });
  const finalized = run("finalize-run.mjs", ["--run-id", runId, "--history-root", historyRoot]);
  assert.equal(finalized.status, 0);
  const runState = JSON.parse(fs.readFileSync(path.join(historyRoot, runId, "run-state.json"), "utf8"));
  assert.equal(runState.stages.execution_run.status, "SKIPPED");
});

test("execution failure produces final FAIL and keeps artifact paths", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "执行失败",
    "--requirement", "需要模拟执行失败",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const payloads = [
    stageReport({ runId }),
    stageReport({
      runId,
      stageId: "coverage_review",
      stageName: "覆盖审阅",
      agentRole: "覆盖审阅 subagent",
      status: "PASS",
      decision: "通过",
      summary: "可做自动化。",
      nextAction: "进入脚本整合",
      coverageDecision: "APPROVE"
    }),
    stageReport({
      runId,
      stageId: "script_integration",
      stageName: "脚本整合",
      agentRole: "脚本整合 subagent",
      status: "PASS",
      decision: "整合完成",
      summary: "执行方案已落地。",
      nextAction: "进入校验审阅",
      integrationDecision: "READY",
      scriptPlan: ["执行现有 full-regression"],
      artifactPlan: ["history 执行报告引用 result 路径"]
    }),
    stageReport({
      runId,
      stageId: "validation_review",
      stageName: "校验审阅",
      agentRole: "校验审阅 subagent",
      status: "PASS",
      decision: "校验通过",
      summary: "允许进入执行。",
      nextAction: "进入执行落地",
      validationDecision: "APPROVE",
      gaps: [],
      requiredFixes: []
    }),
    stageReport({
      runId,
      stageId: "execution_run",
      stageName: "执行落地",
      agentRole: "执行落地 subagent",
      status: "FAIL",
      decision: "执行失败",
      summary: "脚本返回非零退出码。",
      nextAction: "记录失败并结束",
      executionDecision: "FAIL",
      executedCommands: ["node orchestrations/full-regression/scripts/run-full-regression.mjs --confirm-run"],
      outputArtifacts: ["result/full-regression/20260607_100000/summary.json"],
      verificationEvidence: ["exitCode=1", "summary.json 显示 FAIL 6"]
    }),
  ];
  const ids = ["linkage_analysis", "coverage_review", "script_integration", "validation_review", "execution_run"];
  ids.forEach((stageId, index) => {
    const files = writeStageFiles(historyRoot, `${stageId}-${index}`, payloads[index]);
    const recorded = run("record-stage.mjs", [
      "--run-id", runId,
      "--stage-id", stageId,
      "--history-root", historyRoot,
      "--report-json-file", files.jsonFile,
      "--report-markdown-file", files.mdFile,
    ]);
    assert.equal(recorded.status, 0);
  });
  const finalized = run("finalize-run.mjs", ["--run-id", runId, "--history-root", historyRoot]);
  assert.equal(finalized.payload.overallStatus, "FAIL");
  const finalMd = fs.readFileSync(path.join(historyRoot, runId, "07-最终结论报告.md"), "utf8");
  assert.match(finalMd, /最终状态: `FAIL`/);
  assert.match(finalMd, /06-执行报告.md/);
});

test("record-stage rejects invalid stage report enum", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "非法枚举",
    "--requirement", "验证 schema 校验",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const files = writeStageFiles(historyRoot, "invalid-linkage", stageReport({
    runId,
    existingCoverage: "BROKEN"
  }));
  const recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "linkage_analysis",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.status, 1);
  assert.match(recorded.stderr, /expected one of NONE, PARTIAL, FULL/);
});

test("record-stage rejects report runId mismatch", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "跨 run 污染",
    "--requirement", "验证 runId 一致性",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const files = writeStageFiles(historyRoot, "mismatch-run", stageReport({
    runId: "DIFFERENT-RUN"
  }));
  const recorded = run("record-stage.mjs", [
    "--run-id", runId,
    "--stage-id", "linkage_analysis",
    "--history-root", historyRoot,
    "--report-json-file", files.jsonFile,
    "--report-markdown-file", files.mdFile,
  ]);
  assert.equal(recorded.status, 1);
  assert.match(recorded.stderr, /expected 2026-06-07-001/);
});

test("execution stage accepts BLOCKED without executionDecision", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "执行阻塞",
    "--requirement", "验证执行 BLOCKED 合同",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const payloads = [
    stageReport({ runId }),
    stageReport({
      runId,
      stageId: "coverage_review",
      stageName: "覆盖审阅",
      agentRole: "覆盖审阅 subagent",
      status: "PASS",
      decision: "通过",
      summary: "可继续。",
      nextAction: "进入脚本整合",
      coverageDecision: "APPROVE"
    }),
    stageReport({
      runId,
      stageId: "script_integration",
      stageName: "脚本整合",
      agentRole: "脚本整合 subagent",
      status: "PASS",
      decision: "整合完成",
      summary: "进入校验。",
      nextAction: "进入校验审阅",
      integrationDecision: "READY",
      scriptPlan: ["复用脚本"],
      artifactPlan: ["history"]
    }),
    stageReport({
      runId,
      stageId: "validation_review",
      stageName: "校验审阅",
      agentRole: "校验审阅 subagent",
      status: "PASS",
      decision: "校验通过",
      summary: "允许执行。",
      nextAction: "进入执行",
      validationDecision: "APPROVE",
      gaps: [],
      requiredFixes: []
    }),
    {
      ...stageReport({
        runId,
        stageId: "execution_run",
        stageName: "执行落地",
        agentRole: "执行落地 subagent",
        status: "BLOCKED",
        decision: "等待外部登录态",
        summary: "环境未准备完成。",
        nextAction: "结束并标记阻塞",
        executedCommands: ["node x"],
        outputArtifacts: [],
        verificationEvidence: ["缺少登录态"]
      }),
      existingCoverage: undefined,
      suggestedFlow: undefined,
      dependentSkills: undefined,
      entrypoints: undefined,
      executionDecision: undefined
    }
  ];
  const ids = ["linkage_analysis", "coverage_review", "script_integration", "validation_review", "execution_run"];
  ids.forEach((stageId, index) => {
    const files = writeStageFiles(historyRoot, `${stageId}-blocked-${index}`, payloads[index]);
    const recorded = run("record-stage.mjs", [
      "--run-id", runId,
      "--stage-id", stageId,
      "--history-root", historyRoot,
      "--report-json-file", files.jsonFile,
      "--report-markdown-file", files.mdFile,
    ]);
    assert.equal(recorded.status, 0);
  });
  const finalized = run("finalize-run.mjs", ["--run-id", runId, "--history-root", historyRoot]);
  assert.equal(finalized.status, 0);
  assert.equal(finalized.payload.overallStatus, "BLOCKED");
});

test("prepare-run resume does not create a new run id", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "恢复运行",
    "--requirement", "先创建再恢复",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const resumed = run("prepare-run.mjs", [
    "--resume-run-id", prepared.payload.runId,
    "--history-root", historyRoot,
  ]);
  assert.equal(resumed.status, 0);
  assert.equal(resumed.payload.runId, prepared.payload.runId);
  assert.equal(fs.readdirSync(historyRoot).filter(name => /^\d{4}-\d{2}-\d{2}-\d{3}$/.test(name)).length, 1);
});

test("build-stage-context returns terminal finalize-ready packet after finalization", () => {
  const historyRoot = tmpRoot();
  const prepared = run("prepare-run.mjs", [
    "--title", "终态上下文",
    "--requirement", "验证终态 packet",
    "--history-root", historyRoot,
    "--date", "2026-06-07",
  ]);
  const runId = prepared.payload.runId;
  const payloads = [
    stageReport({ runId }),
    stageReport({
      runId,
      stageId: "coverage_review",
      stageName: "覆盖审阅",
      agentRole: "覆盖审阅 subagent",
      status: "PASS",
      decision: "通过",
      summary: "可继续。",
      nextAction: "进入脚本整合",
      coverageDecision: "APPROVE"
    }),
    stageReport({
      runId,
      stageId: "script_integration",
      stageName: "脚本整合",
      agentRole: "脚本整合 subagent",
      status: "PASS",
      decision: "整合完成",
      summary: "进入校验。",
      nextAction: "进入校验审阅",
      integrationDecision: "READY",
      scriptPlan: ["复用脚本"],
      artifactPlan: ["history"]
    }),
    stageReport({
      runId,
      stageId: "validation_review",
      stageName: "校验审阅",
      agentRole: "校验审阅 subagent",
      status: "PASS",
      decision: "校验通过",
      summary: "允许执行。",
      nextAction: "进入执行",
      validationDecision: "APPROVE",
      gaps: [],
      requiredFixes: []
    }),
    stageReport({
      runId,
      stageId: "execution_run",
      stageName: "执行落地",
      agentRole: "执行落地 subagent",
      status: "PASS",
      decision: "执行通过",
      summary: "脚本执行成功。",
      nextAction: "收尾",
      executionDecision: "PASS",
      executedCommands: ["node x"],
      outputArtifacts: ["result/some-report.json"],
      verificationEvidence: ["summary PASS"]
    }),
  ];
  const ids = ["linkage_analysis", "coverage_review", "script_integration", "validation_review", "execution_run"];
  ids.forEach((stageId, index) => {
    const files = writeStageFiles(historyRoot, `${stageId}-terminal-${index}`, payloads[index]);
    const recorded = run("record-stage.mjs", [
      "--run-id", runId,
      "--stage-id", stageId,
      "--history-root", historyRoot,
      "--report-json-file", files.jsonFile,
      "--report-markdown-file", files.mdFile,
    ]);
    assert.equal(recorded.status, 0);
  });
  const finalized = run("finalize-run.mjs", ["--run-id", runId, "--history-root", historyRoot]);
  assert.equal(finalized.status, 0);
  const built = run("build-stage-context.mjs", [
    "--run-id", runId,
    "--history-root", historyRoot,
  ]);
  assert.equal(built.status, 0);
  assert.equal(built.payload.terminal, true);
  assert.equal(built.payload.finalizeReady, true);
  assert.equal(built.payload.nextStageId, "");
});

import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function defaultResultRoot(repoRoot) {
  return path.join(repoRoot, "result");
}

export function timestampSlug(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function toMarkdownValue(value) {
  if (value === null || value === undefined) return "`null`";
  if (typeof value === "string") return value.includes("\n") ? `\n\n\`\`\`\n${value}\n\`\`\`\n` : `\`${value}\``;
  if (typeof value === "number" || typeof value === "boolean") return `\`${String(value)}\``;
  return `\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
}

function toText(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function statusText(ok) {
  if (ok === true) return "PASS";
  if (ok === false) return "FAIL";
  return "UNKNOWN";
}

const DEFAULT_STEP_META_ZH = {
  upload_banner: { desc: "上传活动 Banner/资源图，获取可用于活动配置的图片 URL。", expected: "上传成功并返回可访问的资源 URL。" },
  refresh_api_session_before_activity_create: { desc: "刷新后管 API 会话，确保后续创建接口具备有效登录态。", expected: "会话刷新成功，后续创建接口不再出现登录态/权限错误。" },
  auth_refresh_before_create_retry: { desc: "当创建接口失败时刷新鉴权并重试，提升稳定性。", expected: "鉴权刷新成功，重试路径可继续执行后续步骤。" },

  create_register_template_from_scratch: { desc: "从零创建报名模板（不 clone），作为活动依赖。", expected: "创建成功并获得模板 ID；活动创建时可绑定该模板。" },
  create_multilanguage_template: { desc: "创建多语言模板（i18n），用于活动文案/FAQ 等多语言配置。", expected: "创建成功并获得模板 ID；活动创建/编辑可引用。" },
  create_task_package: { desc: "创建任务包（普通任务包）。", expected: "创建成功并获得任务包 ID；活动创建时可绑定。" },
  create_routine_task_package: { desc: "创建日常任务包（routine）。", expected: "创建成功并获得任务包 ID；活动创建时可绑定。" },

  create_gift_cash_prize_from_scratch: { desc: "从零创建赠金类奖品（不 clone），作为活动依赖。", expected: "创建成功并获得奖品 ID；活动创建时可配置该奖品。" },
  create_position_airdrop_prize: { desc: "创建仓位空投奖品（position airdrop）。", expected: "创建成功并获得奖品/奖池配置；可被活动引用发放。" },
  create_resource_cards_from_scratch: { desc: "从零创建资源卡/道具卡类依赖。", expected: "创建成功并获得资源卡 ID；活动创建时可绑定/引用。" },

  pick_task_ids: { desc: "从任务列表中挑选/定位需要绑定到活动的任务 ID。", expected: "获得有效 taskId 列表，后续可用于活动任务配置。" },
  create_virtual_prizes: { desc: "创建虚拟奖品配置（用于展示/奖池占位）。", expected: "创建成功并可用于活动奖池/奖品配置。" },

  draft_checks: { desc: "执行草稿态检查（draft-checks），校验活动配置完整性与必填项。", expected: "检查通过；fullConfigChecks 无阻塞项。" },
  online: { desc: "将活动上线（发布），用于验证上线状态与前端可用性。", expected: "上线成功；活动状态变为在线/进行中/待开始（取决于时间窗口）。" },
  offline: { desc: "将活动下线（撤销发布），用于验证下线链路与清理前置。", expected: "下线成功；活动状态变为下线/已撤销。" },
  cleanup: { desc: "清理本次创建的依赖与活动（可选），避免污染环境。", expected: "尽力删除/解绑创建物；核心对象不再出现在列表回查中。" },
  cleanup_on_failure: { desc: "失败场景下的补偿清理，降低环境污染。", expected: "在可执行范围内完成清理或记录清理失败原因。" },
};

function stepMetaZh(stepName, overrides) {
  const base = DEFAULT_STEP_META_ZH[stepName] || null;
  const custom = overrides && typeof overrides === "object" ? overrides[stepName] : null;
  return {
    desc: (custom && custom.desc) || (base && base.desc) || `执行子步骤：${stepName}`,
    expected: (custom && custom.expected) || (base && base.expected) || "接口返回成功并通过回查验证。",
  };
}

export function writeResultMarkdown({
  repoRoot,
  suite = "universal-regression",
  caseId,
  title,
  testCase = null,
  summary = {},
  steps = [],
  links = [],
  raw = {},
  now = new Date(),
} = {}) {
  if (!repoRoot) throw new Error("writeResultMarkdown requires repoRoot");
  if (!caseId) throw new Error("writeResultMarkdown requires caseId");
  const root = ensureDir(defaultResultRoot(repoRoot));
  const runDir = ensureDir(path.join(root, suite, timestampSlug(now)));
  const filePath = path.join(runDir, `${caseId}.md`);

  const lines = [];
  const shouldStandardize = Boolean(testCase && typeof testCase === "object");
  lines.push(`# ${title || caseId}`);
  lines.push("");
  lines.push(`- caseId: ${toMarkdownValue(caseId)}`);
  lines.push(`- suite: ${toMarkdownValue(suite)}`);
  lines.push(`- generatedAt: ${toMarkdownValue(now.toISOString())}`);
  lines.push("");

  if (shouldStandardize) {
    const caseNo = String(testCase.number || testCase.caseNo || testCase.id || caseId);
    const caseName = String(testCase.name || title || caseId);
    const caseDesc = String(testCase.description || testCase.desc || "");
    const preconditions = Array.isArray(testCase.preconditions) ? testCase.preconditions.map(v => String(v)).filter(Boolean) : [];
    const stepOverrides = testCase.stepMeta || testCase.stepMetas || null;

    const overallOk = summary && typeof summary === "object" ? summary.ok : undefined;
    const total = Array.isArray(steps) ? steps.filter(s => s && typeof s === "object").length : 0;
    const passed = Array.isArray(steps) ? steps.filter(s => s && typeof s === "object" && s.ok === true).length : 0;
    const failed = Array.isArray(steps) ? steps.filter(s => s && typeof s === "object" && s.ok === false).length : 0;

    lines.push("## 用例信息");
    lines.push(`- 用例编号: ${toText(caseNo)}`);
    lines.push(`- 用例名称: ${toText(caseName)}`);
    if (caseDesc) lines.push(`- 用例描述: ${caseDesc}`);
    if (testCase.type) lines.push(`- 用例类型: ${toText(String(testCase.type))}`);
    if (testCase.owner) lines.push(`- 负责人: ${toText(String(testCase.owner))}`);
    if (testCase.tags && Array.isArray(testCase.tags) && testCase.tags.length) lines.push(`- 标签: ${testCase.tags.map(String).join(", ")}`);
    lines.push("");

    lines.push("## 前置条件");
    if (preconditions.length) {
      for (const item of preconditions) lines.push(`- ${item}`);
    } else {
      lines.push("-（未声明）");
    }
    lines.push("");

    lines.push("## 执行汇总");
    lines.push(`- 总体结果: ${statusText(overallOk)}`);
    lines.push(`- 子用例总数: ${toText(total)}`);
    lines.push(`- 通过: ${toText(passed)}`);
    lines.push(`- 失败: ${toText(failed)}`);
    lines.push("");

    const summaryKeys = summary && typeof summary === "object" ? Object.keys(summary) : [];
    if (summaryKeys.length) {
      lines.push("## 关键输出");
      for (const key of summaryKeys.sort()) {
        lines.push(`- ${key}: ${toMarkdownValue(summary[key]).trim()}`);
      }
      lines.push("");
    }

    lines.push("## 子用例清单");
    lines.push("");
    lines.push("| 编号 | 子用例名称 | 子用例描述 | 结果 |");
    lines.push("| --- | --- | --- | --- |");
    const normalizedSteps = Array.isArray(steps) ? steps.filter(s => s && typeof s === "object") : [];
    normalizedSteps.forEach((step, idx) => {
      const stepName = String(step.name || step.step || `step_${idx + 1}`);
      const subNo = `${caseNo}-TC-${pad2(idx + 1)}`;
      const meta = stepMetaZh(stepName, stepOverrides);
      lines.push(`| ${subNo} | ${stepName} | ${meta.desc.replace(/\|/g, "\\|")} | ${statusText(step.ok)} |`);
    });
    lines.push("");

    lines.push("## 子用例明细");
    lines.push("");
    normalizedSteps.forEach((step, idx) => {
      const stepName = String(step.name || step.step || `step_${idx + 1}`);
      const subNo = `${caseNo}-TC-${pad2(idx + 1)}`;
      const meta = stepMetaZh(stepName, stepOverrides);
      lines.push(`### ${subNo} ${stepName}`);
      lines.push(`- 结果: ${statusText(step.ok)}`);
      lines.push(`- 子用例描述: ${meta.desc}`);
      lines.push(`- 预期结果: ${meta.expected}`);
      const fields = { ...step };
      delete fields.name;
      delete fields.step;
      const keys = Object.keys(fields);
      if (keys.length) {
        lines.push("- 实际结果/证据:");
        for (const key of keys.sort()) {
          lines.push(`  - ${key}: ${toMarkdownValue(fields[key]).trim()}`);
        }
      } else {
        lines.push("- 实际结果/证据: （无）");
      }
      lines.push("");
    });
  }

  const summaryKeys = summary && typeof summary === "object" ? Object.keys(summary) : [];
  if (!shouldStandardize && summaryKeys.length) {
    lines.push("## Summary");
    for (const key of summaryKeys.sort()) {
      lines.push(`- ${key}: ${toMarkdownValue(summary[key]).trim()}`);
    }
    lines.push("");
  }

  if (Array.isArray(links) && links.length) {
    lines.push("## Links");
    for (const link of links) {
      if (!link) continue;
      const label = link.label ? String(link.label) : String(link.url || "");
      const url = link.url ? String(link.url) : "";
      if (!url) continue;
      lines.push(`- ${label}: ${url}`);
    }
    lines.push("");
  }

  if (!shouldStandardize && Array.isArray(steps) && steps.length) {
    lines.push("## Steps");
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const name = String(step.name || step.step || "step");
      const ok = step.ok === undefined ? "" : (step.ok ? "PASS" : "FAIL");
      lines.push(`### ${ok} ${name}`.trim());
      const fields = { ...step };
      delete fields.name;
      delete fields.step;
      const keys = Object.keys(fields);
      for (const key of keys.sort()) {
        lines.push(`- ${key}: ${toMarkdownValue(fields[key]).trim()}`);
      }
      lines.push("");
    }
  }

  const rawKeys = raw && typeof raw === "object" ? Object.keys(raw) : [];
  if (rawKeys.length) {
    lines.push("## Raw");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(raw, null, 2));
    lines.push("```");
    lines.push("");
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return { ok: true, filePath, runDir };
}

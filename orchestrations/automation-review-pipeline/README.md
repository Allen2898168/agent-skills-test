# 自动化需求多阶段审阅流水线

Status: candidate  
Owner: cross-skill workflow layer

本目录用于沉淀“自动化需求 -> 多阶段 subagent 审阅 -> 脚本整合 -> 校验 -> 执行”的治理流程。

## 边界

- `skills/weex-admin-ops/`、`skills/weex-fin-admin-ops/`、`skills/weex-frontend-ops/`：
  继续负责各自业务域的脚本、reference、失败复盘和动作缓存。
- `orchestrations/automation-review-pipeline/`：
  只负责阶段定义、状态流转、history 目录、报告协议、阶段提示模板和最终汇总。
- 当前仓库脚本不直接调用 Codex 会话层的 `multi_agent_v1` 工具。
  仓库只提供阶段 prompt 模板、状态机和结果落盘协议；真实 subagent 由 Codex 会话层按这些合同执行。

## 入口路由

- 用户需求命中以下任一信号时，默认必须走本流水线，而不是只做并行 worker：
  - 明确说了 `subagent链路`、`按子agent`、`按subagent`、`多 subagent`
  - 明确说了 `全量回归`、`全链路回归`、`组合回归`、`跨域回归`
  - 已知跨多个 skill
  - 已知回归用例数 `> 10`
- 路由判定入口：`node orchestrations/automation-review-pipeline/scripts/resolve-entry-mode.mjs --requirement "<原始需求>"`
- 当路由结果为 `automation_review_pipeline` 时：
  - 必须先运行 `prepare-run`
  - 必须运行 `build-stage-context`
  - 必须按固定阶段调用 subagent 并 `record-stage`
  - 必须运行 `finalize-run`
  - 必须落盘到 `history/<runId>/`
- 仅仅把执行拆成几个并行 worker，不等于“已走 subagent 链路”。

## 固定阶段

1. `链路分析`
2. `覆盖审阅`
3. `返工建议`
4. `脚本整合`
5. `校验审阅`
6. `执行落地`

## 固定流转

- `链路分析 -> 覆盖审阅`
- 覆盖审阅通过：进入 `脚本整合`
- 覆盖审阅不通过：进入 `返工建议`，然后终止
- `脚本整合 -> 校验审阅`
- 校验审阅通过：进入 `执行落地`
- 校验审阅不通过：进入 `返工建议`，然后终止
- 执行落地成功：最终 `PASS`
- 执行落地失败：最终 `FAIL`

第一版不做自动无限返工；`返工建议` 是失败时的返工单，不自动回流执行。

## 覆盖不足分支

- `existingCoverage=FULL`：优先复用已有脚本、编排和 action-cache。
- `existingCoverage=PARTIAL`：允许覆盖审阅直接 `APPROVE`，但后续 `脚本整合` 必须明确“复用部分 + 待补缺口 + 补齐计划”。
- `existingCoverage=NONE`：允许覆盖审阅直接 `APPROVE`，表示“值得纳入自动化覆盖但需从零补设计”；后续 `脚本整合` 必须输出新增用例设计、脚本补齐方案、产物计划和执行入口。
- `existingCoverage=NONE/PARTIAL` 不等于拒绝；是否继续由 `覆盖审阅` 的价值与风险判断决定。
- 只要 `覆盖审阅=APPROVE`，父编排器就必须继续推进到 `脚本整合 -> 校验审阅 -> 执行落地`，不能因为“当前没有现成用例”直接终止。

## History 协议

- 权威产物目录：项目根 `history/`
- 每次运行创建：`history/YYYY-MM-DD-001/`
- 同日顺延：`002`、`003`

固定文件：

- `00-任务说明.md`
- `01-链路分析报告.md`
- `01-链路分析报告.json`
- `02-覆盖审阅报告.md`
- `02-覆盖审阅报告.json`
- `03-返工建议报告.md`
- `03-返工建议报告.json`
- `04-脚本整合报告.md`
- `04-脚本整合报告.json`
- `05-校验审阅报告.md`
- `05-校验审阅报告.json`
- `06-执行报告.md`
- `06-执行报告.json`
- `07-最终结论报告.md`
- `run-state.json`
- `run-index.json`

未进入的阶段在 `run-state.json` 中标记为 `SKIPPED`，对应 Markdown/JSON 不创建。

## CLI

准备运行：

```bash
node orchestrations/automation-review-pipeline/scripts/resolve-entry-mode.mjs \
  --requirement "subagent链路 全量回归活动后管"

node orchestrations/automation-review-pipeline/scripts/prepare-run.mjs \
  --title "抽奖后管主回归" \
  --requirement "请分析并实现本次回归要求"
```

记录阶段：

```bash
node orchestrations/automation-review-pipeline/scripts/record-stage.mjs \
  --run-id 2026-06-07-001 \
  --stage-id linkage_analysis \
  --report-json-file ./tmp/linkage-analysis.json \
  --report-markdown-file ./tmp/linkage-analysis.md
```

构建下一阶段上下文包：

```bash
node orchestrations/automation-review-pipeline/scripts/build-stage-context.mjs \
  --run-id 2026-06-07-001
```

收尾：

```bash
node orchestrations/automation-review-pipeline/scripts/finalize-run.mjs \
  --run-id 2026-06-07-001
```

## Codex 父编排器约定

Codex 会话层父编排器职责：

1. 先运行 `prepare-run`
2. 读取 `resolve-entry-mode` 结果，确认本次任务必须走流水线
3. 读取当前阶段 prompt 模板
4. 运行 `build-stage-context`，生成 `history/<runId>/context/*.md,json`
5. 调用真实 subagent
6. 将 subagent 的 Markdown/JSON 结果交给 `record-stage`
7. 读取更新后的 `run-state.json` 判断下一阶段
8. 结束后运行 `finalize-run`

下一阶段只允许读取：

- `00-任务说明.md`
- 已记录阶段的 Markdown/JSON
- `run-state.json`
- `history/<runId>/context/*.md,json`

不允许只靠口头传递阶段结论。

如果链路分析判定 `existingCoverage=NONE` 或 `PARTIAL`，且覆盖审阅已 `APPROVE`，父编排器必须把“允许新增覆盖/补齐缺口”的上下文显式传给脚本整合 subagent，不允许把该 run 误判为“当前无现成脚本所以不做”。
